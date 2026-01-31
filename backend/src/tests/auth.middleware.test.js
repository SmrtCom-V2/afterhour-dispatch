import { jest } from '@jest/globals';
import { generateToken } from '../middleware/auth.js';
import { authenticateToken } from '../middleware/auth.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';
import { db } from '../db/index.js';

// Lightweight mocks for req/res/next
function makeReq(token) {
  return { headers: { authorization: `Bearer ${token}` } };
}

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Middleware role enforcement (unit tests)', () => {
  beforeEach(() => {
    // Reset any mocked implementations
    db.query = jest.fn();
  });

  test('authenticateToken rejects super_admin token for tenant endpoints', async () => {
    const token = generateToken(1, 'sa@example.com', { role: 'super_admin' });
    const req = makeReq(token);
    const res = makeRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('authenticateSuperAdmin accepts a valid super_admin token and sets req.superAdmin', async () => {
    // Mock allowlist query and user lookup
    db.query = jest.fn((text) => {
      if (text.includes('SELECT email FROM super_admin_allowlist')) {
        return Promise.resolve({ rows: [{ email: 'sa@example.com' }] });
      }
      if (text.includes('SELECT id, email, name, is_super_admin')) {
        return Promise.resolve({ rows: [{ id: 1, email: 'sa@example.com', name: 'SA', is_super_admin: true }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = generateToken(1, 'sa@example.com', { role: 'super_admin' });
    const req = makeReq(token);
    const res = makeRes();
    const next = jest.fn();

    await authenticateSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.superAdmin).toBeDefined();
    expect(req.superAdmin.email).toBe('sa@example.com');
  });

  test('authenticateSuperAdmin rejects token without super_admin role', async () => {
    const token = generateToken(2, 'user@example.com');
    const req = makeReq(token);
    const res = makeRes();
    const next = jest.fn();

    await authenticateSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});