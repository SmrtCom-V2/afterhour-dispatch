/**
 * Super Admin Trials
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Get all trials with stats
router.get('/', authenticateSuperAdmin, async (req, res) => {
  const { filter } = req.query;

  let whereClause = `fc.status = 'trial'`;

  if (filter === 'ending_soon') {
    whereClause += ` AND fc.trial_end_at IS NOT NULL AND fc.trial_end_at <= NOW() + INTERVAL '7 days'`;
  } else if (filter === 'inactive') {
    whereClause += ` AND (fc.last_activity_at IS NULL OR fc.last_activity_at <= NOW() - INTERVAL '72 hours')`;
  } else if (filter === 'active') {
    whereClause += ` AND fc.last_activity_at IS NOT NULL AND fc.last_activity_at > NOW() - INTERVAL '72 hours'`;
  }

  const result = await db.query(
    `SELECT
        fc.id,
        fc.name,
        fc.trial_start_at,
        fc.trial_end_at,
        fc.last_activity_at,
        fc.owner_email,
        (SELECT COUNT(*) FROM pm_company pm WHERE pm.fm_company_id = fc.id) AS pm_count,
        (SELECT COUNT(*)
         FROM building b
         JOIN pm_company pm ON b.pm_company_id = pm.id
         WHERE pm.fm_company_id = fc.id) AS building_count,
        (SELECT COUNT(*)
         FROM incident i
         JOIN call c ON i.call_id = c.id
         WHERE c.fm_company_id = fc.id) AS incident_count,
        (SELECT COUNT(*) FROM fm_admin fa WHERE fa.fm_company_id = fc.id) AS user_count
     FROM fm_company fc
     WHERE ${whereClause}
     ORDER BY fc.trial_end_at ASC NULLS LAST`
  );

  const trials = result.rows.map((row) => {
    const buildingScore = parseInt(row.building_count, 10) > 0 ? 40 : 0;
    const incidentScore = parseInt(row.incident_count, 10) > 0 ? 30 : 0;
    const userScore = parseInt(row.user_count, 10) > 1 ? 15 : 0;
    const pmScore = parseInt(row.pm_count, 10) > 0 ? 15 : 0;
    const activationScore = buildingScore + incidentScore + userScore + pmScore;

    // Calculate days remaining
    const daysRemaining = row.trial_end_at
      ? Math.ceil((new Date(row.trial_end_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      ...row,
      activation_score: activationScore,
      days_remaining: daysRemaining,
    };
  });

  // Get summary stats
  const statsResult = await db.query(
    `SELECT
       COUNT(*) AS total_trials,
       COUNT(*) FILTER (WHERE trial_end_at IS NOT NULL AND trial_end_at <= NOW() + INTERVAL '7 days') AS ending_soon,
       COUNT(*) FILTER (WHERE last_activity_at IS NULL OR last_activity_at <= NOW() - INTERVAL '72 hours') AS inactive,
       COUNT(*) FILTER (WHERE last_activity_at IS NOT NULL AND last_activity_at > NOW() - INTERVAL '72 hours') AS active
     FROM fm_company
     WHERE status = 'trial'`
  );

  res.json({
    trials,
    stats: {
      total: parseInt(statsResult.rows[0].total_trials, 10),
      ending_soon: parseInt(statsResult.rows[0].ending_soon, 10),
      inactive: parseInt(statsResult.rows[0].inactive, 10),
      active: parseInt(statsResult.rows[0].active, 10),
    },
  });
});

// Extend trial for a company
router.post('/:companyId/extend', authenticateSuperAdmin, async (req, res) => {
  const { companyId } = req.params;
  const { days, reason } = req.body;

  if (!days || days < 1 || days > 90) {
    return res.status(400).json({ error: 'Days must be between 1 and 90' });
  }

  // Get current company
  const company = await db.query(
    `SELECT id, name, trial_end_at, status FROM fm_company WHERE id = $1`,
    [companyId]
  );

  if (company.rows.length === 0) {
    return res.status(404).json({ error: 'Company not found' });
  }

  if (company.rows[0].status !== 'trial') {
    return res.status(400).json({ error: 'Company is not in trial status' });
  }

  // Calculate new end date
  const currentEndDate = company.rows[0].trial_end_at
    ? new Date(company.rows[0].trial_end_at)
    : new Date();
  const newEndDate = new Date(currentEndDate.getTime() + days * 24 * 60 * 60 * 1000);

  // Update trial end date
  await db.query(
    `UPDATE fm_company SET trial_end_at = $1 WHERE id = $2`,
    [newEndDate.toISOString(), companyId]
  );

  // Log the action
  try {
    await db.query(
      `INSERT INTO sa_audit_log (action, target_type, target_id, details, actor_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'extend_trial',
        'fm_company',
        companyId,
        JSON.stringify({
          days,
          reason,
          previous_end_date: company.rows[0].trial_end_at,
          new_end_date: newEndDate.toISOString(),
        }),
        req.user?.id || 'system',
      ]
    );
  } catch (logError) {
    logger.warn('Failed to log trial extension', { error: logError.message });
  }

  logger.info('Trial extended', {
    companyId,
    days,
    newEndDate: newEndDate.toISOString(),
    reason,
  });

  res.json({
    success: true,
    company_id: companyId,
    new_trial_end_at: newEndDate.toISOString(),
    days_added: days,
  });
});

// Bulk extend trials
router.post('/bulk-extend', authenticateSuperAdmin, async (req, res) => {
  const { company_ids, days, reason } = req.body;

  if (!Array.isArray(company_ids) || company_ids.length === 0) {
    return res.status(400).json({ error: 'company_ids must be a non-empty array' });
  }

  if (!days || days < 1 || days > 90) {
    return res.status(400).json({ error: 'Days must be between 1 and 90' });
  }

  const results = {
    success: [],
    failed: [],
  };

  for (const companyId of company_ids) {
    try {
      const company = await db.query(
        `SELECT id, name, trial_end_at, status FROM fm_company WHERE id = $1`,
        [companyId]
      );

      if (company.rows.length === 0) {
        results.failed.push({ id: companyId, error: 'Company not found' });
        continue;
      }

      if (company.rows[0].status !== 'trial') {
        results.failed.push({ id: companyId, error: 'Not in trial status' });
        continue;
      }

      const currentEndDate = company.rows[0].trial_end_at
        ? new Date(company.rows[0].trial_end_at)
        : new Date();
      const newEndDate = new Date(currentEndDate.getTime() + days * 24 * 60 * 60 * 1000);

      await db.query(
        `UPDATE fm_company SET trial_end_at = $1 WHERE id = $2`,
        [newEndDate.toISOString(), companyId]
      );

      results.success.push({
        id: companyId,
        name: company.rows[0].name,
        new_trial_end_at: newEndDate.toISOString(),
      });
    } catch (err) {
      results.failed.push({ id: companyId, error: err.message });
    }
  }

  logger.info('Bulk trial extension', {
    total: company_ids.length,
    success: results.success.length,
    failed: results.failed.length,
    days,
    reason,
  });

  res.json({
    results,
    summary: {
      total: company_ids.length,
      success: results.success.length,
      failed: results.failed.length,
    },
  });
});

export default router;
