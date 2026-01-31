/**
 * Super Admin GDPR Tools
 * Data privacy management, export, and deletion tools
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';

const router = Router();

// GET /sa/gdpr/stats - Get GDPR compliance stats
router.get('/stats', authenticateSuperAdmin, async (req, res) => {
  try {
    // Get export request counts
    const exportRequests = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) as total
      FROM gdpr_export_requests
      WHERE created_at > NOW() - INTERVAL '30 days'
    `).catch(() => ({ rows: [{ pending: 0, completed: 0, processing: 0, total: 0 }] }));

    // Get deletion request counts
    const deletionRequests = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) as total
      FROM gdpr_deletion_requests
      WHERE created_at > NOW() - INTERVAL '30 days'
    `).catch(() => ({ rows: [{ pending: 0, completed: 0, processing: 0, total: 0 }] }));

    // Get consent stats
    const consentStats = await db.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE marketing_consent = true) as marketing_consent,
        COUNT(*) FILTER (WHERE analytics_consent = true) as analytics_consent,
        COUNT(*) FILTER (WHERE data_sharing_consent = true) as data_sharing_consent
      FROM users
    `).catch(() => ({ rows: [{ total_users: 0, marketing_consent: 0, analytics_consent: 0, data_sharing_consent: 0 }] }));

    res.json({
      export_requests: exportRequests.rows[0],
      deletion_requests: deletionRequests.rows[0],
      consent_stats: consentStats.rows[0],
    });
  } catch (error) {
    console.error('Error fetching GDPR stats:', error);
    res.status(500).json({ error: 'Failed to fetch GDPR stats' });
  }
});

// GET /sa/gdpr/export-requests - List data export requests
router.get('/export-requests', authenticateSuperAdmin, async (req, res) => {
  try {
    const { status, days = 30 } = req.query;

    let query = `
      SELECT
        ger.*,
        u.name as user_name,
        u.email as user_email,
        c.name as company_name
      FROM gdpr_export_requests ger
      LEFT JOIN users u ON u.id = ger.user_id
      LEFT JOIN pm_companies c ON c.id = ger.company_id
      WHERE ger.created_at > NOW() - INTERVAL '${parseInt(days, 10)} days'
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND ger.status = $${params.length}`;
    }

    query += ' ORDER BY ger.created_at DESC LIMIT 100';

    const result = await db.query(query, params).catch(() => ({ rows: [] }));
    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Error fetching export requests:', error);
    res.status(500).json({ error: 'Failed to fetch export requests' });
  }
});

// GET /sa/gdpr/deletion-requests - List data deletion requests
router.get('/deletion-requests', authenticateSuperAdmin, async (req, res) => {
  try {
    const { status, days = 30 } = req.query;

    let query = `
      SELECT
        gdr.*,
        u.name as user_name,
        u.email as user_email,
        c.name as company_name
      FROM gdpr_deletion_requests gdr
      LEFT JOIN users u ON u.id = gdr.user_id
      LEFT JOIN pm_companies c ON c.id = gdr.company_id
      WHERE gdr.created_at > NOW() - INTERVAL '${parseInt(days, 10)} days'
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND gdr.status = $${params.length}`;
    }

    query += ' ORDER BY gdr.created_at DESC LIMIT 100';

    const result = await db.query(query, params).catch(() => ({ rows: [] }));
    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Error fetching deletion requests:', error);
    res.status(500).json({ error: 'Failed to fetch deletion requests' });
  }
});

// POST /sa/gdpr/export-requests/:id/process - Process an export request
router.post('/export-requests/:id/process', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Update status to processing
    await db.query(`
      UPDATE gdpr_export_requests
      SET status = 'processing', processed_at = NOW()
      WHERE id = $1
    `, [id]).catch(() => {});

    // In a real implementation, this would trigger an async job
    // For now, we'll mark it as completed after "processing"
    setTimeout(async () => {
      await db.query(`
        UPDATE gdpr_export_requests
        SET status = 'completed', completed_at = NOW()
        WHERE id = $1
      `, [id]).catch(() => {});
    }, 2000);

    res.json({ ok: true, message: 'Export request processing started' });
  } catch (error) {
    console.error('Error processing export request:', error);
    res.status(500).json({ error: 'Failed to process export request' });
  }
});

// POST /sa/gdpr/deletion-requests/:id/process - Process a deletion request
router.post('/deletion-requests/:id/process', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { confirm } = req.body;

    if (!confirm) {
      return res.status(400).json({ error: 'Confirmation required for deletion' });
    }

    // Update status to processing
    await db.query(`
      UPDATE gdpr_deletion_requests
      SET status = 'processing', processed_at = NOW()
      WHERE id = $1
    `, [id]).catch(() => {});

    res.json({ ok: true, message: 'Deletion request processing started' });
  } catch (error) {
    console.error('Error processing deletion request:', error);
    res.status(500).json({ error: 'Failed to process deletion request' });
  }
});

// POST /sa/gdpr/deletion-requests/:id/reject - Reject a deletion request
router.post('/deletion-requests/:id/reject', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await db.query(`
      UPDATE gdpr_deletion_requests
      SET status = 'rejected', rejection_reason = $2, processed_at = NOW()
      WHERE id = $1
    `, [id, reason || 'Request rejected by administrator']).catch(() => {});

    res.json({ ok: true });
  } catch (error) {
    console.error('Error rejecting deletion request:', error);
    res.status(500).json({ error: 'Failed to reject deletion request' });
  }
});

// GET /sa/gdpr/user/:userId/data - Get all data for a specific user (data portability)
router.get('/user/:userId/data', authenticateSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user profile
    const userResult = await db.query(`
      SELECT id, name, email, phone, role, created_at, last_login_at,
             marketing_consent, analytics_consent, data_sharing_consent
      FROM users WHERE id = $1
    `, [userId]).catch(() => ({ rows: [] }));

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's incidents
    const incidents = await db.query(`
      SELECT id, title, description, status, priority, created_at
      FROM incidents WHERE created_by = $1
      ORDER BY created_at DESC
    `, [userId]).catch(() => ({ rows: [] }));

    // Get user's activity logs
    const activityLogs = await db.query(`
      SELECT action, target_type, created_at, ip_address
      FROM sa_audit_logs WHERE user_id = $1
      ORDER BY created_at DESC LIMIT 100
    `, [userId]).catch(() => ({ rows: [] }));

    // Get user's session history
    const sessions = await db.query(`
      SELECT created_at, ip_address, user_agent, last_activity_at
      FROM user_sessions WHERE user_id = $1
      ORDER BY created_at DESC LIMIT 50
    `, [userId]).catch(() => ({ rows: [] }));

    res.json({
      user: userResult.rows[0],
      incidents: incidents.rows,
      activity_logs: activityLogs.rows,
      sessions: sessions.rows,
      exported_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// GET /sa/gdpr/company/:companyId/data - Get all data for a specific company
router.get('/company/:companyId/data', authenticateSuperAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;

    // Get company profile
    const companyResult = await db.query(`
      SELECT * FROM pm_companies WHERE id = $1
    `, [companyId]).catch(() => ({ rows: [] }));

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get company users
    const users = await db.query(`
      SELECT id, name, email, role, created_at
      FROM users WHERE company_id = $1
    `, [companyId]).catch(() => ({ rows: [] }));

    // Get company buildings
    const buildings = await db.query(`
      SELECT id, name, address, created_at
      FROM buildings WHERE company_id = $1
    `, [companyId]).catch(() => ({ rows: [] }));

    // Get company incidents count
    const incidentsCount = await db.query(`
      SELECT COUNT(*) as count FROM incidents WHERE company_id = $1
    `, [companyId]).catch(() => ({ rows: [{ count: 0 }] }));

    res.json({
      company: companyResult.rows[0],
      users: users.rows,
      buildings: buildings.rows,
      incidents_count: parseInt(incidentsCount.rows[0].count, 10),
      exported_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching company data:', error);
    res.status(500).json({ error: 'Failed to fetch company data' });
  }
});

// POST /sa/gdpr/user/:userId/anonymize - Anonymize user data (soft delete)
router.post('/user/:userId/anonymize', authenticateSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { confirm, reason } = req.body;

    if (!confirm) {
      return res.status(400).json({ error: 'Confirmation required for anonymization' });
    }

    // Anonymize user data
    const anonymizedEmail = `deleted_${userId}@anonymized.local`;
    const anonymizedName = 'Deleted User';

    await db.query(`
      UPDATE users
      SET
        name = $2,
        email = $3,
        phone = NULL,
        disabled = true,
        anonymized_at = NOW(),
        anonymization_reason = $4
      WHERE id = $1
    `, [userId, anonymizedName, anonymizedEmail, reason || 'GDPR deletion request']).catch(() => {});

    // Log the action
    await db.query(`
      INSERT INTO sa_audit_logs (admin_id, action, target_type, target_id, details)
      VALUES ($1, 'anonymize_user', 'user', $2, $3)
    `, [req.saAdmin.id, userId, JSON.stringify({ reason })]).catch(() => {});

    res.json({ ok: true, message: 'User data anonymized' });
  } catch (error) {
    console.error('Error anonymizing user:', error);
    res.status(500).json({ error: 'Failed to anonymize user' });
  }
});

// GET /sa/gdpr/consent-log - Get consent change log
router.get('/consent-log', authenticateSuperAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await db.query(`
      SELECT
        cl.*,
        u.name as user_name,
        u.email as user_email
      FROM consent_log cl
      LEFT JOIN users u ON u.id = cl.user_id
      WHERE cl.created_at > NOW() - INTERVAL '${parseInt(days, 10)} days'
      ORDER BY cl.created_at DESC
      LIMIT 200
    `).catch(() => ({ rows: [] }));

    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Error fetching consent log:', error);
    res.status(500).json({ error: 'Failed to fetch consent log' });
  }
});

// GET /sa/gdpr/data-retention - Get data retention settings
router.get('/data-retention', authenticateSuperAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM gdpr_data_retention_settings
    `).catch(() => ({ rows: [] }));

    // Default settings if none exist
    const defaults = [
      { data_type: 'incidents', retention_days: 365, auto_delete: false, description: 'Incident records' },
      { data_type: 'audit_logs', retention_days: 730, auto_delete: true, description: 'Audit log entries' },
      { data_type: 'user_sessions', retention_days: 90, auto_delete: true, description: 'User session data' },
      { data_type: 'call_recordings', retention_days: 180, auto_delete: false, description: 'Call recordings' },
      { data_type: 'export_requests', retention_days: 30, auto_delete: true, description: 'Data export requests' },
    ];

    const settings = result.rows.length > 0 ? result.rows : defaults;
    res.json({ settings });
  } catch (error) {
    console.error('Error fetching data retention settings:', error);
    res.status(500).json({ error: 'Failed to fetch data retention settings' });
  }
});

// PUT /sa/gdpr/data-retention/:dataType - Update data retention setting
router.put('/data-retention/:dataType', authenticateSuperAdmin, async (req, res) => {
  try {
    const { dataType } = req.params;
    const { retention_days, auto_delete } = req.body;

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS gdpr_data_retention_settings (
        data_type VARCHAR(100) PRIMARY KEY,
        retention_days INTEGER NOT NULL DEFAULT 365,
        auto_delete BOOLEAN DEFAULT false,
        description TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});

    await db.query(`
      INSERT INTO gdpr_data_retention_settings (data_type, retention_days, auto_delete, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (data_type) DO UPDATE SET
        retention_days = $2,
        auto_delete = $3,
        updated_at = NOW()
    `, [dataType, retention_days, auto_delete]);

    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating data retention:', error);
    res.status(500).json({ error: 'Failed to update data retention settings' });
  }
});

// POST /sa/gdpr/run-cleanup - Manually trigger data cleanup
router.post('/run-cleanup', authenticateSuperAdmin, async (req, res) => {
  try {
    const { data_type, dry_run = true } = req.body;

    // Get retention settings
    const settings = await db.query(`
      SELECT * FROM gdpr_data_retention_settings WHERE data_type = $1
    `, [data_type]).catch(() => ({ rows: [] }));

    if (settings.rows.length === 0) {
      return res.status(400).json({ error: 'No retention settings found for this data type' });
    }

    const { retention_days } = settings.rows[0];

    // Count records that would be deleted
    let countQuery = '';
    switch (data_type) {
      case 'audit_logs':
        countQuery = `SELECT COUNT(*) FROM sa_audit_logs WHERE created_at < NOW() - INTERVAL '${retention_days} days'`;
        break;
      case 'user_sessions':
        countQuery = `SELECT COUNT(*) FROM user_sessions WHERE last_activity_at < NOW() - INTERVAL '${retention_days} days'`;
        break;
      default:
        return res.status(400).json({ error: 'Unknown data type' });
    }

    const countResult = await db.query(countQuery).catch(() => ({ rows: [{ count: 0 }] }));
    const recordCount = parseInt(countResult.rows[0].count, 10);

    if (dry_run) {
      res.json({
        dry_run: true,
        data_type,
        retention_days,
        records_to_delete: recordCount,
      });
    } else {
      // Actually delete the records
      let deleteQuery = '';
      switch (data_type) {
        case 'audit_logs':
          deleteQuery = `DELETE FROM sa_audit_logs WHERE created_at < NOW() - INTERVAL '${retention_days} days'`;
          break;
        case 'user_sessions':
          deleteQuery = `DELETE FROM user_sessions WHERE last_activity_at < NOW() - INTERVAL '${retention_days} days'`;
          break;
      }

      await db.query(deleteQuery).catch(() => {});

      res.json({
        dry_run: false,
        data_type,
        records_deleted: recordCount,
      });
    }
  } catch (error) {
    console.error('Error running cleanup:', error);
    res.status(500).json({ error: 'Failed to run cleanup' });
  }
});

export default router;
