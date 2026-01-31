/**
 * Super Admin System Health
 * Comprehensive system monitoring and queue status
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';

const router = Router();

// Main system health overview
router.get('/', authenticateSuperAdmin, async (req, res) => {
  const startTime = Date.now();

  // Check DB health and measure latency
  let dbStatus = 'disconnected';
  let dbLatency = null;
  try {
    const dbStart = Date.now();
    const dbHealthy = await db.healthCheck();
    dbLatency = Date.now() - dbStart;
    dbStatus = dbHealthy ? 'connected' : 'disconnected';
  } catch {
    dbStatus = 'error';
  }

  // Get last incident
  const lastIncident = await db.query(
    `SELECT created_at FROM incident ORDER BY created_at DESC LIMIT 1`
  ).catch(() => ({ rows: [] }));

  // Get call queue stats (pending calls)
  const queueStats = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending') AS pending_calls,
       COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_calls,
       COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '1 hour') AS completed_last_hour,
       COUNT(*) FILTER (WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours') AS failed_last_24h
     FROM call`
  ).catch(() => ({ rows: [{ pending_calls: 0, in_progress_calls: 0, completed_last_hour: 0, failed_last_24h: 0 }] }));

  // Get incident queue stats
  const incidentStats = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'new') AS new_incidents,
       COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_incidents,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') AS created_last_hour,
       COUNT(*) FILTER (WHERE resolved_at >= NOW() - INTERVAL '24 hours') AS resolved_last_24h
     FROM incident`
  ).catch(() => ({ rows: [{ new_incidents: 0, in_progress_incidents: 0, created_last_hour: 0, resolved_last_24h: 0 }] }));

  // Get error counts from audit log
  const errorStats = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE action LIKE '%error%' OR action LIKE '%fail%') AS error_count_24h
     FROM sa_audit_log
     WHERE created_at >= NOW() - INTERVAL '24 hours'`
  ).catch(() => ({ rows: [{ error_count_24h: 0 }] }));

  // Get active connections (approximate from recent activity)
  const activeConnections = await db.query(
    `SELECT COUNT(DISTINCT fm_company_id) AS active_companies
     FROM fm_admin
     WHERE last_login_at >= NOW() - INTERVAL '15 minutes'`
  ).catch(() => ({ rows: [{ active_companies: 0 }] }));

  // Database table sizes
  const dbStats = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM fm_company) AS company_count,
       (SELECT COUNT(*) FROM fm_admin) AS user_count,
       (SELECT COUNT(*) FROM incident) AS incident_count,
       (SELECT COUNT(*) FROM call) AS call_count,
       (SELECT COUNT(*) FROM building) AS building_count`
  ).catch(() => ({ rows: [{}] }));

  const apiLatency = Date.now() - startTime;

  res.json({
    status: {
      api: 'ok',
      database: dbStatus,
      overall: dbStatus === 'connected' ? 'healthy' : 'degraded',
    },
    latency: {
      db_ms: dbLatency,
      api_ms: apiLatency,
    },
    queues: {
      calls: {
        pending: parseInt(queueStats.rows[0]?.pending_calls || 0, 10),
        in_progress: parseInt(queueStats.rows[0]?.in_progress_calls || 0, 10),
        completed_last_hour: parseInt(queueStats.rows[0]?.completed_last_hour || 0, 10),
        failed_last_24h: parseInt(queueStats.rows[0]?.failed_last_24h || 0, 10),
      },
      incidents: {
        new: parseInt(incidentStats.rows[0]?.new_incidents || 0, 10),
        in_progress: parseInt(incidentStats.rows[0]?.in_progress_incidents || 0, 10),
        created_last_hour: parseInt(incidentStats.rows[0]?.created_last_hour || 0, 10),
        resolved_last_24h: parseInt(incidentStats.rows[0]?.resolved_last_24h || 0, 10),
      },
    },
    errors: {
      count_24h: parseInt(errorStats.rows[0]?.error_count_24h || 0, 10),
    },
    activity: {
      active_companies: parseInt(activeConnections.rows[0]?.active_companies || 0, 10),
    },
    database: {
      companies: parseInt(dbStats.rows[0]?.company_count || 0, 10),
      users: parseInt(dbStats.rows[0]?.user_count || 0, 10),
      incidents: parseInt(dbStats.rows[0]?.incident_count || 0, 10),
      calls: parseInt(dbStats.rows[0]?.call_count || 0, 10),
      buildings: parseInt(dbStats.rows[0]?.building_count || 0, 10),
    },
    timestamps: {
      last_incident_at: lastIncident.rows[0]?.created_at || null,
      checked_at: new Date().toISOString(),
    },
  });
});

// Get recent errors/failures
router.get('/errors', authenticateSuperAdmin, async (req, res) => {
  const { limit = 50 } = req.query;

  const errors = await db.query(
    `SELECT id, action, target_type, target_id, details, actor_id, created_at
     FROM sa_audit_log
     WHERE action ILIKE '%error%' OR action ILIKE '%fail%'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  ).catch(() => ({ rows: [] }));

  res.json({
    errors: errors.rows,
    count: errors.rows.length,
  });
});

// Get queue details (call processing queue)
router.get('/queue/calls', authenticateSuperAdmin, async (req, res) => {
  const { status = 'pending', limit = 100 } = req.query;

  const calls = await db.query(
    `SELECT
       c.id,
       c.fm_company_id,
       c.status,
       c.created_at,
       c.updated_at,
       fc.name AS company_name
     FROM call c
     LEFT JOIN fm_company fc ON c.fm_company_id = fc.id
     WHERE c.status = $1
     ORDER BY c.created_at ASC
     LIMIT $2`,
    [status, limit]
  ).catch(() => ({ rows: [] }));

  res.json({
    calls: calls.rows.map(c => ({
      ...c,
      age_minutes: Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60)),
    })),
    count: calls.rows.length,
  });
});

// Get queue details (incident processing queue)
router.get('/queue/incidents', authenticateSuperAdmin, async (req, res) => {
  const { status = 'new', limit = 100 } = req.query;

  const incidents = await db.query(
    `SELECT
       i.id,
       i.status,
       i.priority,
       i.description,
       i.created_at,
       i.updated_at,
       c.fm_company_id,
       fc.name AS company_name
     FROM incident i
     LEFT JOIN call c ON i.call_id = c.id
     LEFT JOIN fm_company fc ON c.fm_company_id = fc.id
     WHERE i.status = $1
     ORDER BY
       CASE i.priority
         WHEN 'critical' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
         ELSE 5
       END,
       i.created_at ASC
     LIMIT $2`,
    [status, limit]
  ).catch(() => ({ rows: [] }));

  res.json({
    incidents: incidents.rows.map(inc => ({
      ...inc,
      age_minutes: Math.floor((Date.now() - new Date(inc.created_at).getTime()) / (1000 * 60)),
    })),
    count: incidents.rows.length,
  });
});

// Get database connection pool stats (simplified)
router.get('/database', authenticateSuperAdmin, async (req, res) => {
  // Get row counts for major tables
  const tableCounts = await db.query(
    `SELECT
       'fm_company' as table_name, COUNT(*) as row_count FROM fm_company
     UNION ALL SELECT 'fm_admin', COUNT(*) FROM fm_admin
     UNION ALL SELECT 'pm_company', COUNT(*) FROM pm_company
     UNION ALL SELECT 'building', COUNT(*) FROM building
     UNION ALL SELECT 'incident', COUNT(*) FROM incident
     UNION ALL SELECT 'call', COUNT(*) FROM call
     UNION ALL SELECT 'sa_audit_log', COUNT(*) FROM sa_audit_log`
  ).catch(() => ({ rows: [] }));

  // Get database size estimate
  const dbSize = await db.query(
    `SELECT pg_database_size(current_database()) as size_bytes`
  ).catch(() => ({ rows: [{ size_bytes: 0 }] }));

  res.json({
    tables: tableCounts.rows.map(t => ({
      name: t.table_name,
      rows: parseInt(t.row_count, 10),
    })),
    size_bytes: parseInt(dbSize.rows[0]?.size_bytes || 0, 10),
    size_mb: Math.round(parseInt(dbSize.rows[0]?.size_bytes || 0, 10) / (1024 * 1024) * 100) / 100,
  });
});

// Activity timeline (recent important events)
router.get('/activity', authenticateSuperAdmin, async (req, res) => {
  const { limit = 50 } = req.query;

  // Combine various activity sources
  const recentIncidents = await db.query(
    `SELECT
       'incident' as type,
       i.id,
       i.status,
       i.priority,
       i.created_at as timestamp,
       fc.name as company_name
     FROM incident i
     LEFT JOIN call c ON i.call_id = c.id
     LEFT JOIN fm_company fc ON c.fm_company_id = fc.id
     ORDER BY i.created_at DESC
     LIMIT 20`
  ).catch(() => ({ rows: [] }));

  const recentLogins = await db.query(
    `SELECT
       'login' as type,
       fa.id,
       fa.email,
       fa.last_login_at as timestamp,
       fc.name as company_name
     FROM fm_admin fa
     LEFT JOIN fm_company fc ON fa.fm_company_id = fc.id
     WHERE fa.last_login_at IS NOT NULL
     ORDER BY fa.last_login_at DESC
     LIMIT 20`
  ).catch(() => ({ rows: [] }));

  const recentAudit = await db.query(
    `SELECT
       'audit' as type,
       id,
       action,
       target_type,
       target_id,
       created_at as timestamp
     FROM sa_audit_log
     ORDER BY created_at DESC
     LIMIT 20`
  ).catch(() => ({ rows: [] }));

  // Merge and sort by timestamp
  const allActivity = [
    ...recentIncidents.rows,
    ...recentLogins.rows,
    ...recentAudit.rows,
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);

  res.json({
    activity: allActivity,
    count: allActivity.length,
  });
});

export default router;
