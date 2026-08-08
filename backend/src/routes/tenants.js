/**
 * Tenants Routes
 * CRUD for tenants (verification purposes only)
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { encryptPhone, decryptPhone, hashPhone } from '../utils/piiCrypto.js';

const router = Router();

router.use(authenticateToken);

// GET /api/tenants - List all tenants for FM company
router.get('/', async (req, res) => {
  try {
    const { buildingId, pmCompanyId, status } = req.query;

    let query = `
      SELECT t.*, b.name as building_name, b.address as building_address, pm.name as pm_company_name, pm.id as pm_company_id
      FROM tenant t
      JOIN building b ON t.building_id = b.id
      JOIN pm_company pm ON b.pm_company_id = pm.id
      WHERE pm.fm_company_id = $1
    `;
    const params = [req.user.fm_company_id];

    if (pmCompanyId) {
      query += ` AND pm.id = $${params.length + 1}`;
      params.push(pmCompanyId);
    }

    if (buildingId) {
      query += ` AND t.building_id = $${params.length + 1}`;
      params.push(buildingId);
    }

    if (status) {
      query += ` AND t.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ' ORDER BY b.name, t.unit, t.name';

    const result = await db.query(query, params);
    const tenants = result.rows.map((t) => ({ ...t, phone: decryptPhone(t.phone) }));

    res.json({ tenants });
  } catch (error) {
    logger.error('Error fetching tenants', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// GET /api/tenants/:id - Get single tenant
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT t.*, b.name as building_name, b.address as building_address
       FROM tenant t
       JOIN building b ON t.building_id = b.id
       JOIN pm_company pm ON b.pm_company_id = pm.id
       WHERE t.id = $1 AND pm.fm_company_id = $2`,
      [id, req.user.fm_company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({ tenant: { ...result.rows[0], phone: decryptPhone(result.rows[0].phone) } });
  } catch (error) {
    logger.error('Error fetching tenant', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

// POST /api/tenants - Create tenant
router.post('/', async (req, res) => {
  try {
    const { buildingId, name, phone, unit, status } = req.body;

    if (!buildingId || !name || !phone) {
      return res.status(400).json({ error: 'Building ID, name, and phone required' });
    }

    // Verify building belongs to this FM
    const buildingCheck = await db.query(
      `SELECT b.id FROM building b
       JOIN pm_company pm ON b.pm_company_id = pm.id
       WHERE b.id = $1 AND pm.fm_company_id = $2`,
      [buildingId, req.user.fm_company_id]
    );

    if (buildingCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Building not found or not authorized' });
    }

    const result = await db.query(
      `INSERT INTO tenant (building_id, name, phone, phone_hash, unit, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [buildingId, name, encryptPhone(phone), hashPhone(phone), unit, status || 'active']
    );

    logger.info('Tenant created', { tenantId: result.rows[0].id, buildingId });

    res.status(201).json({ tenant: { ...result.rows[0], phone: decryptPhone(result.rows[0].phone) } });
  } catch (error) {
    logger.error('Error creating tenant', { error: error.message });
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// PUT /api/tenants/:id - Update tenant
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, unit, status } = req.body;

    // Verify tenant belongs to this FM
    const check = await db.query(
      `SELECT t.id FROM tenant t
       JOIN building b ON t.building_id = b.id
       JOIN pm_company pm ON b.pm_company_id = pm.id
       WHERE t.id = $1 AND pm.fm_company_id = $2`,
      [id, req.user.fm_company_id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const result = await db.query(
      `UPDATE tenant SET
         name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         phone_hash = COALESCE($3, phone_hash),
         unit = COALESCE($4, unit),
         status = COALESCE($5, status)
       WHERE id = $6
       RETURNING *`,
      [name, encryptPhone(phone), hashPhone(phone), unit, status, id]
    );

    logger.info('Tenant updated', { tenantId: id });

    res.json({ tenant: { ...result.rows[0], phone: decryptPhone(result.rows[0].phone) } });
  } catch (error) {
    logger.error('Error updating tenant', { error: error.message });
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// DELETE /api/tenants/:id - Deactivate tenant (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify tenant belongs to this FM
    const check = await db.query(
      `SELECT t.id FROM tenant t
       JOIN building b ON t.building_id = b.id
       JOIN pm_company pm ON b.pm_company_id = pm.id
       WHERE t.id = $1 AND pm.fm_company_id = $2`,
      [id, req.user.fm_company_id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Soft delete - set status to inactive
    await db.query(
      "UPDATE tenant SET status = 'inactive' WHERE id = $1",
      [id]
    );

    logger.info('Tenant deactivated', { tenantId: id });

    res.json({ message: 'Tenant deactivated' });
  } catch (error) {
    logger.error('Error deactivating tenant', { error: error.message });
    res.status(500).json({ error: 'Failed to deactivate tenant' });
  }
});

// POST /api/tenants/bulk - Bulk import tenants
router.post('/bulk', async (req, res) => {
  try {
    const { buildingId, tenants } = req.body;

    if (!buildingId || !Array.isArray(tenants) || tenants.length === 0) {
      return res.status(400).json({ error: 'Building ID and tenants array required' });
    }

    // Verify building belongs to this FM
    const buildingCheck = await db.query(
      `SELECT b.id FROM building b
       JOIN pm_company pm ON b.pm_company_id = pm.id
       WHERE b.id = $1 AND pm.fm_company_id = $2`,
      [buildingId, req.user.fm_company_id]
    );

    if (buildingCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Building not found or not authorized' });
    }

    const inserted = [];
    const errors = [];

    for (const tenant of tenants) {
      if (!tenant.name || !tenant.phone) {
        errors.push({ tenant, error: 'Name and phone required' });
        continue;
      }

      try {
        const result = await db.query(
          `INSERT INTO tenant (building_id, name, phone, phone_hash, unit, status)
           VALUES ($1, $2, $3, $4, $5, 'active')
           RETURNING *`,
          [buildingId, tenant.name, encryptPhone(tenant.phone), hashPhone(tenant.phone), tenant.unit]
        );
        inserted.push({ ...result.rows[0], phone: decryptPhone(result.rows[0].phone) });
      } catch (err) {
        errors.push({ tenant, error: err.message });
      }
    }

    logger.info('Bulk tenant import', { buildingId, inserted: inserted.length, errors: errors.length });

    res.status(201).json({ inserted, errors });
  } catch (error) {
    logger.error('Error bulk importing tenants', { error: error.message });
    res.status(500).json({ error: 'Failed to import tenants' });
  }
});

export default router;
