/**
 * Incidents Routes
 * View and manage incidents
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(authenticateToken);

// GET /api/incidents - List incidents for FM company
router.get('/', async (req, res) => {
  try {
    const { status, buildingId, pmCompanyId, isEmergency, dateFrom, dateTo, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT i.*,
             b.name as building_name,
             b.address as building_address,
             pm.name as pm_company_name,
             pm.id as pm_company_id,
             sp.company_name as sp_company_name,
             (SELECT COUNT(*) FROM sp_report WHERE incident_id = i.id AND status = 'missing') as missing_report
      FROM incident i
      LEFT JOIN building b ON i.building_id = b.id
      LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
      LEFT JOIN service_provider sp ON i.assigned_sp_id = sp.id
      LEFT JOIN call c ON i.call_id = c.id
      WHERE (pm.fm_company_id = $1 OR c.fm_company_id = $1)
    `;
    const params = [req.user.fm_company_id];

    if (pmCompanyId) {
      query += ` AND pm.id = $${params.length + 1}`;
      params.push(pmCompanyId);
    }

    if (status) {
      query += ` AND i.status = $${params.length + 1}`;
      params.push(status);
    }

    if (buildingId) {
      query += ` AND i.building_id = $${params.length + 1}`;
      params.push(buildingId);
    }

    if (isEmergency !== undefined) {
      query += ` AND i.is_emergency = $${params.length + 1}`;
      params.push(isEmergency === 'true');
    }

    if (dateFrom) {
      query += ` AND i.created_at >= $${params.length + 1}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND i.created_at <= $${params.length + 1}`;
      params.push(dateTo);
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) FROM incident i
      LEFT JOIN building b ON i.building_id = b.id
      LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
      LEFT JOIN call c ON i.call_id = c.id
      WHERE (pm.fm_company_id = $1 OR c.fm_company_id = $1)
    `;
    const countParams = [req.user.fm_company_id];

    if (pmCompanyId) {
      countQuery += ` AND pm.id = $${countParams.length + 1}`;
      countParams.push(pmCompanyId);
    }

    if (status) {
      countQuery += ` AND i.status = $${countParams.length + 1}`;
      countParams.push(status);
    }

    const countResult = await db.query(countQuery, countParams);

    res.json({
      incidents: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error('Error fetching incidents', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// GET /api/incidents/stats - Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const { pmCompanyId } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let pmFilter = '';
    const params = [req.user.fm_company_id, today.toISOString()];

    if (pmCompanyId) {
      pmFilter = ' AND pm.id = $3';
      params.push(pmCompanyId);
    }

    const stats = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM incident i
          LEFT JOIN building b ON i.building_id = b.id
          LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
          LEFT JOIN call c ON i.call_id = c.id
          WHERE (pm.fm_company_id = $1 OR c.fm_company_id = $1)
            AND i.status NOT IN ('closed', 'sp_completed')${pmFilter}) as open_incidents,

         (SELECT COUNT(*) FROM call c2
          LEFT JOIN incident i2 ON i2.call_id = c2.id
          LEFT JOIN building b2 ON i2.building_id = b2.id
          LEFT JOIN pm_company pm2 ON b2.pm_company_id = pm2.id
          WHERE c2.fm_company_id = $1 AND c2.created_at >= $2${pmCompanyId ? ' AND pm2.id = $3' : ''}) as tonight_calls,

         (SELECT COUNT(*) FROM incident i
          LEFT JOIN building b ON i.building_id = b.id
          LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
          WHERE pm.fm_company_id = $1
            AND i.status IN ('sp_dispatched', 'sp_accepted')${pmFilter}) as sp_pending,

         (SELECT COUNT(*) FROM sp_report sr
          JOIN incident i ON sr.incident_id = i.id
          LEFT JOIN building b ON i.building_id = b.id
          LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
          WHERE pm.fm_company_id = $1 AND sr.status = 'missing'${pmFilter}) as missing_reports`,
      params
    );

    res.json({ stats: stats.rows[0] });
  } catch (error) {
    logger.error('Error fetching incident stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/incidents/:id - Get single incident with full details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get incident
    const incidentResult = await db.query(
      `SELECT i.*,
              b.name as building_name, b.address as building_address,
              sp.company_name as sp_company_name, sp.phone as sp_phone,
              t.name as tenant_name, t.phone as tenant_phone, t.unit as tenant_unit
       FROM incident i
       LEFT JOIN building b ON i.building_id = b.id
       LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
       LEFT JOIN service_provider sp ON i.assigned_sp_id = sp.id
       LEFT JOIN tenant t ON i.tenant_id = t.id
       LEFT JOIN call c ON i.call_id = c.id
       WHERE i.id = $1 AND (pm.fm_company_id = $2 OR c.fm_company_id = $2)`,
      [id, req.user.fm_company_id]
    );

    if (incidentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Get timeline
    const timelineResult = await db.query(
      `SELECT * FROM incident_timeline
       WHERE incident_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    // Get dispatch attempts
    const dispatchResult = await db.query(
      `SELECT da.*, sp.company_name, sp.phone as sp_phone
       FROM dispatch_attempt da
       JOIN service_provider sp ON da.service_provider_id = sp.id
       WHERE da.incident_id = $1
       ORDER BY da.attempt_number`,
      [id]
    );

    // Get SP report if exists
    const reportResult = await db.query(
      `SELECT sr.*,
              (SELECT json_agg(json_build_object('id', sra.id, 'file_name', sra.file_name, 'file_path', sra.file_path))
               FROM sp_report_attachment sra WHERE sra.sp_report_id = sr.id) as attachments
       FROM sp_report sr
       WHERE sr.incident_id = $1`,
      [id]
    );

    res.json({
      incident: incidentResult.rows[0],
      timeline: timelineResult.rows,
      dispatchAttempts: dispatchResult.rows,
      spReport: reportResult.rows[0] || null,
    });
  } catch (error) {
    logger.error('Error fetching incident', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

// PUT /api/incidents/:id/close - Close incident manually
router.put('/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await db.query(
      `UPDATE incident SET status = 'closed'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Add timeline entry
    await db.query(
      `INSERT INTO incident_timeline (incident_id, event_type, event_data)
       VALUES ($1, 'manually_closed', $2)`,
      [id, JSON.stringify({ reason, closed_by: req.user.email })]
    );

    logger.info('Incident closed manually', { incidentId: id, by: req.user.email });

    res.json({ incident: result.rows[0] });
  } catch (error) {
    logger.error('Error closing incident', { error: error.message });
    res.status(500).json({ error: 'Failed to close incident' });
  }
});

export default router;
