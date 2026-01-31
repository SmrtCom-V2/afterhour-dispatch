/**
 * SP Report Routes
 * One-time link system for service providers to submit reports
 * NO AUTHENTICATION - uses secure token
 */

import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { getStorageProvider } from '../providers/storage/index.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 10, // Max 10 photos
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// GET /api/sp-report/:token - Get report form (verify token)
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await db.query(
      `SELECT sr.*, sp.company_name as sp_name, sp.contact_name,
              i.issue_category, i.issue_description,
              b.name as building_name, b.address as building_address
       FROM sp_report sr
       JOIN service_provider sp ON sr.service_provider_id = sp.id
       JOIN incident i ON sr.incident_id = i.id
       LEFT JOIN building b ON i.building_id = b.id
       WHERE sr.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report link not found' });
    }

    const report = result.rows[0];

    // Check if already submitted
    if (report.status === 'submitted') {
      return res.status(400).json({
        error: 'Report already submitted',
        submittedAt: report.submitted_at,
      });
    }

    // Check if token expired
    if (new Date(report.token_expires_at) < new Date()) {
      return res.status(400).json({ error: 'Report link has expired' });
    }

    res.json({
      report: {
        id: report.id,
        spName: report.sp_name,
        contactName: report.contact_name,
        buildingName: report.building_name,
        buildingAddress: report.building_address,
        issueCategory: report.issue_category,
        issueDescription: report.issue_description,
        deadline: report.token_expires_at,
      },
    });
  } catch (error) {
    logger.error('Error fetching SP report', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// POST /api/sp-report/:token - Submit report
router.post('/:token', upload.array('photos', 10), async (req, res) => {
  try {
    const { token } = req.params;
    const { description, finishTime } = req.body;
    const photos = req.files || [];

    // Validate required fields
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    if (!finishTime) {
      return res.status(400).json({ error: 'Finish time is required' });
    }

    if (photos.length === 0) {
      return res.status(400).json({ error: 'At least one photo is required' });
    }

    // Verify token
    const reportResult = await db.query(
      `SELECT sr.*, i.id as incident_id
       FROM sp_report sr
       JOIN incident i ON sr.incident_id = i.id
       WHERE sr.token = $1`,
      [token]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report link not found' });
    }

    const report = reportResult.rows[0];

    if (report.status === 'submitted') {
      return res.status(400).json({ error: 'Report already submitted' });
    }

    if (new Date(report.token_expires_at) < new Date()) {
      return res.status(400).json({ error: 'Report link has expired' });
    }

    // Use transaction for atomicity
    await db.transaction(async (client) => {
      // Update report
      await client.query(
        `UPDATE sp_report SET
           description = $1,
           finish_time = $2,
           submitted_at = NOW(),
           status = 'submitted'
         WHERE id = $3`,
        [description, finishTime, report.id]
      );

      // Upload photos and save attachments
      const storage = await getStorageProvider();

      for (const photo of photos) {
        const filename = `sp-reports/${report.incident_id}/${uuidv4()}-${photo.originalname}`;
        const uploadResult = await storage.upload(photo.buffer, filename, photo.mimetype);

        if (uploadResult.success) {
          await client.query(
            `INSERT INTO sp_report_attachment (sp_report_id, file_name, file_path, file_type, file_size)
             VALUES ($1, $2, $3, $4, $5)`,
            [report.id, photo.originalname, uploadResult.path, photo.mimetype, photo.size]
          );
        }
      }

      // Update incident status
      await client.query(
        `UPDATE incident SET status = 'sp_completed' WHERE id = $1`,
        [report.incident_id]
      );

      // Add timeline entry
      await client.query(
        `INSERT INTO incident_timeline (incident_id, event_type, event_data)
         VALUES ($1, 'sp_report_submitted', $2)`,
        [report.incident_id, JSON.stringify({ reportId: report.id, photoCount: photos.length })]
      );
    });

    logger.info('SP report submitted', { reportId: report.id, photoCount: photos.length });

    res.json({ message: 'Report submitted successfully' });
  } catch (error) {
    logger.error('Error submitting SP report', { error: error.message });
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

export default router;
