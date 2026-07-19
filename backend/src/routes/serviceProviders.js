/**
 * Service Providers Routes
 * CRUD for service providers
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(authenticateToken);

// Valid trades
const VALID_TRADES = ['plumber', 'electrician', 'locksmith', 'hvac', 'general', 'other'];

// GET /api/service-providers - List all SPs for FM company
router.get('/', async (req, res) => {
  try {
    const { trade, status, pmCompanyId } = req.query;

    let query = `
      SELECT DISTINCT sp.*,
             (SELECT COUNT(*) FROM building_service_provider WHERE service_provider_id = sp.id) as building_count
      FROM service_provider sp
    `;

    // If filtering by PM, join through building_service_provider
    if (pmCompanyId) {
      query += `
        LEFT JOIN building_service_provider bsp ON sp.id = bsp.service_provider_id
        LEFT JOIN building b ON bsp.building_id = b.id
        WHERE sp.fm_company_id = $1 AND b.pm_company_id = $2
      `;
    } else {
      query += ` WHERE sp.fm_company_id = $1`;
    }

    const params = pmCompanyId ? [req.user.fm_company_id, pmCompanyId] : [req.user.fm_company_id];

    if (trade) {
      query += ` AND sp.trade = $${params.length + 1}`;
      params.push(trade);
    }

    if (status) {
      query += ` AND sp.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ' ORDER BY sp.trade, sp.company_name';

    const result = await db.query(query, params);

    res.json({ serviceProviders: result.rows });
  } catch (error) {
    logger.error('Error fetching service providers', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch service providers' });
  }
});

// GET /api/service-providers/:id - Get single SP with assigned buildings
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const spResult = await db.query(
      `SELECT * FROM service_provider WHERE id = $1 AND fm_company_id = $2`,
      [id, req.user.fm_company_id]
    );

    if (spResult.rows.length === 0) {
      return res.status(404).json({ error: 'Service provider not found' });
    }

    // Get assigned buildings
    const buildingsResult = await db.query(
      `SELECT b.id, b.name, b.address, bsp.priority
       FROM building b
       JOIN building_service_provider bsp ON b.id = bsp.building_id
       WHERE bsp.service_provider_id = $1
       ORDER BY bsp.priority`,
      [id]
    );

    res.json({
      serviceProvider: spResult.rows[0],
      assignedBuildings: buildingsResult.rows,
    });
  } catch (error) {
    logger.error('Error fetching service provider', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch service provider' });
  }
});

// POST /api/service-providers - Create SP
router.post('/', async (req, res) => {
  try {
    const { companyName, contactName, phone, email, trade, status, usageNote, available24h, availableFrom, availableTo } = req.body;

    if (!companyName || !phone || !trade) {
      return res.status(400).json({ error: 'Company name, phone, and trade required' });
    }

    if (!VALID_TRADES.includes(trade)) {
      return res.status(400).json({
        error: `Invalid trade. Must be one of: ${VALID_TRADES.join(', ')}`,
      });
    }

    const result = await db.query(
      `INSERT INTO service_provider
         (fm_company_id, company_name, contact_name, phone, email, trade, status,
          usage_note, available_24h, available_from, available_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        req.user.fm_company_id, companyName, contactName, phone, email, trade, status || 'active',
        usageNote || null, available24h !== false, availableFrom || null, availableTo || null,
      ]
    );

    logger.info('Service provider created', { spId: result.rows[0].id, companyName });

    res.status(201).json({ serviceProvider: result.rows[0] });
  } catch (error) {
    logger.error('Error creating service provider', { error: error.message });
    res.status(500).json({ error: 'Failed to create service provider' });
  }
});

// PUT /api/service-providers/:id - Update SP
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { companyName, contactName, phone, email, trade, status, usageNote, available24h, availableFrom, availableTo } = req.body;

    // Verify SP belongs to this FM
    const check = await db.query(
      'SELECT id FROM service_provider WHERE id = $1 AND fm_company_id = $2',
      [id, req.user.fm_company_id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Service provider not found' });
    }

    if (trade && !VALID_TRADES.includes(trade)) {
      return res.status(400).json({
        error: `Invalid trade. Must be one of: ${VALID_TRADES.join(', ')}`,
      });
    }

    const result = await db.query(
      `UPDATE service_provider SET
         company_name = COALESCE($1, company_name),
         contact_name = COALESCE($2, contact_name),
         phone = COALESCE($3, phone),
         email = COALESCE($4, email),
         trade = COALESCE($5, trade),
         status = COALESCE($6, status),
         usage_note = COALESCE($7, usage_note),
         available_24h = COALESCE($8, available_24h),
         available_from = $9,
         available_to = $10
       WHERE id = $11
       RETURNING *`,
      [
        companyName, contactName, phone, email, trade, status,
        usageNote, available24h, availableFrom || null, availableTo || null, id,
      ]
    );

    logger.info('Service provider updated', { spId: id });

    res.json({ serviceProvider: result.rows[0] });
  } catch (error) {
    logger.error('Error updating service provider', { error: error.message });
    res.status(500).json({ error: 'Failed to update service provider' });
  }
});

// DELETE /api/service-providers/:id - Delete SP
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify SP belongs to this FM
    const check = await db.query(
      'SELECT id FROM service_provider WHERE id = $1 AND fm_company_id = $2',
      [id, req.user.fm_company_id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Service provider not found' });
    }

    // Check if SP has active incidents
    const activeIncidents = await db.query(
      `SELECT COUNT(*) FROM incident WHERE assigned_sp_id = $1 AND status NOT IN ('closed', 'sp_completed')`,
      [id]
    );

    if (parseInt(activeIncidents.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete service provider with active incidents. Set status to paused instead.',
      });
    }

    await db.query('DELETE FROM service_provider WHERE id = $1', [id]);

    logger.info('Service provider deleted', { spId: id });

    res.json({ message: 'Service provider deleted' });
  } catch (error) {
    logger.error('Error deleting service provider', { error: error.message });
    res.status(500).json({ error: 'Failed to delete service provider' });
  }
});

// PUT /api/service-providers/:id/toggle-status - Toggle active/paused
router.put('/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE service_provider
       SET status = CASE WHEN status = 'active' THEN 'paused' ELSE 'active' END
       WHERE id = $1 AND fm_company_id = $2
       RETURNING *`,
      [id, req.user.fm_company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service provider not found' });
    }

    logger.info('Service provider status toggled', { spId: id, newStatus: result.rows[0].status });

    res.json({ serviceProvider: result.rows[0] });
  } catch (error) {
    logger.error('Error toggling SP status', { error: error.message });
    res.status(500).json({ error: 'Failed to toggle status' });
  }
});

export default router;
