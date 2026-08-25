import { jest } from '@jest/globals';

process.env.ACCESS_CODE_ENCRYPTION_KEY = process.env.ACCESS_CODE_ENCRYPTION_KEY
  || 'a'.repeat(64); // test-only AES-256 key (hex), never used outside this process

import express from 'express';
import request from 'supertest';
import { db } from '../db/index.js';
import { generateToken } from '../middleware/auth.js';
import incidentsRouter from '../routes/incidents.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/incidents', incidentsRouter);
  return app;
}

function mockAuthLookup(user) {
  return jest.fn(() => Promise.resolve({ rows: [user] }));
}

const FM_A_USER = {
  id: 1,
  email: 'admin-a@example.com',
  name: 'Admin A',
  fm_company_id: 'company-a',
  is_admin: true,
  is_platform_admin: false,
  disabled: false,
  token_version: 0,
  company_name: 'Company A',
};

describe('incidents routes', () => {
  let app;
  let token;

  beforeEach(() => {
    app = buildApp();
    token = generateToken(FM_A_USER.id, FM_A_USER.email, { tokenVersion: 0 });
  });

  test('GET /api/incidents happy path returns incidents scoped to caller company', async () => {
    db.query = jest.fn((text, params) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)();
      if (text.includes('FROM incident i') && text.includes('LIMIT')) {
        expect(params[0]).toBe('company-a');
        return Promise.resolve({ rows: [{ id: 'i1', building_name: 'B1', pm_company_id: 'pm-a' }] });
      }
      if (text.includes('SELECT COUNT(*) FROM incident i')) {
        expect(params[0]).toBe('company-a');
        return Promise.resolve({ rows: [{ count: '1' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/incidents')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.incidents).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  test('GET /api/incidents/:id returns 404 (not leaked) for an incident belonging to another company', async () => {
    db.query = jest.fn((text, params) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)();
      if (text.includes('FROM incident i') && text.includes('WHERE i.id = $1')) {
        expect(params).toEqual(['incident-owned-by-company-b', 'company-a']);
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/incidents/incident-owned-by-company-b')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Incident not found');
  });

  test('PUT /api/incidents/:id/close cannot close an incident scoped to another company', async () => {
    db.query = jest.fn((text) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)();
      if (text.includes('UPDATE incident SET')) {
        // The scoping WHERE is folded into the UPDATE itself — simulate no
        // matching row for a company-b-owned incident.
        return Promise.resolve({ rows: [] });
      }
      if (text.includes('INSERT INTO incident_timeline')) {
        throw new Error('timeline entry must never be written when the close affected no row');
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .put('/api/incidents/incident-owned-by-company-b/close')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test' });

    expect(res.status).toBe(404);
  });

  test('POST /api/incidents/:id/translate rejects malformed input (unsupported targetLanguage) via zod validation', async () => {
    db.query = jest.fn((text) => mockAuthLookup(FM_A_USER)(text));

    const res = await request(app)
      .post('/api/incidents/i1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetLanguage: 'fr' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request data');
    expect(res.body.fields.some((f) => f.field === 'targetLanguage')).toBe(true);
  });

  test('POST /api/incidents/:id/translate cannot translate an incident scoped to another company', async () => {
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-test-dummy';
    db.query = jest.fn((text, params) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)();
      if (text.includes('SELECT i.issue_description')) {
        expect(params).toEqual(['incident-owned-by-company-b', 'company-a']);
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post('/api/incidents/incident-owned-by-company-b/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetLanguage: 'en' });

    expect(res.status).toBe(404);
  });

  test('GET /api/incidents/:id/mobile-detail cannot read an incident scoped to another company', async () => {
    db.query = jest.fn((text, params) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)();
      if (text.includes('i.issue_category, i.issue_description, i.ai_confidence')) {
        expect(params).toEqual(['incident-owned-by-company-b', 'company-a']);
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/incidents/incident-owned-by-company-b/mobile-detail')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  test('GET /api/incidents without a token is rejected', async () => {
    const res = await request(app).get('/api/incidents');
    expect(res.status).toBe(401);
  });
});
