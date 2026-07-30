/**
 * Super Admin GDPR Tools
 * Data privacy management, export, and deletion tools
 *
 * REBUILT 2026-07-29 against the real schema (fm_admin / tenant / fm_employee /
 * call / incident), replacing the earlier version that was written against a
 * hypothetical users/incidents/pm_companies schema and always returned 501.
 *
 * Subject model: `gdpr_deletion_requests.user_id` / `gdpr_export_requests.user_id`
 * point at `fm_admin.id` — the only login-capable identity in this system.
 * See backend/src/services/gdprExecution.js for the full anonymization/export
 * logic and the reasoning on what gets anonymized vs deleted vs retained.
 *
 * Safety: approval is the only action that touches real data, and it always
 * requires the caller to already have taken a fresh pg_dump backup — see
 * scripts/pre-gdpr-backup.js. The route itself does NOT take the backup
 * (that must happen from a shell with server access, verified, before this
 * endpoint is called) but it DOES refuse to run if the backup marker isn't
 * fresh, so a super admin can't accidentally skip the step.
 */

import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db/index.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';
import { writeAuditLog } from '../utils/saAudit.js';
import { logger } from '../utils/logger.js';
import { executeAnonymization, buildDataExport } from '../services/gdprExecution.js';
import { GDPR_EXPORT_DIR } from '../services/gdprExportStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_MARKER_PATH = path.join(__dirname, '../../.gdpr-backup-marker.json');
const BACKUP_FRESHNESS_MS = 30 * 60 * 1000; // backup must be <30 min old to proceed

const router = Router();

router.use(authenticateSuperAdmin);

/**
 * Confirms a pre-deletion backup marker was written recently by
 * scripts/pre-gdpr-backup.js. This is a soft safety net, not a cryptographic
 * guarantee — its purpose is to stop a super admin from approving a deletion
 * without having just run the backup step in this same operating session.
 */
async function assertRecentBackup() {
  let marker;
  try {
    const raw = await fs.readFile(BACKUP_MARKER_PATH, 'utf-8');
    marker = JSON.parse(raw);
  } catch {
    const err = new Error(
      'No GDPR pre-deletion backup marker found. Run scripts/pre-gdpr-backup.js on the server before approving any deletion.'
    );
    err.code = 'BACKUP_REQUIRED';
    throw err;
  }

  const age = Date.now() - new Date(marker.takenAt).getTime();
  if (age > BACKUP_FRESHNESS_MS) {
    const err = new Error(
      `Last GDPR backup is ${Math.round(age / 60000)} minutes old (marker: ${marker.file}). ` +
      `Re-run scripts/pre-gdpr-backup.js — backups older than 30 minutes are not trusted for a destructive run.`
    );
    err.code = 'BACKUP_STALE';
    throw err;
  }

  return marker;
}

// ============================================
// DELETION REQUESTS
// ============================================

// GET /sa/gdpr/deletion-requests - list all deletion requests
router.get('/deletion-requests', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE gdr.status = $1`;
    }

    // deadline_at/is_overdue are computed here (not stored columns) — GDPR
    // Art. 12(3) gives 72h for this specific flow (see CLAUDE.md), and the
    // deadline is fully derivable from created_at, so no migration needed.
    // Only pending/processing requests can be overdue; anything already
    // processed has a real processed_at to judge instead.
    const result = await db.query(
      `SELECT gdr.id, gdr.user_id, gdr.company_id, gdr.status, gdr.reason,
              gdr.created_at, gdr.processed_at, gdr.rejection_reason,
              gdr.created_at + INTERVAL '72 hours' AS deadline_at,
              (gdr.status IN ('pending', 'processing')
                AND gdr.created_at + INTERVAL '72 hours' < NOW()) AS is_overdue,
              fa.email AS admin_email, fa.name AS admin_name, fa.is_admin AS admin_is_owner,
              fc.name AS company_name
       FROM gdpr_deletion_requests gdr
       LEFT JOIN fm_admin fa ON fa.id = gdr.user_id
       LEFT JOIN fm_company fc ON fc.id = gdr.company_id
       ${where}
       ORDER BY gdr.created_at DESC
       LIMIT 200`,
      params
    );

    res.json({ requests: result.rows });
  } catch (error) {
    logger.error('Error listing GDPR deletion requests', { error: error.message });
    res.status(500).json({ error: 'Failed to list deletion requests' });
  }
});

// POST /sa/gdpr/deletion-requests/:id/approve - approve AND execute real anonymization
router.post('/deletion-requests/:id/approve', async (req, res) => {
  const { id } = req.params;

  try {
    const reqRow = await db.query(
      `SELECT id, user_id, company_id, status FROM gdpr_deletion_requests WHERE id = $1`,
      [id]
    );

    if (reqRow.rows.length === 0) {
      return res.status(404).json({ error: 'Deletion request not found' });
    }

    const request = reqRow.rows[0];

    if (request.status !== 'pending') {
      return res.status(400).json({
        error: `Request is already '${request.status}', cannot approve again`,
      });
    }

    // Hard safety gate: refuse to execute without a fresh, verified backup.
    let backupMarker;
    try {
      backupMarker = await assertRecentBackup();
    } catch (backupErr) {
      logger.error('GDPR deletion blocked — no fresh backup', { error: backupErr.message });
      return res.status(412).json({
        error: backupErr.message,
        code: backupErr.code || 'BACKUP_REQUIRED',
      });
    }

    const before = await db.query(
      `SELECT name, email, phone FROM fm_admin WHERE id = $1`,
      [request.user_id]
    );

    const summary = await executeAnonymization({ adminId: request.user_id });

    await db.query(
      `UPDATE gdpr_deletion_requests
       SET status = 'completed', processed_at = NOW()
       WHERE id = $1`,
      [id]
    );

    await writeAuditLog({
      actorAdminId: req.superAdmin.id,
      companyId: request.company_id,
      actionType: 'gdpr_deletion_approved_and_executed',
      ip: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      before: before.rows[0] || null,
      after: { anonymized: true },
      metadata: { request_id: id, backup_file: backupMarker.file, summary },
    });

    logger.info('GDPR deletion request approved and executed', {
      requestId: id,
      superAdmin: req.superAdmin.email,
      summary,
    });

    res.json({ ok: true, message: 'Deletion executed and request marked completed', summary });
  } catch (error) {
    logger.error('Error approving GDPR deletion request', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to execute deletion', detail: error.message });
  }
});

// POST /sa/gdpr/deletion-requests/:id/reject - reject with reason, no data touched
router.post('/deletion-requests/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Rejection reason is required' });
  }

  try {
    const result = await db.query(
      `UPDATE gdpr_deletion_requests
       SET status = 'rejected', processed_at = NOW(), rejection_reason = $2
       WHERE id = $1 AND status = 'pending'
       RETURNING id, company_id`,
      [id, reason]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending request not found' });
    }

    await writeAuditLog({
      actorAdminId: req.superAdmin.id,
      companyId: result.rows[0].company_id,
      actionType: 'gdpr_deletion_rejected',
      ip: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      metadata: { request_id: id, reason },
    });

    res.json({ ok: true, message: 'Deletion request rejected' });
  } catch (error) {
    logger.error('Error rejecting GDPR deletion request', { error: error.message });
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// ============================================
// EXPORT REQUESTS
// ============================================

// GET /sa/gdpr/export-requests - list all export requests
router.get('/export-requests', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE ger.status = $1`;
    }

    const result = await db.query(
      `SELECT ger.id, ger.user_id, ger.company_id, ger.status, ger.created_at,
              ger.processed_at, ger.completed_at, ger.download_url, ger.expires_at,
              fa.email AS admin_email, fa.name AS admin_name,
              fc.name AS company_name
       FROM gdpr_export_requests ger
       LEFT JOIN fm_admin fa ON fa.id = ger.user_id
       LEFT JOIN fm_company fc ON fc.id = ger.company_id
       ${where}
       ORDER BY ger.created_at DESC
       LIMIT 200`,
      params
    );

    res.json({ requests: result.rows });
  } catch (error) {
    logger.error('Error listing GDPR export requests', { error: error.message });
    res.status(500).json({ error: 'Failed to list export requests' });
  }
});

// POST /sa/gdpr/export-requests/:id/approve - generate the real export file
router.post('/export-requests/:id/approve', async (req, res) => {
  const { id } = req.params;

  try {
    const reqRow = await db.query(
      `SELECT id, user_id, company_id, status FROM gdpr_export_requests WHERE id = $1`,
      [id]
    );

    if (reqRow.rows.length === 0) {
      return res.status(404).json({ error: 'Export request not found' });
    }

    const request = reqRow.rows[0];

    if (!['pending', 'processing'].includes(request.status)) {
      return res.status(400).json({
        error: `Request is already '${request.status}', cannot approve again`,
      });
    }

    const exportData = await buildDataExport({ adminId: request.user_id });

    // Written to a PRIVATE directory, NOT backend/uploads (which is served
    // publicly via express.static — see index.js `/uploads`). PII must only
    // ever be reachable through the authenticated download route in
    // gdpr.js (GET /api/gdpr/download-export/:id), never by a guessable
    // static URL.
    await fs.mkdir(GDPR_EXPORT_DIR, { recursive: true });
    const filePath = path.join(GDPR_EXPORT_DIR, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');

    // download_url stores the authenticated API path, not a static file URL.
    const downloadUrl = `/api/gdpr/download-export/${id}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.query(
      `UPDATE gdpr_export_requests
       SET status = 'completed', processed_at = NOW(), completed_at = NOW(),
           download_url = $2, expires_at = $3
       WHERE id = $1`,
      [id, downloadUrl, expiresAt]
    );

    await writeAuditLog({
      actorAdminId: req.superAdmin.id,
      companyId: request.company_id,
      actionType: 'gdpr_export_generated',
      ip: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      metadata: { request_id: id, download_url: downloadUrl },
    });

    logger.info('GDPR export generated', { requestId: id, superAdmin: req.superAdmin.email });

    res.json({ ok: true, message: 'Export generated', download_url: downloadUrl, expires_at: expiresAt });
  } catch (error) {
    logger.error('Error generating GDPR export', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to generate export', detail: error.message });
  }
});

export default router;
