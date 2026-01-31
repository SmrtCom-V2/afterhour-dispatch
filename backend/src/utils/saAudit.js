import { db } from '../db/index.js';

export async function writeAuditLog({
  actorAdminId,
  companyId = null,
  actionType,
  ip = null,
  userAgent = null,
  before = null,
  after = null,
  metadata = null,
}) {
  await db.query(
    `INSERT INTO audit_log (actor_admin_id, company_id, action_type, ip, user_agent, before, after, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [actorAdminId, companyId, actionType, ip, userAgent, before, after, metadata]
  );
}

export async function writeCompanyEvent({
  companyId,
  type,
  actorType,
  actorId = null,
  metadata = null,
}) {
  await db.query(
    `INSERT INTO company_events (company_id, type, actor_type, actor_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [companyId, type, actorType, actorId, metadata]
  );
}
