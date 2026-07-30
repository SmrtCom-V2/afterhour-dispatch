/**
 * Buildings Routes
 * CRUD for buildings under FM company
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/buildings - List all buildings for FM company
router.get('/', async (req, res) => {
  try {
    const { pmCompanyId } = req.query;

    let query = `
      SELECT b.*, pm.name as pm_company_name, pm.contact_email as pm_email,
              (SELECT COUNT(*) FROM building_service_provider WHERE building_id = b.id) as sp_count,
              (SELECT COUNT(*) FROM tenant WHERE building_id = b.id AND status = 'active') as tenant_count
       FROM building b
       JOIN pm_company pm ON b.pm_company_id = pm.id
       WHERE pm.fm_company_id = $1
    `;
    const params = [req.user.fm_company_id];

    if (pmCompanyId) {
      query += ` AND pm.id = $${params.length + 1}`;
      params.push(pmCompanyId);
    }

    query += ' ORDER BY pm.name, b.name';

    const result = await db.query(query, params);

    res.json({ buildings: result.rows });
  } catch (error) {
    logger.error('Error fetching buildings', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch buildings' });
  }
});

// GET /api/buildings/:id - Get single building with details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get building with PM info
    const buildingResult = await db.query(
      `SELECT b.*, pm.name as pm_company_name, pm.contact_email as pm_email, pm.id as pm_company_id
       FROM building b
       JOIN pm_company pm ON b.pm_company_id = pm.id
       WHERE b.id = $1 AND pm.fm_company_id = $2`,
      [id, req.user.fm_company_id]
    );

    if (buildingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Building not found' });
    }

    // Get assigned SPs
    const spsResult = await db.query(
      `SELECT sp.*, bsp.priority
       FROM service_provider sp
       JOIN building_service_provider bsp ON sp.id = bsp.service_provider_id
       WHERE bsp.building_id = $1
       ORDER BY sp.trade, bsp.priority`,
      [id]
    );

    // Get tenants
    const tenantsResult = await db.query(
      `SELECT id, name, phone, unit, status
       FROM tenant
       WHERE building_id = $1
       ORDER BY unit, name`,
      [id]
    );

    res.json({
      building: buildingResult.rows[0],
      serviceProviders: spsResult.rows,
      tenants: tenantsResult.rows,
    });
  } catch (error) {
    logger.error('Error fetching building', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch building' });
  }
});

// POST /api/buildings - Create building
router.post('/', async (req, res) => {
  try {
    const {
      pmCompanyId,
      name,
      address,
      city,
      postalCode,
      country,
      buildingType,
      totalUnits,
      totalFloors,
      hasBasement,
      basementFloors,
      hasPenthouse,
      numEntrances,
      entranceNames,
      unitsPerFloor,
      unitNumberingFormat,
      hasElevator,
      numElevators,
      parkingType,
      parkingSpaces,
      keySafeLocation,
      keySafeCode,
      gateCode,
      mainEntranceCode,
      waterShutoffLocation,
      gasShutoffLocation,
      electricShutoffLocation,
      specialAccessInstructions,
      janitorName,
      janitorPhone,
      janitorEmail,
      emergencyContactName,
      emergencyContactPhone,
      specialInstructions,
      knownIssues,
      notes,
      status
    } = req.body;

    if (!pmCompanyId || !address) {
      return res.status(400).json({ error: 'PM company and address required' });
    }

    // Verify PM company belongs to this FM
    const pmCheck = await db.query(
      'SELECT id FROM pm_company WHERE id = $1 AND fm_company_id = $2',
      [pmCompanyId, req.user.fm_company_id]
    );

    if (pmCheck.rows.length === 0) {
      return res.status(403).json({ error: 'PM company not found or not authorized' });
    }

    const result = await db.query(
      `INSERT INTO building (
        pm_company_id, name, address, city, postal_code, country,
        building_type, total_units, total_floors, has_basement, basement_floors,
        has_penthouse, num_entrances, entrance_names, units_per_floor, unit_numbering_format,
        has_elevator, num_elevators, parking_type, parking_spaces,
        key_safe_location, key_safe_code, gate_code, main_entrance_code,
        water_shutoff_location, gas_shutoff_location, electric_shutoff_location,
        special_access_instructions, janitor_name, janitor_phone, janitor_email,
        emergency_contact_name, emergency_contact_phone, special_instructions,
        known_issues, notes, status
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37)
       RETURNING *`,
      [
        pmCompanyId,
        name || address,
        address,
        city,
        postalCode,
        country || 'Germany',
        buildingType || 'residential',
        totalUnits || 0,
        totalFloors || 1,
        hasBasement || false,
        basementFloors || 0,
        hasPenthouse || false,
        numEntrances || 1,
        entranceNames,
        unitsPerFloor,
        unitNumberingFormat,
        hasElevator || false,
        numElevators || 0,
        parkingType,
        parkingSpaces,
        keySafeLocation,
        keySafeCode,
        gateCode,
        mainEntranceCode,
        waterShutoffLocation,
        gasShutoffLocation,
        electricShutoffLocation,
        specialAccessInstructions,
        janitorName,
        janitorPhone,
        janitorEmail,
        emergencyContactName,
        emergencyContactPhone,
        specialInstructions,
        knownIssues,
        notes,
        status || 'active'
      ]
    );

    logger.info('Building created', { buildingId: result.rows[0].id, name: name || address });

    res.status(201).json({ building: result.rows[0] });
  } catch (error) {
    logger.error('Error creating building', { error: error.message });
    res.status(500).json({ error: 'Failed to create building' });
  }
});

// POST /api/buildings/bulk - Bulk import buildings (CSV/Excel upload flow)
router.post('/bulk', async (req, res) => {
  try {
    const { pmCompanyId, buildings } = req.body;

    if (!pmCompanyId || !Array.isArray(buildings) || buildings.length === 0) {
      return res.status(400).json({ error: 'PM company ID and buildings array required' });
    }

    // Verify PM company belongs to this FM
    const pmCheck = await db.query(
      'SELECT id FROM pm_company WHERE id = $1 AND fm_company_id = $2',
      [pmCompanyId, req.user.fm_company_id]
    );

    if (pmCheck.rows.length === 0) {
      return res.status(403).json({ error: 'PM company not found or not authorized' });
    }

    const inserted = [];
    const errors = [];

    for (const b of buildings) {
      if (!b.address) {
        errors.push({ building: b, error: 'Address required' });
        continue;
      }

      try {
        const result = await db.query(
          `INSERT INTO building (
            pm_company_id, name, address, city, postal_code, country,
            building_type, total_units, status
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
           RETURNING *`,
          [
            pmCompanyId,
            b.name || b.address,
            b.address,
            b.city || null,
            b.postalCode || null,
            b.country || 'Germany',
            b.buildingType || 'residential',
            b.totalUnits || 0,
          ]
        );
        inserted.push(result.rows[0]);
      } catch (err) {
        errors.push({ building: b, error: err.message });
      }
    }

    logger.info('Bulk building import', { pmCompanyId, inserted: inserted.length, errors: errors.length });

    res.status(201).json({ inserted, errors });
  } catch (error) {
    logger.error('Error bulk importing buildings', { error: error.message });
    res.status(500).json({ error: 'Failed to import buildings' });
  }
});

// PUT /api/buildings/:id - Update building
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      address,
      city,
      postalCode,
      country,
      buildingType,
      totalUnits,
      totalFloors,
      hasBasement,
      basementFloors,
      hasPenthouse,
      numEntrances,
      entranceNames,
      unitsPerFloor,
      unitNumberingFormat,
      hasElevator,
      numElevators,
      parkingType,
      parkingSpaces,
      keySafeLocation,
      keySafeCode,
      gateCode,
      mainEntranceCode,
      waterShutoffLocation,
      gasShutoffLocation,
      electricShutoffLocation,
      specialAccessInstructions,
      janitorName,
      janitorPhone,
      janitorEmail,
      emergencyContactName,
      emergencyContactPhone,
      specialInstructions,
      knownIssues,
      notes,
      status
    } = req.body;

    // Verify building belongs to this FM
    const check = await db.query(
      `SELECT b.id FROM building b
       JOIN pm_company pm ON b.pm_company_id = pm.id
       WHERE b.id = $1 AND pm.fm_company_id = $2`,
      [id, req.user.fm_company_id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Building not found' });
    }

    const result = await db.query(
      `UPDATE building SET
         name = COALESCE($1, name),
         address = COALESCE($2, address),
         city = COALESCE($3, city),
         postal_code = COALESCE($4, postal_code),
         country = COALESCE($5, country),
         building_type = COALESCE($6, building_type),
         total_units = COALESCE($7, total_units),
         total_floors = COALESCE($8, total_floors),
         has_basement = COALESCE($9, has_basement),
         basement_floors = COALESCE($10, basement_floors),
         has_penthouse = COALESCE($11, has_penthouse),
         num_entrances = COALESCE($12, num_entrances),
         entrance_names = COALESCE($13, entrance_names),
         units_per_floor = COALESCE($14, units_per_floor),
         unit_numbering_format = COALESCE($15, unit_numbering_format),
         has_elevator = COALESCE($16, has_elevator),
         num_elevators = COALESCE($17, num_elevators),
         parking_type = COALESCE($18, parking_type),
         parking_spaces = COALESCE($19, parking_spaces),
         key_safe_location = COALESCE($20, key_safe_location),
         key_safe_code = COALESCE($21, key_safe_code),
         gate_code = COALESCE($22, gate_code),
         main_entrance_code = COALESCE($23, main_entrance_code),
         water_shutoff_location = COALESCE($24, water_shutoff_location),
         gas_shutoff_location = COALESCE($25, gas_shutoff_location),
         electric_shutoff_location = COALESCE($26, electric_shutoff_location),
         special_access_instructions = COALESCE($27, special_access_instructions),
         janitor_name = COALESCE($28, janitor_name),
         janitor_phone = COALESCE($29, janitor_phone),
         janitor_email = COALESCE($30, janitor_email),
         emergency_contact_name = COALESCE($31, emergency_contact_name),
         emergency_contact_phone = COALESCE($32, emergency_contact_phone),
         special_instructions = COALESCE($33, special_instructions),
         known_issues = COALESCE($34, known_issues),
         notes = COALESCE($35, notes),
         status = COALESCE($36, status)
       WHERE id = $37
       RETURNING *`,
      [
        name, address, city, postalCode, country,
        buildingType, totalUnits, totalFloors, hasBasement, basementFloors,
        hasPenthouse, numEntrances, entranceNames, unitsPerFloor, unitNumberingFormat,
        hasElevator, numElevators, parkingType, parkingSpaces,
        keySafeLocation, keySafeCode, gateCode, mainEntranceCode,
        waterShutoffLocation, gasShutoffLocation, electricShutoffLocation,
        specialAccessInstructions, janitorName, janitorPhone, janitorEmail,
        emergencyContactName, emergencyContactPhone, specialInstructions,
        knownIssues, notes, status, id
      ]
    );

    logger.info('Building updated', { buildingId: id });

    res.json({ building: result.rows[0] });
  } catch (error) {
    logger.error('Error updating building', { error: error.message });
    res.status(500).json({ error: 'Failed to update building' });
  }
});

// DELETE /api/buildings/:id - Delete building
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify building belongs to this FM
    const check = await db.query(
      `SELECT b.id FROM building b
       JOIN pm_company pm ON b.pm_company_id = pm.id
       WHERE b.id = $1 AND pm.fm_company_id = $2`,
      [id, req.user.fm_company_id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Building not found' });
    }

    await db.query('DELETE FROM building WHERE id = $1', [id]);

    logger.info('Building deleted', { buildingId: id });

    res.json({ message: 'Building deleted' });
  } catch (error) {
    logger.error('Error deleting building', { error: error.message });
    res.status(500).json({ error: 'Failed to delete building' });
  }
});

// POST /api/buildings/:id/service-providers - Assign SP to building
router.post('/:id/service-providers', async (req, res) => {
  try {
    const { id } = req.params;
    const { serviceProviderId, priority } = req.body;

    if (!serviceProviderId) {
      return res.status(400).json({ error: 'Service provider ID required' });
    }

    // Verify building and SP belong to this FM
    const checks = await Promise.all([
      db.query(
        `SELECT b.id FROM building b
         JOIN pm_company pm ON b.pm_company_id = pm.id
         WHERE b.id = $1 AND pm.fm_company_id = $2`,
        [id, req.user.fm_company_id]
      ),
      db.query(
        'SELECT id FROM service_provider WHERE id = $1 AND fm_company_id = $2',
        [serviceProviderId, req.user.fm_company_id]
      ),
    ]);

    if (checks[0].rows.length === 0) {
      return res.status(404).json({ error: 'Building not found' });
    }
    if (checks[1].rows.length === 0) {
      return res.status(404).json({ error: 'Service provider not found' });
    }

    const result = await db.query(
      `INSERT INTO building_service_provider (building_id, service_provider_id, priority)
       VALUES ($1, $2, $3)
       ON CONFLICT (building_id, service_provider_id) DO UPDATE SET priority = $3
       RETURNING *`,
      [id, serviceProviderId, priority || 1]
    );

    logger.info('SP assigned to building', { buildingId: id, serviceProviderId });

    res.status(201).json({ assignment: result.rows[0] });
  } catch (error) {
    logger.error('Error assigning SP', { error: error.message });
    res.status(500).json({ error: 'Failed to assign service provider' });
  }
});

// DELETE /api/buildings/:id/service-providers/:spId - Remove SP from building
router.delete('/:id/service-providers/:spId', async (req, res) => {
  try {
    const { id, spId } = req.params;

    // Scope folded into the DELETE itself (not a separate check-then-write)
    // so there's no gap where an unscoped query could ever run — building_id
    // must belong to this FM company via pm_company for any row to match.
    const result = await db.query(
      `DELETE FROM building_service_provider
       WHERE building_id = $1 AND service_provider_id = $2
         AND building_id IN (
           SELECT b.id FROM building b
           JOIN pm_company pm ON b.pm_company_id = pm.id
           WHERE pm.fm_company_id = $3
         )`,
      [id, spId, req.user.fm_company_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    logger.info('SP removed from building', { buildingId: id, serviceProviderId: spId });

    res.json({ message: 'Service provider removed from building' });
  } catch (error) {
    logger.error('Error removing SP', { error: error.message });
    res.status(500).json({ error: 'Failed to remove service provider' });
  }
});

export default router;
