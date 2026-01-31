/**
 * Super Admin Export
 * Bulk data export functionality
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Get available export types
router.get('/types', authenticateSuperAdmin, async (req, res) => {
  res.json({
    types: [
      { id: 'companies', name: 'Companies', description: 'All FM companies with plan and status' },
      { id: 'users', name: 'Users', description: 'All FM admin users across companies' },
      { id: 'trials', name: 'Trials', description: 'Current trial companies with activation metrics' },
      { id: 'subscriptions', name: 'Subscriptions', description: 'Active subscriptions with billing info' },
      { id: 'incidents', name: 'Incidents', description: 'All incidents with status and resolution' },
      { id: 'buildings', name: 'Buildings', description: 'All buildings with PM assignments' },
      { id: 'audit_logs', name: 'Audit Logs', description: 'Super admin audit trail' },
    ],
  });
});

// Export companies
router.get('/companies', authenticateSuperAdmin, async (req, res) => {
  const { format = 'json' } = req.query;

  const result = await db.query(
    `SELECT
       fc.id,
       fc.name,
       fc.status,
       fc.owner_email,
       fc.phone_number,
       p.name AS plan_name,
       p.monthly_price_cents / 100.0 AS price_monthly,
       fc.trial_start_at,
       fc.trial_end_at,
       fc.paid_start_at,
       fc.current_period_end_at,
       fc.created_at,
       (SELECT COUNT(*) FROM fm_admin fa WHERE fa.fm_company_id = fc.id) AS user_count,
       (SELECT COUNT(*) FROM pm_company pm WHERE pm.fm_company_id = fc.id) AS pm_count,
       (SELECT COUNT(*) FROM building b JOIN pm_company pm ON b.pm_company_id = pm.id WHERE pm.fm_company_id = fc.id) AS building_count
     FROM fm_company fc
     LEFT JOIN packages p ON fc.package_id = p.id
     ORDER BY fc.created_at DESC`
  );

  logger.info('Export: companies', { count: result.rows.length, format });

  if (format === 'csv') {
    return sendCsv(res, result.rows, 'companies');
  }

  res.json({ data: result.rows, count: result.rows.length, exported_at: new Date().toISOString() });
});

// Export users
router.get('/users', authenticateSuperAdmin, async (req, res) => {
  const { format = 'json' } = req.query;

  const result = await db.query(
    `SELECT
       fa.id,
       fa.email,
       fa.name,
       fa.is_admin,
       fa.created_at,
       fa.last_login_at,
       fc.name AS company_name,
       fc.status AS company_status
     FROM fm_admin fa
     LEFT JOIN fm_company fc ON fa.fm_company_id = fc.id
     ORDER BY fa.created_at DESC`
  );

  logger.info('Export: users', { count: result.rows.length, format });

  if (format === 'csv') {
    return sendCsv(res, result.rows, 'users');
  }

  res.json({ data: result.rows, count: result.rows.length, exported_at: new Date().toISOString() });
});

// Export trials
router.get('/trials', authenticateSuperAdmin, async (req, res) => {
  const { format = 'json' } = req.query;

  const result = await db.query(
    `SELECT
       fc.id,
       fc.name,
       fc.owner_email,
       fc.trial_start_at,
       fc.trial_end_at,
       fc.last_activity_at,
       (SELECT COUNT(*) FROM pm_company pm WHERE pm.fm_company_id = fc.id) AS pm_count,
       (SELECT COUNT(*) FROM building b JOIN pm_company pm ON b.pm_company_id = pm.id WHERE pm.fm_company_id = fc.id) AS building_count,
       (SELECT COUNT(*) FROM incident i JOIN call c ON i.call_id = c.id WHERE c.fm_company_id = fc.id) AS incident_count,
       (SELECT COUNT(*) FROM fm_admin fa WHERE fa.fm_company_id = fc.id) AS user_count
     FROM fm_company fc
     WHERE fc.status = 'trial'
     ORDER BY fc.trial_end_at ASC NULLS LAST`
  );

  // Add activation score
  const trials = result.rows.map(row => {
    const buildingScore = parseInt(row.building_count, 10) > 0 ? 40 : 0;
    const incidentScore = parseInt(row.incident_count, 10) > 0 ? 30 : 0;
    const userScore = parseInt(row.user_count, 10) > 1 ? 15 : 0;
    const pmScore = parseInt(row.pm_count, 10) > 0 ? 15 : 0;
    return {
      ...row,
      activation_score: buildingScore + incidentScore + userScore + pmScore,
    };
  });

  logger.info('Export: trials', { count: trials.length, format });

  if (format === 'csv') {
    return sendCsv(res, trials, 'trials');
  }

  res.json({ data: trials, count: trials.length, exported_at: new Date().toISOString() });
});

// Export subscriptions
router.get('/subscriptions', authenticateSuperAdmin, async (req, res) => {
  const { format = 'json' } = req.query;

  const result = await db.query(
    `SELECT
       fc.id,
       fc.name,
       fc.owner_email,
       fc.status,
       p.name AS plan_name,
       p.monthly_price_cents / 100.0 AS price_monthly,
       p.price_yearly,
       fc.paid_start_at,
       fc.current_period_end_at,
       fc.stripe_customer_id,
       fc.stripe_subscription_id
     FROM fm_company fc
     JOIN plans p ON fc.plan_id = p.id
     WHERE fc.paid_start_at IS NOT NULL
     ORDER BY fc.paid_start_at DESC`
  );

  logger.info('Export: subscriptions', { count: result.rows.length, format });

  if (format === 'csv') {
    return sendCsv(res, result.rows, 'subscriptions');
  }

  res.json({ data: result.rows, count: result.rows.length, exported_at: new Date().toISOString() });
});

// Export incidents
router.get('/incidents', authenticateSuperAdmin, async (req, res) => {
  const { format = 'json', days = 90 } = req.query;

  const result = await db.query(
    `SELECT
       i.id,
       i.status,
       i.priority,
       i.description,
       i.created_at,
       i.updated_at,
       i.resolved_at,
       fc.name AS company_name,
       b.name AS building_name
     FROM incident i
     LEFT JOIN call c ON i.call_id = c.id
     LEFT JOIN fm_company fc ON c.fm_company_id = fc.id
     LEFT JOIN building b ON i.building_id = b.id
     WHERE i.created_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'
     ORDER BY i.created_at DESC`
  );

  logger.info('Export: incidents', { count: result.rows.length, format, days });

  if (format === 'csv') {
    return sendCsv(res, result.rows, 'incidents');
  }

  res.json({ data: result.rows, count: result.rows.length, exported_at: new Date().toISOString() });
});

// Export buildings
router.get('/buildings', authenticateSuperAdmin, async (req, res) => {
  const { format = 'json' } = req.query;

  const result = await db.query(
    `SELECT
       b.id,
       b.name,
       b.address,
       b.city,
       b.state,
       b.zip,
       b.created_at,
       pm.name AS pm_company_name,
       fc.name AS fm_company_name
     FROM building b
     LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
     LEFT JOIN fm_company fc ON pm.fm_company_id = fc.id
     ORDER BY b.created_at DESC`
  );

  logger.info('Export: buildings', { count: result.rows.length, format });

  if (format === 'csv') {
    return sendCsv(res, result.rows, 'buildings');
  }

  res.json({ data: result.rows, count: result.rows.length, exported_at: new Date().toISOString() });
});

// Export audit logs
router.get('/audit-logs', authenticateSuperAdmin, async (req, res) => {
  const { format = 'json', days = 30 } = req.query;

  const result = await db.query(
    `SELECT
       id,
       action,
       target_type,
       target_id,
       details,
       actor_id,
       created_at
     FROM sa_audit_log
     WHERE created_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'
     ORDER BY created_at DESC`
  );

  logger.info('Export: audit_logs', { count: result.rows.length, format, days });

  if (format === 'csv') {
    return sendCsv(res, result.rows, 'audit_logs');
  }

  res.json({ data: result.rows, count: result.rows.length, exported_at: new Date().toISOString() });
});

// Helper to send CSV response
function sendCsv(res, data, filename) {
  if (!data || data.length === 0) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}_export.csv"`);
    return res.send('');
  }

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(h => {
      let val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') val = JSON.stringify(val);
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val}"`;
      }
      return val;
    });
    csvRows.push(values.join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}_export_${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csvRows.join('\n'));
}

export default router;
