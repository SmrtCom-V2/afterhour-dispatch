/**
 * Owner Visit Report
 * Submitted by the logged-in fm_admin after choosing to handle an incident
 * themselves (night_outcome = 'owner_on_site') instead of dispatching a
 * service provider. Closes the loop that sp_report closes for contractor
 * dispatches — otherwise "I'll go myself" left no record of what happened.
 */

import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { getStorageProvider } from '../providers/storage/index.js';

const router = Router();
router.use(authenticateToken);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

// GET /api/owner-visit-report/:incidentId — fetch existing report, if any
router.get('/:incidentId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ovr.id, ovr.description, ovr.resolved, ovr.submitted_at, fa.name as submitted_by,
              (SELECT json_agg(json_build_object('id', a.id, 'file_path', a.file_path))
               FROM owner_visit_report_attachment a WHERE a.owner_visit_report_id = ovr.id) as attachments
       FROM owner_visit_report ovr
       JOIN fm_admin fa ON ovr.fm_admin_id = fa.id
       JOIN incident i ON ovr.incident_id = i.id
       LEFT JOIN building b ON i.building_id = b.id
       LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
       WHERE ovr.incident_id = $1 AND pm.fm_company_id = $2`,
      [req.params.incidentId, req.user.fm_company_id],
    );
    res.json({ report: result.rows[0] || null });
  } catch (error) {
    logger.error('owner-visit-report GET error', { error: error.message });
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/owner-visit-report/:incidentId — submit the report
router.post('/:incidentId', upload.array('photos', 10), async (req, res) => {
  try {
    const { incidentId } = req.params;
    const { description, resolved } = req.body;
    const photos = req.files || [];

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Scope check: the incident must belong to this admin's company.
    const incidentCheck = await db.query(
      `SELECT i.id FROM incident i
       LEFT JOIN building b ON i.building_id = b.id
       LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
       WHERE i.id = $1 AND pm.fm_company_id = $2`,
      [incidentId, req.user.fm_company_id],
    );
    if (incidentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    const reportId = await db.transaction(async (client) => {
      const insertResult = await client.query(
        `INSERT INTO owner_visit_report (incident_id, fm_admin_id, description, resolved)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [incidentId, req.user.id, description, resolved !== 'false'],
      );
      const id = insertResult.rows[0].id;

      if (photos.length > 0) {
        const storage = await getStorageProvider();
        for (const photo of photos) {
          const filename = `owner-visit-reports/${incidentId}/${uuidv4()}-${photo.originalname}`;
          const uploadResult = await storage.upload(photo.buffer, filename, photo.mimetype);
          if (uploadResult.success) {
            await client.query(
              `INSERT INTO owner_visit_report_attachment (owner_visit_report_id, file_name, file_path, file_type, file_size)
               VALUES ($1, $2, $3, $4, $5)`,
              [id, photo.originalname, uploadResult.path, photo.mimetype, photo.size],
            );
          }
        }
      }

      await client.query(
        `INSERT INTO incident_timeline (incident_id, event_type, event_data)
         VALUES ($1, 'owner_visit_report.submitted', $2)`,
        [incidentId, JSON.stringify({ resolved: resolved !== 'false', photoCount: photos.length })],
      );

      return id;
    });

    logger.info('Owner visit report submitted', { incidentId, reportId, adminId: req.user.id });
    res.json({ success: true, reportId });
  } catch (error) {
    logger.error('owner-visit-report POST error', { error: error.message });
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

export default router;
