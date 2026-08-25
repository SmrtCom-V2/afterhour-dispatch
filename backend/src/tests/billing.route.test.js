import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { db } from '../db/index.js';
import { generateToken } from '../middleware/auth.js';
import billingRouter from '../routes/billing.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/billing', billingRouter);
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

describe('billing routes', () => {
  let app;
  let token;
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    app = buildApp();
    token = generateToken(FM_A_USER.id, FM_A_USER.email, { tokenVersion: 0 });
  });

  afterEach(() => {
    if (originalStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalStripeKey;
  });

  test('GET /api/billing/status happy path returns billing status for caller company only', async () => {
    db.query = jest.fn((text, params) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)();
      if (text.includes('CREATE TABLE')) return Promise.resolve({ rows: [] });
      if (text.includes('FROM fm_company fc')) {
        expect(params[0]).toBe('company-a');
        return Promise.resolve({
          rows: [{
            id: 'company-a',
            name: 'Company A',
            status: 'active',
            trial_start_at: null,
            trial_end_at: null,
            paid_start_at: null,
            stripe_customer_id: 'cus_123',
            subscription_status: 'active',
            current_period_end: null,
            cancel_at_period_end: false,
          }],
        });
      }
      if (text.includes('FROM invoices')) {
        expect(params[0]).toBe('company-a');
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/billing/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.company.id).toBe('company-a');
    expect(res.body.subscription.stripeCustomerId).toBe('cus_123');
  });

  test('GET /api/billing/status without a token is rejected (cannot read another company\'s billing without auth)', async () => {
    const res = await request(app).get('/api/billing/status');
    expect(res.status).toBe(401);
  });

  test('GET /api/billing/status always scopes by the authenticated caller\'s own fm_company_id, never a client-supplied id', async () => {
    // Even if a caller tries to pass a companyId in the query string, the
    // route never reads it — it only ever uses req.user.fm_company_id from
    // the verified JWT. This proves cross-tenant billing reads aren't
    // possible via query-string tampering.
    let capturedCompanyId = null;
    db.query = jest.fn((text, params) => {
      if (text.includes('FROM fm_admin fa')) return mockAuthLookup(FM_A_USER)();
      if (text.includes('CREATE TABLE')) return Promise.resolve({ rows: [] });
      if (text.includes('FROM fm_company fc')) {
        capturedCompanyId = params[0];
        return Promise.resolve({ rows: [{ id: 'company-a', name: 'Company A', status: 'active' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    await request(app)
      .get('/api/billing/status?companyId=company-b')
      .set('Authorization', `Bearer ${token}`);

    expect(capturedCompanyId).toBe('company-a');
  });

  test('POST /api/billing/create-checkout returns 503 when Stripe is not configured (malformed/unusable environment)', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    db.query = jest.fn((text) => mockAuthLookup(FM_A_USER)(text));

    const res = await request(app)
      .post('/api/billing/create-checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ priceId: 'price_123' });

    expect(res.status).toBe(503);
  });

  test('POST /api/billing/create-checkout rejects malformed input (invalid successUrl) via zod validation', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    db.query = jest.fn((text) => mockAuthLookup(FM_A_USER)(text));

    const res = await request(app)
      .post('/api/billing/create-checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ successUrl: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request data');
  });

  test('GET /api/billing/plans is public (no auth required) and returns plans', async () => {
    db.query = jest.fn((text) => {
      if (text.includes('FROM packages')) {
        return Promise.resolve({
          rows: [{
            id: 'plan_basic',
            name: 'Basic',
            tagline: 'Starter',
            description: 'desc',
            monthly_price_cents: 9900,
            setup_fee_cents: 0,
            limits_json: { max_properties: 5, max_incidents_month: 50 },
            ideal_for: 'small FM',
            stripe_price_id: 'price_basic',
            display_order: 1,
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app).get('/api/billing/plans');

    expect(res.status).toBe(200);
    expect(res.body.plans).toHaveLength(1);
    expect(res.body.plans[0].id).toBe('basic');
  });
});
