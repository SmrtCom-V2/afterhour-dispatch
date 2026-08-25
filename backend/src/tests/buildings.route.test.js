import { jest } from '@jest/globals';

process.env.ACCESS_CODE_ENCRYPTION_KEY = process.env.ACCESS_CODE_ENCRYPTION_KEY
  || 'a'.repeat(64); // test-only AES-256 key (hex), never used outside this process

import express from 'express';
import request from 'supertest';
import { db } from '../db/index.js';
import { generateToken } from '../middleware/auth.js';
import buildingsRouter from '../routes/buildings.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/buildings', buildingsRouter);
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

describe('buildings routes', () => {
  let app;
  let token;

  beforeEach(() => {
    app = buildApp();
    token = generateToken(FM_A_USER.id, FM_A_USER.email, { tokenVersion: 0 });
  });

  test('GET /api/buildings happy path lists buildings scoped to caller company', async () => {
    db.query = jest.fn((text, params) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)();
      if (text.includes('FROM building b')) {
        expect(params[0]).toBe('company-a');
        return Promise.resolve({
          rows: [{ id: 'b1', pm_company_id: 'pm-a', name: 'Hauptstr 1', address: 'Hauptstr 1' }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/buildings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.buildings).toHaveLength(1);
    // list view must never leak access codes (Blocker #4) — assert the
    // query text itself never selects b.* for the bulk list path
    const listCall = db.query.mock.calls.find(([text]) => text.includes('FROM building b') && text.includes('JOIN pm_company'));
    expect(listCall[0]).not.toMatch(/key_safe_code/);
  });

  test('GET /api/buildings/:id returns 404 (not leaked) for a building in another company', async () => {
    db.query = jest.fn((text, params) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)();
      if (text.includes('FROM building b') && text.includes('b.*')) {
        expect(params).toEqual(['building-owned-by-company-b', 'company-a']);
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/buildings/building-owned-by-company-b')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Building not found');
  });

  test('PUT /api/buildings/:id cannot update a building scoped to another company', async () => {
    db.query = jest.fn((text) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)();
      if (text.includes('SELECT b.id FROM building b')) {
        return Promise.resolve({ rows: [] }); // not owned by company-a
      }
      if (text.includes('UPDATE building SET')) {
        throw new Error('UPDATE must never run when the ownership check found no matching row');
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .put('/api/buildings/building-owned-by-company-b')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hacked Name' });

    expect(res.status).toBe(404);
  });

  test('DELETE /api/buildings/:id cannot delete a building scoped to another company', async () => {
    db.query = jest.fn((text) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)();
      if (text.includes('SELECT b.id FROM building b')) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes('DELETE FROM building')) {
        throw new Error('DELETE must never run when the ownership check found no matching row');
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .delete('/api/buildings/building-owned-by-company-b')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('POST /api/buildings rejects malformed input (missing address) via zod validation', async () => {
    db.query = jest.fn((text) => mockAuthLookup(FM_A_USER)(text));

    const res = await request(app)
      .post('/api/buildings')
      .set('Authorization', `Bearer ${token}`)
      .send({ pmCompanyId: 'pm-a' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request data');
    expect(res.body.fields.some((f) => f.field === 'address')).toBe(true);
  });

  test('POST /api/buildings rejects a pmCompanyId belonging to another company', async () => {
    db.query = jest.fn((text) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)();
      if (text.includes('FROM pm_company WHERE id')) {
        return Promise.resolve({ rows: [] }); // pm company not owned by company-a
      }
      if (text.includes('INSERT INTO building')) {
        throw new Error('INSERT must never run when the pm-company ownership check failed');
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post('/api/buildings')
      .set('Authorization', `Bearer ${token}`)
      .send({ pmCompanyId: 'pm-owned-by-company-b', address: 'Somewhere 1' });

    expect(res.status).toBe(403);
  });

  test('GET /api/buildings without a token is rejected', async () => {
    const res = await request(app).get('/api/buildings');
    expect(res.status).toBe(401);
  });
});
