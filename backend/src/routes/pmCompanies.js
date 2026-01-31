/**
 * PM Companies Routes
 * CRUD for property management companies (logical entities)
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(authenticateToken);

// GET /api/pm-companies - List all PM companies for FM
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT pm.*,
              (SELECT COUNT(*) FROM building WHERE pm_company_id = pm.id) as building_count,
              (SELECT COUNT(*) FROM incident i
               JOIN building b ON i.building_id = b.id
               WHERE b.pm_company_id = pm.id
                 AND i.status NOT IN ('closed', 'sp_completed')) as open_incidents,
              (SELECT MAX(i.created_at) FROM incident i
               JOIN building b ON i.building_id = b.id
               WHERE b.pm_company_id = pm.id) as last_incident_at
       FROM pm_company pm
       WHERE pm.fm_company_id = $1
       ORDER BY pm.name`,
      [req.user.fm_company_id]
    );

    res.json({ pmCompanies: result.rows });
  } catch (error) {
    logger.error('Error fetching PM companies', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch PM companies' });
  }
});

// GET /api/pm-companies/:id - Get single PM company with buildings
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const pmResult = await db.query(
      'SELECT * FROM pm_company WHERE id = $1 AND fm_company_id = $2',
      [id, req.user.fm_company_id]
    );

    if (pmResult.rows.length === 0) {
      return res.status(404).json({ error: 'PM company not found' });
    }

    const buildingsResult = await db.query(
      'SELECT id, name, address, city FROM building WHERE pm_company_id = $1 ORDER BY name',
      [id]
    );

    res.json({
      pmCompany: pmResult.rows[0],
      buildings: buildingsResult.rows,
    });
  } catch (error) {
    logger.error('Error fetching PM company', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch PM company' });
  }
});

// POST /api/pm-companies - Create PM company
router.post('/', async (req, res) => {
  try {
    const {
      name,
      contactName,
      contactEmail,
      contactPhone,
      servicePhone,
      address,
      city,
      postalCode,
      country,
      notes,
      status,
      aiConfidenceThreshold,
      afterhoursStart,
      afterhoursEnd,
      sameHoursAllDays,
      afterhoursByDay,
      emergencyRules
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }

    const result = await db.query(
      `INSERT INTO pm_company (
        fm_company_id, name, contact_name, contact_email, contact_phone,
        service_phone, address, city, postal_code, country, notes, status,
        ai_confidence_threshold, afterhours_start, afterhours_end,
        same_hours_all_days, afterhours_by_day, emergency_rules
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        req.user.fm_company_id,
        name,
        contactName,
        contactEmail,
        contactPhone,
        servicePhone,
        address,
        city,
        postalCode,
        country || 'Germany',
        notes,
        status || 'active',
        aiConfidenceThreshold || 80,
        afterhoursStart || '18:00',
        afterhoursEnd || '07:00',
        sameHoursAllDays !== false,
        afterhoursByDay ? JSON.stringify(afterhoursByDay) : null,
        emergencyRules ? JSON.stringify(emergencyRules) : '{}'
      ]
    );

    logger.info('PM company created', { pmId: result.rows[0].id, name });

    res.status(201).json({ pmCompany: result.rows[0] });
  } catch (error) {
    logger.error('Error creating PM company', { error: error.message });
    res.status(500).json({ error: 'Failed to create PM company' });
  }
});

// PUT /api/pm-companies/:id - Update PM company
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      contactName,
      contactEmail,
      contactPhone,
      servicePhone,
      address,
      city,
      postalCode,
      country,
      notes,
      status,
      aiConfidenceThreshold,
      afterhoursStart,
      afterhoursEnd,
      sameHoursAllDays,
      afterhoursByDay,
      emergencyRules
    } = req.body;

    const result = await db.query(
      `UPDATE pm_company SET
         name = COALESCE($1, name),
         contact_name = COALESCE($2, contact_name),
         contact_email = COALESCE($3, contact_email),
         contact_phone = COALESCE($4, contact_phone),
         service_phone = COALESCE($5, service_phone),
         address = COALESCE($6, address),
         city = COALESCE($7, city),
         postal_code = COALESCE($8, postal_code),
         country = COALESCE($9, country),
         notes = COALESCE($10, notes),
         status = COALESCE($11, status),
         ai_confidence_threshold = COALESCE($12, ai_confidence_threshold),
         afterhours_start = COALESCE($13, afterhours_start),
         afterhours_end = COALESCE($14, afterhours_end),
         same_hours_all_days = COALESCE($15, same_hours_all_days),
         afterhours_by_day = COALESCE($16, afterhours_by_day),
         emergency_rules = COALESCE($17, emergency_rules)
       WHERE id = $18 AND fm_company_id = $19
       RETURNING *`,
      [
        name,
        contactName,
        contactEmail,
        contactPhone,
        servicePhone,
        address,
        city,
        postalCode,
        country,
        notes,
        status,
        aiConfidenceThreshold,
        afterhoursStart,
        afterhoursEnd,
        sameHoursAllDays,
        afterhoursByDay ? JSON.stringify(afterhoursByDay) : null,
        emergencyRules ? JSON.stringify(emergencyRules) : null,
        id,
        req.user.fm_company_id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PM company not found' });
    }

    logger.info('PM company updated', { pmId: id });

    res.json({ pmCompany: result.rows[0] });
  } catch (error) {
    logger.error('Error updating PM company', { error: error.message });
    res.status(500).json({ error: 'Failed to update PM company' });
  }
});

// DELETE /api/pm-companies/:id - Delete PM company
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if PM has buildings
    const buildingCount = await db.query(
      'SELECT COUNT(*) FROM building WHERE pm_company_id = $1',
      [id]
    );

    if (parseInt(buildingCount.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete PM company with existing buildings. Delete buildings first.',
      });
    }

    const result = await db.query(
      'DELETE FROM pm_company WHERE id = $1 AND fm_company_id = $2 RETURNING id',
      [id, req.user.fm_company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PM company not found' });
    }

    logger.info('PM company deleted', { pmId: id });

    res.json({ message: 'PM company deleted' });
  } catch (error) {
    logger.error('Error deleting PM company', { error: error.message });
    res.status(500).json({ error: 'Failed to delete PM company' });
  }
});

export default router;
