import { jest } from '@jest/globals';
import { writeAuditLog, writeCompanyEvent } from '../utils/saAudit.js';
import { db } from '../db/index.js';

describe('sa audit helpers', () => {
  beforeEach(() => {
    db.query = jest.fn();
  });

  test('writeAuditLog calls db.query with metadata', async () => {
    await writeAuditLog({
      actorAdminId: 'a1',
      companyId: 'c1',
      actionType: 'impersonation_started',
      metadata: { impersonated_admin_id: 'u1' },
    });

    expect(db.query).toHaveBeenCalled();
    const args = db.query.mock.calls[0];
    expect(args[1][7]).toEqual({ impersonated_admin_id: 'u1' });
  });

  test('writeCompanyEvent calls db.query with metadata', async () => {
    await writeCompanyEvent({ companyId: 'c1', type: 'impersonation_started', actorType: 'super_admin', actorId: 'a1', metadata: { impersonated_admin_id: 'u1' } });
    expect(db.query).toHaveBeenCalled();
    const args = db.query.mock.calls[0];
    expect(args[1][4]).toEqual({ impersonated_admin_id: 'u1' });
  });
});