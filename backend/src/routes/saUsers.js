/**
 * Super Admin Users
 * User management and activity tracking
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';
import { writeAuditLog } from '../utils/saAudit.js';

const router = Router();

// Get all users with activity data
router.get('/', authenticateSuperAdmin, async (req, res) => {
  const { query, status, company_id, sort = 'last_login', limit = 100 } = req.query;
  const params = [];
  const conditions = [];
  let paramIndex = 1;

  if (query) {
    conditions.push(`(LOWER(fa.email) LIKE $${paramIndex} OR LOWER(fa.name) LIKE $${paramIndex})`);
    params.push(`%${query.toLowerCase()}%`);
    paramIndex++;
  }

  if (company_id) {
    conditions.push(`fa.fm_company_id = $${paramIndex}`);
    params.push(company_id);
    paramIndex++;
  }

  if (status === 'active') {
    conditions.push(`(fa.disabled IS NULL OR fa.disabled = false)`);
    conditions.push(`fa.last_login_at >= NOW() - INTERVAL '30 days'`);
  } else if (status === 'inactive') {
    conditions.push(`(fa.disabled IS NULL OR fa.disabled = false)`);
    conditions.push(`(fa.last_login_at IS NULL OR fa.last_login_at < NOW() - INTERVAL '30 days')`);
  } else if (status === 'disabled') {
    conditions.push(`fa.disabled = true`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderBy = 'fa.last_login_at DESC NULLS LAST';
  if (sort === 'created') orderBy = 'fa.created_at DESC';
  if (sort === 'name') orderBy = 'fa.name ASC';
  if (sort === 'company') orderBy = 'fc.name ASC';

  const result = await db.query(
    `SELECT
       fa.id,
       fa.email,
       fa.name,
       fa.is_admin,
       fa.fm_company_id,
       fa.created_at,
       fa.last_login_at,
       fa.disabled,
       fc.name AS company_name,
       fc.status AS company_status
     FROM fm_admin fa
     LEFT JOIN fm_company fc ON fa.fm_company_id = fc.id
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT $${paramIndex}`,
    [...params, limit]
  );

  res.json({
    users: result.rows.map((row) => ({
      ...row,
      role: row.is_admin ? 'Admin' : 'User',
      status: row.disabled ? 'disabled' : (row.last_login_at && new Date(row.last_login_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) ? 'active' : 'inactive'),
    })),
    count: result.rows.length,
  });
});

// Get user activity stats
router.get('/stats', authenticateSuperAdmin, async (req, res) => {
  const stats = await db.query(
    `SELECT
       COUNT(*) AS total_users,
       COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '24 hours') AS active_24h,
       COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days') AS active_7d,
       COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '30 days') AS active_30d,
       COUNT(*) FILTER (WHERE last_login_at IS NULL OR last_login_at < NOW() - INTERVAL '30 days') AS inactive,
       COUNT(*) FILTER (WHERE disabled = true) AS disabled,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_users_7d
     FROM fm_admin`
  ).catch(() => ({ rows: [{}] }));

  res.json({ stats: stats.rows[0] });
});

// Get single user detail
router.get('/:id', authenticateSuperAdmin, async (req, res) => {
  const { id } = req.params;

  const user = await db.query(
    `SELECT
       fa.id,
       fa.email,
       fa.name,
       fa.is_admin,
       fa.fm_company_id,
       fa.created_at,
       fa.last_login_at,
       fa.disabled,
       fc.name AS company_name,
       fc.status AS company_status,
       fc.owner_email AS company_owner
     FROM fm_admin fa
     LEFT JOIN fm_company fc ON fa.fm_company_id = fc.id
     WHERE fa.id = $1`,
    [id]
  );

  if (user.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user: user.rows[0] });
});

// Get user activity history
router.get('/:id/activity', authenticateSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;

  // Get audit log entries for this user
  const activity = await db.query(
    `SELECT id, action, details, created_at
     FROM sa_audit_log
     WHERE target_id = $1 AND target_type = 'fm_admin'
     ORDER BY created_at DESC
     LIMIT $2`,
    [id, limit]
  ).catch(() => ({ rows: [] }));

  res.json({ activity: activity.rows });
});

// Disable user
router.post('/:id/disable', authenticateSuperAdmin, async (req, res) => {
  const { id } = req.params;

  const current = await db.query(
    `SELECT id, email, fm_company_id, name, disabled FROM fm_admin WHERE id = $1`,
    [id]
  );

  if (current.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const updated = await db.query(
    `UPDATE fm_admin SET disabled = true WHERE id = $1
     RETURNING id, email, fm_company_id, name, disabled`,
    [id]
  );

  await writeAuditLog({
    actorAdminId: req.superAdmin?.id || 'system',
    companyId: updated.rows[0].fm_company_id,
    actionType: 'user_disabled',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    before: current.rows[0],
    after: updated.rows[0],
    metadata: { impersonated_admin_id: req.impersonatedAdminId || null },
  }).catch(() => {});

  res.json({ user: updated.rows[0], success: true });
});

// Enable user
router.post('/:id/enable', authenticateSuperAdmin, async (req, res) => {
  const { id } = req.params;

  const current = await db.query(
    `SELECT id, email, fm_company_id, name, disabled FROM fm_admin WHERE id = $1`,
    [id]
  );

  if (current.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const updated = await db.query(
    `UPDATE fm_admin SET disabled = false WHERE id = $1
     RETURNING id, email, fm_company_id, name, disabled`,
    [id]
  );

  await writeAuditLog({
    actorAdminId: req.superAdmin?.id || 'system',
    companyId: updated.rows[0].fm_company_id,
    actionType: 'user_enabled',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    before: current.rows[0],
    after: updated.rows[0],
    metadata: {},
  }).catch(() => {});

  res.json({ user: updated.rows[0], success: true });
});

// Get active sessions summary
router.get('/sessions/active', authenticateSuperAdmin, async (req, res) => {
  const sessions = await db.query(
    `SELECT
       fa.id,
       fa.email,
       fa.name,
       fa.last_login_at,
       fc.name AS company_name
     FROM fm_admin fa
     LEFT JOIN fm_company fc ON fa.fm_company_id = fc.id
     WHERE fa.last_login_at >= NOW() - INTERVAL '15 minutes'
     ORDER BY fa.last_login_at DESC`
  ).catch(() => ({ rows: [] }));

  res.json({
    sessions: sessions.rows,
    count: sessions.rows.length,
  });
});

export default router;
