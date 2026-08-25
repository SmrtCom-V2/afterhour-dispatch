import { jest } from '@jest/globals';

process.env.ACCESS_CODE_ENCRYPTION_KEY = process.env.ACCESS_CODE_ENCRYPTION_KEY
  || 'a'.repeat(64); // test-only AES-256 key (hex), never used outside this process

import express from 'express';
import request from 'supertest';
import { db } from '../db/index.js';
import { generateToken } from '../middleware/auth.js';
import tenantsRouter from '../routes/tenants.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tenants', tenantsRouter);
  return app;
}

// authenticateToken looks up the user fresh from the DB on every request, so
// each test must prime db.query to answer the auth lookup (fm_admin JOIN
// fm_company) before it answers the route's own query.
function mockAuthLookup(user) {
  return jest.fn((text, params) => {
    if (text.includes('FROM fm_admin fa')) {
      return Promise.resolve({ rows: [user] });
    }
    return Promise.resolve({ rows: [] });
  });
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

describe('tenants routes', () => {
  let app;
  let token;

  beforeEach(() => {
    app = buildApp();
    token = generateToken(FM_A_USER.id, FM_A_USER.email, { tokenVersion: 0 });
  });

  test('GET /api/tenants happy path returns tenants scoped to caller company, decrypted', async () => {
    const authMock = mockAuthLookup(FM_A_USER);
    db.query = jest.fn((text, params) => {
      if (text.includes('FROM fm_admin fa')) return authMock(text, params);
      if (text.includes('FROM tenant t')) {
        expect(params[0]).toBe('company-a');
        return Promise.resolve({
          rows: [
            {
              id: 't1',
              name: 'Jane Doe',
              phone: null,
              unit: '4B',
              status: 'active',
              building_name: 'Hauptstr 1',
              building_address: 'Hauptstr 1',
              pm_company_name: 'PM A',
              pm_company_id: 'pm-a',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/tenants')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.tenants).toHaveLength(1);
    expect(res.body.tenants[0].id).toBe('t1');
  });

  test('GET /api/tenants/:id returns 404 (not leaked) when tenant belongs to another company', async () => {
    db.query = jest.fn((text, params) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)(text, params);
      if (text.includes('FROM tenant t')) {
        // Simulates the JOIN ... WHERE pm.fm_company_id = $2 filter excluding
        // a tenant that belongs to a different fm_company_id.
        expect(params).toEqual(['tenant-owned-by-company-b', 'company-a']);
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/tenants/tenant-owned-by-company-b')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Tenant not found');
  });

  test('PUT /api/tenants/:id cannot update a tenant scoped to another company (blocked by ownership check)', async () => {
    db.query = jest.fn((text, params) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)(text, params);
      if (text.startsWith('\n      SELECT t.id FROM tenant t') || text.includes('SELECT t.id FROM tenant t')) {
        return Promise.resolve({ rows: [] }); // not owned by company-a
      }
      if (text.includes('UPDATE tenant SET')) {
        throw new Error('UPDATE must never run when the ownership check found no matching row');
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .put('/api/tenants/tenant-owned-by-company-b')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hacked Name' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Tenant not found');
  });

  test('DELETE /api/tenants/:id cannot deactivate a tenant scoped to another company', async () => {
    db.query = jest.fn((text) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)('FROM fm_admin fa');
      if (text.includes('SELECT t.id FROM tenant t')) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("UPDATE tenant SET status = 'inactive'")) {
        throw new Error('soft-delete must never run when the ownership check found no matching row');
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .delete('/api/tenants/tenant-owned-by-company-b')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('POST /api/tenants rejects malformed input (missing phone) via zod validation', async () => {
    db.query = jest.fn((text) => mockAuthLookup(FM_A_USER)(text));

    const res = await request(app)
      .post('/api/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ buildingId: 'b1', name: 'No Phone Guy' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request data');
    expect(res.body.fields.some((f) => f.field === 'phone')).toBe(true);
  });

  test('POST /api/tenants rejects a buildingId belonging to another company', async () => {
    db.query = jest.fn((text) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)(text);
      if (text.includes('SELECT b.id FROM building b')) {
        return Promise.resolve({ rows: [] }); // building not owned by company-a
      }
      if (text.includes('INSERT INTO tenant')) {
        throw new Error('INSERT must never run when the building ownership check failed');
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post('/api/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ buildingId: 'building-owned-by-company-b', name: 'Jane', phone: '+491234567' });

    expect(res.status).toBe(403);
  });

  test('GET /api/tenants without a token is rejected', async () => {
    const res = await request(app).get('/api/tenants');
    expect(res.status).toBe(401);
  });
});
