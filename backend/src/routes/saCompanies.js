/**
 * Super Admin Companies Routes
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';
import { writeAuditLog, writeCompanyEvent } from '../utils/saAudit.js';

const router = Router();

function buildCompanyFilters(query, params) {
  const conditions = [];

  if (query.status) {
    params.push(query.status);
    conditions.push(`fc.status = $${params.length}`);
  }

  if (query.plan_id) {
    params.push(query.plan_id);
    conditions.push(`fc.plan_id = $${params.length}`);
  }

  if (query.search) {
    params.push(`%${query.search.toLowerCase()}%`);
    conditions.push(`(LOWER(fc.name) LIKE $${params.length} OR LOWER(fc.owner_email) LIKE $${params.length} OR CAST(fc.id AS TEXT) LIKE $${params.length})`);
  }

  if (query.signup_start) {
    params.push(query.signup_start);
    conditions.push(`fc.created_at >= $${params.length}`);
  }

  if (query.signup_end) {
    params.push(query.signup_end);
    conditions.push(`fc.created_at <= $${params.length}`);
  }

  if (query.trial_ends_in) {
    params.push(parseInt(query.trial_ends_in, 10));
    conditions.push(`fc.trial_end_at <= NOW() + ($${params.length} || ' days')::interval`);
  }

  if (query.no_activity_days) {
    params.push(parseInt(query.no_activity_days, 10));
    conditions.push(`(fc.last_activity_at IS NULL OR fc.last_activity_at <= NOW() - ($${params.length} || ' days')::interval)`);
  }

  if (query.payment_failed === 'true') {
    conditions.push(`fc.status = 'past_due'`);
  }

  if (query.over_limit === 'true') {
    conditions.push(`fc.seats_limit > 0 AND fc.seats_used > fc.seats_limit`);
  }

  return conditions;
}

router.get('/', authenticateSuperAdmin, async (req, res) => {
  const params = [];
  const conditions = buildCompanyFilters(req.query, params);
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const limit = Math.min(parseInt(req.query.limit || '25', 10), 100);
  const offset = parseInt(req.query.offset || '0', 10);

  const countResult = await db.query(
    `SELECT COUNT(*) FROM fm_company fc ${whereClause}`,
    params
  );

  params.push(limit);
  params.push(offset);

  const dataResult = await db.query(
    `SELECT
        fc.id,
        fc.name,
        fc.status,
        fc.created_at,
        fc.trial_start_at,
        fc.trial_end_at,
        fc.paid_start_at,
        fc.current_period_end_at,
        fc.seats_limit,
        fc.seats_used,
        fc.last_activity_at,
        COALESCE(fc.owner_email, fa.email) as owner_email,
        fc.plan_id,
        p.name as plan_name
     FROM fm_company fc
     LEFT JOIN plans p ON fc.plan_id = p.id
     LEFT JOIN LATERAL (
        SELECT email FROM fm_admin WHERE fm_company_id = fc.id ORDER BY created_at ASC LIMIT 1
     ) fa ON true
     ${whereClause}
     ORDER BY fc.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    total: parseInt(countResult.rows[0].count, 10),
    companies: dataResult.rows.map((row) => ({
      ...row,
      usage_primary_metric: null,
    })),
  });
});

router.get('/:companyId', authenticateSuperAdmin, async (req, res) => {
  const { companyId } = req.params;

  const companyResult = await db.query(
    `SELECT
        fc.*,
        p.name as plan_name
     FROM fm_company fc
     LEFT JOIN plans p ON fc.plan_id = p.id
     WHERE fc.id = $1`,
    [companyId]
  );

  if (companyResult.rows.length === 0) {
    return res.status(404).json({ error: 'Company not found' });
  }

  const eventsResult = await db.query(
    `SELECT id, type, actor_type, actor_id, metadata, created_at
     FROM company_events
     WHERE company_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [companyId]
  );

  res.json({
    company: companyResult.rows[0],
    events: eventsResult.rows,
    billing: {
      status: companyResult.rows[0].status,
      plan_id: companyResult.rows[0].plan_id,
      plan_name: companyResult.rows[0].plan_name,
      current_period_end_at: companyResult.rows[0].current_period_end_at,
      last_payment_status: null,
      last_payment_error: null,
      next_retry_at: null,
      invoices: [],
    },
    usage: {
      range: '30d',
      metrics: [],
    },
  });
});

router.get('/:companyId/users', authenticateSuperAdmin, async (req, res) => {
  const { companyId } = req.params;
  const usersResult = await db.query(
    `SELECT id, email, name, created_at
     FROM fm_admin
     WHERE fm_company_id = $1
     ORDER BY created_at DESC`,
    [companyId]
  );

  res.json({
    users: usersResult.rows.map((row) => ({
      ...row,
      role: 'FM_ADMIN',
      last_login_at: null,
      mfa_enabled: false,
      status: 'active',
    })),
  });
});

router.get('/:companyId/notes', authenticateSuperAdmin, async (req, res) => {
  const { companyId } = req.params;
  const notesResult = await db.query(
    `SELECT sn.id, sn.note, sn.tags, sn.created_at, fa.email as admin_email
     FROM support_notes sn
     JOIN fm_admin fa ON sn.admin_id = fa.id
     WHERE sn.company_id = $1
     ORDER BY sn.created_at DESC`,
    [companyId]
  );

  res.json({ notes: notesResult.rows });
});

router.post('/:companyId/notes', authenticateSuperAdmin, async (req, res) => {
  const { companyId } = req.params;
  const { note, tags } = req.body;

  if (!note) {
    return res.status(400).json({ error: 'Note is required' });
  }

  const insertResult = await db.query(
    `INSERT INTO support_notes (company_id, admin_id, note, tags)
     VALUES ($1, $2, $3, $4)
     RETURNING id, note, tags, created_at`,
    [companyId, req.superAdmin.id, note, tags || null]
  );

  await writeAuditLog({
    actorAdminId: req.superAdmin.id,
    companyId,
    actionType: 'support_note_added',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    before: null,
    after: insertResult.rows[0],
    metadata: { impersonated_admin_id: req.impersonatedAdminId || null },
  });

  await writeCompanyEvent({
    companyId,
    type: 'support_note_added',
    actorType: 'super_admin',
    actorId: req.superAdmin.id,
    metadata: { note_id: insertResult.rows[0].id },
  });

  res.json({ note: insertResult.rows[0] });
});

router.get('/:companyId/usage', authenticateSuperAdmin, async (req, res) => {
  const { companyId } = req.params;
  const { range = '30d' } = req.query;

  const incidentCount = await db.query(
    `SELECT COUNT(*) FROM incident i
     JOIN call c ON i.call_id = c.id
     WHERE c.fm_company_id = $1`,
    [companyId]
  );

  res.json({
    range,
    metrics: [
      { name: 'incidents', value: parseInt(incidentCount.rows[0].count, 10) },
    ],
  });
});

router.post('/:companyId/actions/extend-trial', authenticateSuperAdmin, async (req, res) => {
  const { companyId } = req.params;
  const { days, new_end_at } = req.body;

  const current = await db.query('SELECT * FROM fm_company WHERE id = $1', [companyId]);
  if (current.rows.length === 0) return res.status(404).json({ error: 'Company not found' });

  const before = current.rows[0];
  let nextEnd = new_end_at;
  if (!nextEnd && days) {
    nextEnd = new Date(Date.now() + parseInt(days, 10) * 86400000).toISOString();
  }

  if (!nextEnd) return res.status(400).json({ error: 'Trial end date required' });

  const updated = await db.query(
    `UPDATE fm_company
     SET trial_end_at = $1, status = 'trial'
     WHERE id = $2
     RETURNING *`,
    [nextEnd, companyId]
  );

  await writeAuditLog({
    actorAdminId: req.superAdmin.id,
    companyId,
    actionType: 'trial_extended',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    before,
    after: updated.rows[0],
    metadata: { impersonated_admin_id: req.impersonatedAdminId || null },
  });

  await writeCompanyEvent({
    companyId,
    type: 'trial_extended',
    actorType: 'super_admin',
    actorId: req.superAdmin.id,
    metadata: { trial_end_at: nextEnd },
  });

  res.json({ company: updated.rows[0] });
});

router.post('/:companyId/actions/change-plan', authenticateSuperAdmin, async (req, res) => {
  const { companyId } = req.params;
  const { plan_id } = req.body;

  if (!plan_id) return res.status(400).json({ error: 'plan_id required' });

  const current = await db.query('SELECT * FROM fm_company WHERE id = $1', [companyId]);
  if (current.rows.length === 0) return res.status(404).json({ error: 'Company not found' });

  const planResult = await db.query('SELECT id, name FROM plans WHERE id = $1', [plan_id]);
  if (planResult.rows.length === 0) return res.status(400).json({ error: 'Plan not found' });

  const updated = await db.query(
    `UPDATE fm_company
     SET plan_id = $1
     WHERE id = $2
     RETURNING *`,
    [plan_id, companyId]
  );

  await writeAuditLog({
    actorAdminId: req.superAdmin.id,
    companyId,
    actionType: 'plan_changed',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    before: current.rows[0],
    after: updated.rows[0],
    metadata: { impersonated_admin_id: req.impersonatedAdminId || null },
  });

  await writeCompanyEvent({
    companyId,
    type: 'plan_changed',
    actorType: 'super_admin',
    actorId: req.superAdmin.id,
    metadata: { plan_id },
  });

  res.json({ company: updated.rows[0] });
});

router.post('/:companyId/actions/suspend', authenticateSuperAdmin, async (req, res) => {
  const { companyId } = req.params;
  const { reason } = req.body;

  const current = await db.query('SELECT * FROM fm_company WHERE id = $1', [companyId]);
  if (current.rows.length === 0) return res.status(404).json({ error: 'Company not found' });

  const updated = await db.query(
    `UPDATE fm_company
     SET status = 'suspended'
     WHERE id = $1
     RETURNING *`,
    [companyId]
  );

  await writeAuditLog({
    actorAdminId: req.superAdmin.id,
    companyId,
    actionType: 'company_suspended',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    before: current.rows[0],
    after: updated.rows[0],
    metadata: { impersonated_admin_id: req.impersonatedAdminId || null },
  });

  await writeCompanyEvent({
    companyId,
    type: 'company_suspended',
    actorType: 'super_admin',
    actorId: req.superAdmin.id,
    metadata: { reason },
  });

  res.json({ company: updated.rows[0] });
});

router.post('/:companyId/actions/reactivate', authenticateSuperAdmin, async (req, res) => {
  const { companyId } = req.params;
  const { reason } = req.body;

  const current = await db.query('SELECT * FROM fm_company WHERE id = $1', [companyId]);
  if (current.rows.length === 0) return res.status(404).json({ error: 'Company not found' });

  const updated = await db.query(
    `UPDATE fm_company
     SET status = 'active'
     WHERE id = $1
     RETURNING *`,
    [companyId]
  );

  await writeAuditLog({
    actorAdminId: req.superAdmin.id,
    companyId,
    actionType: 'company_reactivated',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    before: current.rows[0],
    after: updated.rows[0],
    metadata: { impersonated_admin_id: req.impersonatedAdminId || null },
  });

  await writeCompanyEvent({
    companyId,
    type: 'company_reactivated',
    actorType: 'super_admin',
    actorId: req.superAdmin.id,
    metadata: { reason },
  });

  res.json({ company: updated.rows[0] });
});

// POST /sa/companies/:companyId/actions/impersonate
router.post('/:companyId/actions/impersonate', authenticateSuperAdmin, async (req, res) => {
  const { companyId } = req.params;
  const { admin_id } = req.body;

  if (!admin_id) return res.status(400).json({ error: 'admin_id required' });

  const adminResult = await db.query(
    `SELECT id, email, name, fm_company_id FROM fm_admin WHERE id = $1`,
    [admin_id]
  );

  if (adminResult.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });

  const admin = adminResult.rows[0];
  if (admin.fm_company_id !== companyId) return res.status(403).json({ error: 'Admin not in company' });

  await writeAuditLog({
    actorAdminId: req.superAdmin.id,
    companyId,
    actionType: 'impersonation_started',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    before: null,
    after: null,
    metadata: { impersonated_admin_id: admin.id },
  });

  await writeCompanyEvent({
    companyId,
    type: 'impersonation_started',
    actorType: 'super_admin',
    actorId: req.superAdmin.id,
    metadata: { impersonated_admin_id: admin.id },
  });

  res.json({ admin: { id: admin.id, email: admin.email, name: admin.name } });
});

// POST /sa/companies/:companyId/actions/stop-impersonation
router.post('/:companyId/actions/stop-impersonation', authenticateSuperAdmin, async (req, res) => {
  const { companyId } = req.params;
  const { admin_id } = req.body;

  await writeAuditLog({
    actorAdminId: req.superAdmin.id,
    companyId,
    actionType: 'impersonation_stopped',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    before: null,
    after: null,
    metadata: { impersonated_admin_id: admin_id || null },
  });

  await writeCompanyEvent({
    companyId,
    type: 'impersonation_stopped',
    actorType: 'super_admin',
    actorId: req.superAdmin.id,
    metadata: { impersonated_admin_id: admin_id || null },
  });

  res.json({ ok: true });
});

export default router;
