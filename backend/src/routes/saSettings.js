/**
 * Super Admin Settings (plans, allowlist)
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';

const router = Router();

// GET /sa/settings
router.get('/', authenticateSuperAdmin, async (req, res) => {
  const plans = await db.query(`SELECT id, name, limits, features, created_at FROM plans ORDER BY created_at DESC`);
  const allowlist = await db.query(`SELECT id, email, created_at FROM super_admin_allowlist ORDER BY created_at DESC`);

  res.json({ plans: plans.rows, allowlist: allowlist.rows });
});

// POST /sa/settings/plans
router.post('/plans', authenticateSuperAdmin, async (req, res) => {
  const { name, limits = {}, features = {} } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const insert = await db.query(
    `INSERT INTO plans (name, limits, features) VALUES ($1, $2::jsonb, $3::jsonb) RETURNING *`,
    [name, JSON.stringify(limits), JSON.stringify(features)]
  );

  res.json({ plan: insert.rows[0] });
});

// PATCH /sa/settings/plans/:id
router.patch('/plans/:id', authenticateSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, limits, features } = req.body;

  const current = await db.query(`SELECT * FROM plans WHERE id = $1`, [id]);
  if (current.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });

  const updated = await db.query(
    `UPDATE plans SET name = $1, limits = $2::jsonb, features = $3::jsonb WHERE id = $4 RETURNING *`,
    [name || current.rows[0].name, JSON.stringify(limits || current.rows[0].limits), JSON.stringify(features || current.rows[0].features), id]
  );

  res.json({ plan: updated.rows[0] });
});

// GET /sa/settings/allowlist
router.get('/allowlist', authenticateSuperAdmin, async (req, res) => {
  const result = await db.query(`SELECT id, email, created_at FROM super_admin_allowlist ORDER BY created_at DESC`);
  res.json({ allowlist: result.rows });
});

// POST /sa/settings/allowlist
router.post('/allowlist', authenticateSuperAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  await db.query(`INSERT INTO super_admin_allowlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [email.toLowerCase()]);
  const result = await db.query(`SELECT id, email, created_at FROM super_admin_allowlist WHERE email = $1`, [email.toLowerCase()]);
  res.json({ entry: result.rows[0] });
});

// DELETE /sa/settings/allowlist/:id
router.delete('/allowlist/:id', authenticateSuperAdmin, async (req, res) => {
  const { id } = req.params;
  await db.query(`DELETE FROM super_admin_allowlist WHERE id = $1`, [id]);
  res.json({ ok: true });
});

export default router;
