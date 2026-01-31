/**
 * Reports Routes
 * Morning reports management
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { generateMorningReport } from '../services/morningReport.js';
import { getEmailProvider } from '../providers/email/index.js';

const router = Router();

router.use(authenticateToken);

// GET /api/reports - List morning reports
router.get('/', async (req, res) => {
  try {
    const { pmCompanyId, dateFrom, dateTo, limit = 30, offset = 0 } = req.query;

    let query = `
      SELECT mr.*, pm.name as pm_company_name, pm.contact_email
      FROM morning_report mr
      JOIN pm_company pm ON mr.pm_company_id = pm.id
      WHERE pm.fm_company_id = $1
    `;
    const params = [req.user.fm_company_id];

    if (pmCompanyId) {
      query += ` AND mr.pm_company_id = $${params.length + 1}`;
      params.push(pmCompanyId);
    }

    if (dateFrom) {
      query += ` AND mr.report_date >= $${params.length + 1}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND mr.report_date <= $${params.length + 1}`;
      params.push(dateTo);
    }

    query += ` ORDER BY mr.report_date DESC, pm.name
               LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    res.json({ reports: result.rows });
  } catch (error) {
    logger.error('Error fetching reports', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// GET /api/reports/:id - Get single report
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT mr.*, pm.name as pm_company_name, pm.contact_email
       FROM morning_report mr
       JOIN pm_company pm ON mr.pm_company_id = pm.id
       WHERE mr.id = $1 AND pm.fm_company_id = $2`,
      [id, req.user.fm_company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Get incidents included in this report
    const incidentsResult = await db.query(
      `SELECT i.*, b.name as building_name, sp.company_name as sp_company_name
       FROM incident i
       LEFT JOIN building b ON i.building_id = b.id
       LEFT JOIN service_provider sp ON i.assigned_sp_id = sp.id
       WHERE i.id = ANY($1)
       ORDER BY i.created_at`,
      [result.rows[0].incidents_included]
    );

    res.json({
      report: result.rows[0],
      incidents: incidentsResult.rows,
    });
  } catch (error) {
    logger.error('Error fetching report', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// POST /api/reports/:id/resend - Resend report email
router.post('/:id/resend', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body; // Optional override email

    const result = await db.query(
      `SELECT mr.*, pm.name as pm_company_name, pm.contact_email
       FROM morning_report mr
       JOIN pm_company pm ON mr.pm_company_id = pm.id
       WHERE mr.id = $1 AND pm.fm_company_id = $2`,
      [id, req.user.fm_company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = result.rows[0];
    const targetEmail = email || report.contact_email;

    if (!targetEmail) {
      return res.status(400).json({ error: 'No email address available' });
    }

    // Regenerate and send
    const pdfBuffer = await generateMorningReport(report.pm_company_id, report.report_date);
    const emailProvider = await getEmailProvider();

    await emailProvider.sendMorningReport(
      targetEmail,
      report.pm_company_name,
      report.report_date,
      pdfBuffer
    );

    // Update sent info
    await db.query(
      `UPDATE morning_report SET sent_at = NOW(), sent_to = $1 WHERE id = $2`,
      [targetEmail, id]
    );

    logger.info('Report resent', { reportId: id, to: targetEmail });

    res.json({ message: 'Report sent successfully', sentTo: targetEmail });
  } catch (error) {
    logger.error('Error resending report', { error: error.message });
    res.status(500).json({ error: 'Failed to resend report' });
  }
});

// GET /api/reports/:id/pdf - Download report PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT mr.*, pm.name as pm_company_name
       FROM morning_report mr
       JOIN pm_company pm ON mr.pm_company_id = pm.id
       WHERE mr.id = $1 AND pm.fm_company_id = $2`,
      [id, req.user.fm_company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = result.rows[0];

    // Generate fresh PDF
    const pdfBuffer = await generateMorningReport(report.pm_company_id, report.report_date);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${report.report_date}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating PDF', { error: error.message });
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
