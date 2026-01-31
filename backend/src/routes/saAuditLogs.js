/**
 * Super Admin Audit Logs
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';

const router = Router();

router.get('/', authenticateSuperAdmin, async (req, res) => {
  const params = [];
  const conditions = [];

  if (req.query.company_id) {
    params.push(req.query.company_id);
    conditions.push(`al.company_id = $${params.length}`);
  }

  if (req.query.actor_admin_id) {
    params.push(req.query.actor_admin_id);
    conditions.push(`al.actor_admin_id = $${params.length}`);
  }

  if (req.query.action_type) {
    params.push(req.query.action_type);
    conditions.push(`al.action_type = $${params.length}`);
  }

  if (req.query.start) {
    params.push(req.query.start);
    conditions.push(`al.created_at >= $${params.length}`);
  }

  if (req.query.end) {
    params.push(req.query.end);
    conditions.push(`al.created_at <= $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  const offset = parseInt(req.query.offset || '0', 10);

  const countResult = await db.query(
    `SELECT COUNT(*) FROM audit_log al ${whereClause}`,
    params
  );

  params.push(limit);
  params.push(offset);

  const logsResult = await db.query(
    `SELECT
        al.id,
        al.actor_admin_id,
        fa.email as actor_email,
        al.company_id,
        fc.name as company_name,
        al.action_type,
        al.ip,
        al.user_agent,
        al.before,
        al.after,
        al.created_at
     FROM audit_log al
     LEFT JOIN fm_admin fa ON al.actor_admin_id = fa.id
     LEFT JOIN fm_company fc ON al.company_id = fc.id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    total: parseInt(countResult.rows[0].count, 10),
    logs: logsResult.rows,
  });
});

export default router;
