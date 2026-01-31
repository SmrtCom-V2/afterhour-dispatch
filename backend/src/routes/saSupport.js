/**
 * Super Admin Support & Communication Tools
 * Internal notes, customer notes, email templates
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Get all support notes with optional filters
router.get('/notes', authenticateSuperAdmin, async (req, res) => {
  const { company_id, type, search, limit = 100 } = req.query;
  const params = [];
  const conditions = [];
  let paramIndex = 1;

  if (company_id) {
    conditions.push(`sn.company_id = $${paramIndex}`);
    params.push(company_id);
    paramIndex++;
  }

  if (type) {
    conditions.push(`sn.note_type = $${paramIndex}`);
    params.push(type);
    paramIndex++;
  }

  if (search) {
    conditions.push(`(sn.note ILIKE $${paramIndex} OR fc.name ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT
       sn.id,
       sn.company_id,
       sn.note,
       sn.note_type,
       sn.priority,
       sn.tags,
       sn.created_at,
       sn.updated_at,
       sn.created_by,
       fc.name AS company_name,
       fc.owner_email AS company_email,
       fc.status AS company_status
     FROM sa_support_notes sn
     LEFT JOIN fm_company fc ON sn.company_id = fc.id
     ORDER BY
       CASE sn.priority
         WHEN 'urgent' THEN 1
         WHEN 'high' THEN 2
         WHEN 'normal' THEN 3
         WHEN 'low' THEN 4
         ELSE 5
       END,
       sn.created_at DESC
     LIMIT $${paramIndex}`,
    [...params, limit]
  ).catch(() => ({ rows: [] }));

  res.json({ notes: result.rows, count: result.rows.length });
});

// Create a new support note
router.post('/notes', authenticateSuperAdmin, async (req, res) => {
  const { company_id, note, note_type = 'internal', priority = 'normal', tags = [] } = req.body;

  if (!note) {
    return res.status(400).json({ error: 'Note content is required' });
  }

  const result = await db.query(
    `INSERT INTO sa_support_notes (company_id, note, note_type, priority, tags, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [company_id || null, note, note_type, priority, JSON.stringify(tags), req.user?.id || 'system']
  );

  logger.info('Support note created', { noteId: result.rows[0].id, companyId: company_id });

  res.status(201).json({ note: result.rows[0] });
});

// Update a support note
router.put('/notes/:noteId', authenticateSuperAdmin, async (req, res) => {
  const { noteId } = req.params;
  const { note, note_type, priority, tags } = req.body;

  const result = await db.query(
    `UPDATE sa_support_notes SET
       note = COALESCE($1, note),
       note_type = COALESCE($2, note_type),
       priority = COALESCE($3, priority),
       tags = COALESCE($4, tags),
       updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [note, note_type, priority, tags ? JSON.stringify(tags) : null, noteId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Note not found' });
  }

  res.json({ note: result.rows[0] });
});

// Delete a support note
router.delete('/notes/:noteId', authenticateSuperAdmin, async (req, res) => {
  const { noteId } = req.params;

  const result = await db.query(
    'DELETE FROM sa_support_notes WHERE id = $1 RETURNING id',
    [noteId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Note not found' });
  }

  res.json({ success: true });
});

// Get email templates
router.get('/templates', authenticateSuperAdmin, async (req, res) => {
  const result = await db.query(
    `SELECT id, name, subject, body, category, created_at, updated_at
     FROM sa_email_templates
     ORDER BY category, name`
  ).catch(() => ({ rows: [] }));

  // If no templates exist, return default templates
  if (result.rows.length === 0) {
    return res.json({
      templates: [
        {
          id: 'default-welcome',
          name: 'Welcome Email',
          subject: 'Welcome to 24-7 Dispatch!',
          body: `Hi {{company_name}},\n\nWelcome to 24-7 Dispatch! We're excited to have you on board.\n\nYour trial started on {{trial_start_date}} and ends on {{trial_end_date}}.\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\nThe 24-7 Dispatch Team`,
          category: 'onboarding',
        },
        {
          id: 'default-trial-ending',
          name: 'Trial Ending Soon',
          subject: 'Your trial is ending soon',
          body: `Hi {{company_name}},\n\nYour trial period will end on {{trial_end_date}}.\n\nTo continue using 24-7 Dispatch without interruption, please upgrade to a paid plan.\n\nBest regards,\nThe 24-7 Dispatch Team`,
          category: 'trial',
        },
        {
          id: 'default-trial-extended',
          name: 'Trial Extended',
          subject: 'Your trial has been extended',
          body: `Hi {{company_name}},\n\nGreat news! We've extended your trial by {{extension_days}} days.\n\nYour new trial end date is {{new_trial_end_date}}.\n\nBest regards,\nThe 24-7 Dispatch Team`,
          category: 'trial',
        },
        {
          id: 'default-payment-failed',
          name: 'Payment Failed',
          subject: 'Payment issue with your account',
          body: `Hi {{company_name}},\n\nWe were unable to process your payment.\n\nPlease update your payment method to avoid service interruption.\n\nBest regards,\nThe 24-7 Dispatch Team`,
          category: 'billing',
        },
        {
          id: 'default-check-in',
          name: 'Customer Check-in',
          subject: 'How are things going?',
          body: `Hi {{company_name}},\n\nI wanted to check in and see how things are going with 24-7 Dispatch.\n\nIs there anything we can help you with or any feedback you'd like to share?\n\nBest regards,\nThe 24-7 Dispatch Team`,
          category: 'engagement',
        },
      ],
    });
  }

  res.json({ templates: result.rows });
});

// Save/Update email template
router.post('/templates', authenticateSuperAdmin, async (req, res) => {
  const { id, name, subject, body, category } = req.body;

  if (!name || !subject || !body) {
    return res.status(400).json({ error: 'Name, subject, and body are required' });
  }

  if (id && !id.startsWith('default-')) {
    // Update existing
    const result = await db.query(
      `UPDATE sa_email_templates SET
         name = $1, subject = $2, body = $3, category = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [name, subject, body, category || 'general', id]
    );
    res.json({ template: result.rows[0] });
  } else {
    // Create new
    const result = await db.query(
      `INSERT INTO sa_email_templates (name, subject, body, category)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, subject, body, category || 'general']
    );
    res.json({ template: result.rows[0] });
  }
});

// Get communication history for a company
router.get('/company/:companyId/history', authenticateSuperAdmin, async (req, res) => {
  const { companyId } = req.params;

  const notes = await db.query(
    `SELECT id, note, note_type, priority, tags, created_at, created_by
     FROM sa_support_notes
     WHERE company_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [companyId]
  ).catch(() => ({ rows: [] }));

  const auditLogs = await db.query(
    `SELECT id, action, details, created_at, actor_id
     FROM sa_audit_log
     WHERE target_id = $1 AND target_type = 'fm_company'
     ORDER BY created_at DESC
     LIMIT 50`,
    [companyId]
  ).catch(() => ({ rows: [] }));

  res.json({
    notes: notes.rows,
    audit_logs: auditLogs.rows,
  });
});

// Get support summary stats
router.get('/stats', authenticateSuperAdmin, async (req, res) => {
  const stats = await db.query(
    `SELECT
       COUNT(*) AS total_notes,
       COUNT(*) FILTER (WHERE priority = 'urgent') AS urgent_notes,
       COUNT(*) FILTER (WHERE priority = 'high') AS high_priority_notes,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS notes_today,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS notes_week
     FROM sa_support_notes`
  ).catch(() => ({ rows: [{ total_notes: 0, urgent_notes: 0, high_priority_notes: 0, notes_today: 0, notes_week: 0 }] }));

  res.json({ stats: stats.rows[0] });
});

export default router;
