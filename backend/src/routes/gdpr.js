/**
 * User-facing GDPR endpoints
 * Allows users to request data export and deletion
 */

import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { GDPR_EXPORT_DIR } from '../services/gdprExportStore.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Ensure GDPR tables exist
const ensureTables = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS gdpr_export_requests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL,
      company_id UUID,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      processed_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      download_url TEXT,
      expires_at TIMESTAMP WITH TIME ZONE
    )
  `).catch(() => {});

  await db.query(`
    CREATE TABLE IF NOT EXISTS gdpr_deletion_requests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL,
      company_id UUID,
      status VARCHAR(20) DEFAULT 'pending',
      reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      processed_at TIMESTAMP WITH TIME ZONE,
      rejection_reason TEXT
    )
  `).catch(() => {});

  await db.query(`
    CREATE TABLE IF NOT EXISTS consent_log (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL,
      consent_type VARCHAR(50) NOT NULL,
      consented BOOLEAN NOT NULL,
      ip_address VARCHAR(50),
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `).catch(() => {});
};

// GET /api/gdpr/my-requests - Get user's GDPR requests
router.get('/my-requests', authenticateToken, async (req, res) => {
  try {
    await ensureTables();

    const exportRequests = await db.query(`
      SELECT id, status, created_at, completed_at, download_url, expires_at
      FROM gdpr_export_requests
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [req.user.id]);

    const deletionRequests = await db.query(`
      SELECT id, status, created_at, processed_at, rejection_reason
      FROM gdpr_deletion_requests
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [req.user.id]);

    res.json({
      export_requests: exportRequests.rows,
      deletion_requests: deletionRequests.rows,
    });
  } catch (error) {
    console.error('Error fetching GDPR requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// POST /api/gdpr/request-export - Request data export
router.post('/request-export', authenticateToken, async (req, res) => {
  try {
    await ensureTables();

    // Check if there's already a pending request
    const existing = await db.query(`
      SELECT id FROM gdpr_export_requests
      WHERE user_id = $1 AND status IN ('pending', 'processing')
    `, [req.user.id]);

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'You already have a pending export request',
      });
    }

    const result = await db.query(`
      INSERT INTO gdpr_export_requests (user_id, company_id)
      VALUES ($1, $2)
      RETURNING id, status, created_at
    `, [req.user.id, req.user.fm_company_id]);

    res.json({
      ok: true,
      message: 'Export request submitted. You will be notified when your data is ready.',
      request: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating export request:', error);
    res.status(500).json({ error: 'Failed to submit export request' });
  }
});

// POST /api/gdpr/request-deletion - Request account deletion
router.post('/request-deletion', authenticateToken, async (req, res) => {
  try {
    await ensureTables();
    const { reason } = req.body;

    // Check if there's already a pending request
    const existing = await db.query(`
      SELECT id FROM gdpr_deletion_requests
      WHERE user_id = $1 AND status IN ('pending', 'processing')
    `, [req.user.id]);

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'You already have a pending deletion request',
      });
    }

    const result = await db.query(`
      INSERT INTO gdpr_deletion_requests (user_id, company_id, reason)
      VALUES ($1, $2, $3)
      RETURNING id, status, created_at
    `, [req.user.id, req.user.fm_company_id, reason]);

    res.json({
      ok: true,
      message: 'Deletion request submitted. This will be reviewed by our team.',
      request: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating deletion request:', error);
    res.status(500).json({ error: 'Failed to submit deletion request' });
  }
});

// POST /api/gdpr/cancel-deletion - Cancel deletion request
router.post('/cancel-deletion/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      DELETE FROM gdpr_deletion_requests
      WHERE id = $1 AND user_id = $2 AND status = 'pending'
      RETURNING id
    `, [id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or cannot be cancelled' });
    }

    res.json({ ok: true, message: 'Deletion request cancelled' });
  } catch (error) {
    console.error('Error cancelling deletion request:', error);
    res.status(500).json({ error: 'Failed to cancel request' });
  }
});

// POST /api/gdpr/consent - Log consent change
router.post('/consent', authenticateToken, async (req, res) => {
  try {
    await ensureTables();
    const { consent_type, consented } = req.body;

    if (!consent_type || typeof consented !== 'boolean') {
      return res.status(400).json({ error: 'consent_type and consented are required' });
    }

    await db.query(`
      INSERT INTO consent_log (user_id, consent_type, consented, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      req.user.id,
      consent_type,
      consented,
      req.ip || req.headers['x-forwarded-for'],
      req.headers['user-agent'],
    ]);

    // Consent is now tracked in consent_log table
    res.json({ ok: true });
  } catch (error) {
    console.error('Error logging consent:', error);
    res.status(500).json({ error: 'Failed to log consent' });
  }
});

// GET /api/gdpr/my-data - Get summary of user's data (preview)
router.get('/my-data', authenticateToken, async (req, res) => {
  try {
    // Get user's data summary from fm_admin table
    const user = await db.query(`
      SELECT name, email, created_at, last_login_at
      FROM fm_admin WHERE id = $1
    `, [req.user.id]);

    // Count incidents related to user's company
    const incidentsCount = await db.query(`
      SELECT COUNT(*) FROM incident i
      JOIN building b ON i.building_id = b.id
      JOIN pm_company pm ON b.pm_company_id = pm.id
      WHERE pm.fm_company_id = $1
    `, [req.user.fm_company_id]).catch(() => ({ rows: [{ count: 0 }] }));

    res.json({
      user: user.rows[0],
      data_summary: {
        incidents_related: parseInt(incidentsCount.rows[0].count, 10),
      },
    });
  } catch (error) {
    console.error('Error fetching user data summary:', error);
    res.status(500).json({ error: 'Failed to fetch data summary' });
  }
});

// GET /api/gdpr/download-export/:id - Download own completed export file
// Authenticated + ownership-checked: only the fm_admin who requested the
// export (matched by gdpr_export_requests.user_id = req.user.id) can fetch
// it, and only once it's completed and not expired. This is the only way a
// GDPR export is ever reachable — the file lives outside the public
// /uploads static directory specifically so a URL alone can't leak PII.
router.get('/download-export/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, user_id, status, download_url, expires_at
       FROM gdpr_export_requests
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Export request not found' });
    }

    const exportRequest = result.rows[0];

    if (exportRequest.user_id !== req.user.id) {
      return res.status(403).json({ error: 'This export does not belong to you' });
    }

    if (exportRequest.status !== 'completed') {
      return res.status(400).json({ error: `Export is not ready (status: ${exportRequest.status})` });
    }

    if (exportRequest.expires_at && new Date(exportRequest.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This export link has expired. Please request a new export.' });
    }

    const filePath = path.join(GDPR_EXPORT_DIR, `${id}.json`);

    let fileContents;
    try {
      fileContents = await fs.readFile(filePath, 'utf-8');
    } catch (fileErr) {
      logger.error('GDPR export file missing on disk', { id, error: fileErr.message });
      return res.status(500).json({ error: 'Export file could not be found. Contact support.' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="my-data-export-${id}.json"`);
    res.send(fileContents);
  } catch (error) {
    logger.error('Error downloading GDPR export', { error: error.message });
    res.status(500).json({ error: 'Failed to download export' });
  }
});

// GET /api/gdpr/consent-status - Get user's current consent status
router.get('/consent-status', authenticateToken, async (req, res) => {
  try {
    // Get latest consent log entries for this user
    const consents = await db.query(`
      SELECT consent_type, consented
      FROM consent_log
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [req.user.id]).catch(() => ({ rows: [] }));

    // Build consent status from log
    const consentMap = {};
    for (const row of consents.rows) {
      if (!(row.consent_type in consentMap)) {
        consentMap[row.consent_type] = row.consented;
      }
    }

    res.json({
      marketing: consentMap.marketing || false,
      analytics: consentMap.analytics || false,
      data_sharing: consentMap.data_sharing || false,
    });
  } catch (error) {
    console.error('Error fetching consent status:', error);
    res.status(500).json({ error: 'Failed to fetch consent status' });
  }
});

export default router;
