import { jest } from '@jest/globals';

process.env.ACCESS_CODE_ENCRYPTION_KEY = process.env.ACCESS_CODE_ENCRYPTION_KEY || 'a'.repeat(64);
process.env.FRONTEND_URL = 'https://staging.example.com';

// Mock the side-effecting services so no real dispatch call / SMS / voice
// call fires during the test. We assert on these mocks instead.
const startDispatch = jest.fn(() => Promise.resolve({ success: true }));
const recordManualDispatch = jest.fn(() => Promise.resolve({ success: true }));
const notifyHuman = jest.fn(() => Promise.resolve({ delivered: true }));

jest.unstable_mockModule('../services/dispatch.js', () => ({
  startDispatch,
  recordManualDispatch,
  default: { startDispatch, recordManualDispatch },
}));
jest.unstable_mockModule('../services/notificationChannel.js', () => ({
  notifyHuman,
  default: { notifyHuman },
}));

const { db } = await import('../db/index.js');
const express = (await import('express')).default;
const request = (await import('supertest')).default;
const cockpitRouter = (await import('../routes/cockpit.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cockpit', cockpitRouter);
  return app;
}

const VALID_TOKEN = 'tok-valid';
const INCIDENT_ID = 'inc-1';

const tokenRow = {
  id: 'ct-1',
  incident_id: INCIDENT_ID,
  role: 'primary',
  person_name: 'Dana On-Call',
  phone: '+490001',
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  used_at: null,
};

// A pending incident with an FM on-call phone configured.
function pendingIncidentRow(overrides = {}) {
  return {
    building_id: 'bld-1',
    issue_category: 'water_leak',
    decision: 'pending',
    callback_count: 0,
    fm_oncall_name: 'Frank FM',
    fm_oncall_phone: '+49FMONCALL',
    ...overrides,
  };
}

/**
 * Route db.query by SQL fragment. `state` lets a test flip the incident's
 * decision to simulate the race (someone else decided first).
 */
function mockDb(state = {}) {
  const decision = state.decision || 'pending';
  db.query = jest.fn((text, params) => {
    // token lookup
    if (text.includes('FROM cockpit_token ct') && text.includes('WHERE ct.token')) {
      return Promise.resolve({ rows: params[0] === VALID_TOKEN ? [tokenRow] : [] });
    }
    // incident lookup in the decision handler
    if (text.includes('FROM incident i') && text.includes('LEFT JOIN fm_company fm')) {
      return Promise.resolve({ rows: [pendingIncidentRow({ decision, ...state.incidentOverrides })] });
    }
    // suggested SP lookup
    if (text.includes('FROM service_provider sp') && text.includes('ORDER BY bsp.priority ASC LIMIT 1')) {
      return Promise.resolve({ rows: state.noSp ? [] : [{ id: 'sp-suggested' }] });
    }
    // the race-gated decision UPDATE
    if (text.includes('UPDATE incident') && text.includes("decision = $1") && text.includes("decision = 'pending'")) {
      // rowCount 0 when the incident is no longer pending (race lost)
      return Promise.resolve({ rows: decision === 'pending' ? [{ id: INCIDENT_ID }] : [], rowCount: decision === 'pending' ? 1 : 0 });
    }
    // callback_tenant UPDATE
    if (text.includes('UPDATE incident SET callback_count')) {
      return Promise.resolve({
        rows: decision === 'pending' ? [{ callback_count: 1 }] : [],
        rowCount: decision === 'pending' ? 1 : 0,
      });
    }
    // "already decided" lookup
    if (text.includes('SELECT decided_by_person, night_outcome FROM incident')) {
      return Promise.resolve({ rows: [{ decided_by_person: 'Someone Else', night_outcome: 'dispatched' }] });
    }
    // forward link insert
    if (text.includes('INSERT INTO cockpit_forward_link')) {
      return Promise.resolve({ rows: [] });
    }
    // any timeline insert / token update / misc
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/cockpit/:token/decision', () => {
  test('send_company resolves the incident and triggers auto dispatch', async () => {
    mockDb();
    const res = await request(buildApp())
      .post(`/api/cockpit/${VALID_TOKEN}/decision`)
      .send({ action: 'send_company', chosenSpId: 'sp-x' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, action: 'send_company', dispatchMode: 'auto' });
    expect(startDispatch).toHaveBeenCalledWith(INCIDENT_ID, 'plumber', 'sp-x');
    expect(recordManualDispatch).not.toHaveBeenCalled();
  });

  test('send_company_manual records a manual dispatch and does NOT auto-call', async () => {
    mockDb();
    const res = await request(buildApp())
      .post(`/api/cockpit/${VALID_TOKEN}/decision`)
      .send({ action: 'send_company_manual', chosenSpId: 'sp-x' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ action: 'send_company_manual', nightOutcome: 'dispatched_manual', dispatchMode: 'manual' });
    expect(recordManualDispatch).toHaveBeenCalledWith(INCIDENT_ID, 'sp-x', 'Dana On-Call');
    expect(startDispatch).not.toHaveBeenCalled();
  });

  test('escalate_fm rings the FM on-call and sets the human-escalation decision', async () => {
    mockDb();
    const res = await request(buildApp())
      .post(`/api/cockpit/${VALID_TOKEN}/decision`)
      .send({ action: 'escalate_fm' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nightOutcome: 'escalated_to_fm' });
    expect(notifyHuman).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'fm_escalation', recipient: expect.objectContaining({ phone: '+49FMONCALL' }) }),
    );
  });

  test('escalate_fm with no FM on-call configured returns 422, does not notify', async () => {
    mockDb({ incidentOverrides: { fm_oncall_phone: null, fm_oncall_name: null } });
    const res = await request(buildApp())
      .post(`/api/cockpit/${VALID_TOKEN}/decision`)
      .send({ action: 'escalate_fm' });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'no_fm_oncall_configured' });
    expect(notifyHuman).not.toHaveBeenCalled();
  });

  test('callback_tenant does NOT resolve the incident (race stays open)', async () => {
    mockDb();
    const res = await request(buildApp())
      .post(`/api/cockpit/${VALID_TOKEN}/decision`)
      .send({ action: 'callback_tenant' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, action: 'callback_tenant', callbackCount: 1 });
    // none of the resolving side effects fired
    expect(startDispatch).not.toHaveBeenCalled();
    expect(recordManualDispatch).not.toHaveBeenCalled();
    expect(notifyHuman).not.toHaveBeenCalled();
    // and the race-gated decision UPDATE was never issued
    const ranDecisionUpdate = db.query.mock.calls.some(
      ([t]) => t.includes('UPDATE incident') && t.includes('decision = $1'),
    );
    expect(ranDecisionUpdate).toBe(false);
  });

  test('a second resolving decision after one already landed returns 409', async () => {
    mockDb({ decision: 'emergency_dispatch' }); // someone already decided
    const res = await request(buildApp())
      .post(`/api/cockpit/${VALID_TOKEN}/decision`)
      .send({ action: 'defer_morning' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'already_decided', decidedByPerson: 'Someone Else' });
  });

  test('callback_tenant after a decision already landed returns 409', async () => {
    mockDb({ decision: 'not_emergency' });
    const res = await request(buildApp())
      .post(`/api/cockpit/${VALID_TOKEN}/decision`)
      .send({ action: 'callback_tenant' });

    expect(res.status).toBe(409);
  });

  test('unknown action is rejected', async () => {
    mockDb();
    const res = await request(buildApp())
      .post(`/api/cockpit/${VALID_TOKEN}/decision`)
      .send({ action: 'nuke_it' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_action' });
  });

  test('expired token is rejected before any work', async () => {
    db.query = jest.fn((text, params) => {
      if (text.includes('FROM cockpit_token ct')) {
        return Promise.resolve({ rows: [{ ...tokenRow, expires_at: new Date(Date.now() - 1000).toISOString() }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const res = await request(buildApp())
      .post(`/api/cockpit/${VALID_TOKEN}/decision`)
      .send({ action: 'send_company' });

    expect(res.status).toBe(410);
  });
});

describe('POST /api/cockpit/:token/forward', () => {
  test('creates a forward link and returns a URL', async () => {
    mockDb();
    const res = await request(buildApp()).post(`/api/cockpit/${VALID_TOKEN}/forward`).send({});

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^https:\/\/staging\.example\.com\/cockpit\/forward\/[a-f0-9]{48}$/);
    const inserted = db.query.mock.calls.some(([t]) => t.includes('INSERT INTO cockpit_forward_link'));
    expect(inserted).toBe(true);
  });
});

describe('GET /api/cockpit/forward/:token', () => {
  test('returns a code-stripped payload — no access codes anywhere', async () => {
    db.query = jest.fn((text) => {
      if (text.includes('FROM cockpit_forward_link WHERE token')) {
        return Promise.resolve({
          rows: [{ id: 'fl-1', incident_id: INCIDENT_ID, expires_at: new Date(Date.now() + 3600_000).toISOString() }],
        });
      }
      if (text.includes('FROM incident i') && text.includes('LEFT JOIN call c')) {
        return Promise.resolve({
          rows: [{
            id: INCIDENT_ID,
            issue_category: 'water_leak',
            issue_description: 'ceiling leak',
            created_at: new Date().toISOString(),
            building_name: 'Hauptstr 10',
            building_address: 'Hauptstr 10, Berlin',
            transcript: 'Caller: water everywhere',
          }],
        });
      }
      if (text.includes("event_type = 'ai_incident_summary'")) {
        return Promise.resolve({ rows: [{ event_data: { headline: 'Leak', emergency_assessment: { is_emergency: 'yes' } } }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(buildApp()).get('/api/cockpit/forward/abc123');
    expect(res.status).toBe(200);

    const flat = JSON.stringify(res.body).toLowerCase();
    expect(flat).not.toContain('keysafe');
    expect(flat).not.toContain('gatecode');
    expect(flat).not.toContain('mainentrancecode');
    expect(flat).not.toContain('janitor');
    expect(res.body.incident.aiBrief.headline).toBe('Leak');
    expect(res.body.building.address).toBe('Hauptstr 10, Berlin');
  });

  test('expired forward link returns 410', async () => {
    db.query = jest.fn((text) => {
      if (text.includes('FROM cockpit_forward_link WHERE token')) {
        return Promise.resolve({
          rows: [{ id: 'fl-1', incident_id: INCIDENT_ID, expires_at: new Date(Date.now() - 1000).toISOString() }],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    const res = await request(buildApp()).get('/api/cockpit/forward/abc123');
    expect(res.status).toBe(410);
  });
});
