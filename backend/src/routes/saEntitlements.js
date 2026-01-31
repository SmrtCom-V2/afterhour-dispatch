/**
 * Super Admin Entitlements Routes
 * Endpoints for managing company plans and addons
 *
 * Part of A-Z Delivery Spec: Super Admin Entitlements + Customer Plan & Add-Ons
 */

import { Router } from 'express';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';
import { entitlementService } from '../services/EntitlementService.js';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All routes require super admin authentication
router.use(authenticateSuperAdmin);

/**
 * GET /sa/entitlements/packages
 * Get all packages (for plan selector dropdown)
 */
router.get('/packages', async (req, res) => {
  try {
    const packages = await entitlementService.getAllPackages();
    res.json({ packages });
  } catch (error) {
    logger.error('Failed to fetch packages', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

/**
 * GET /sa/entitlements/features
 * Get all features (for feature catalog)
 */
router.get('/features', async (req, res) => {
  try {
    const features = await entitlementService.getAllFeatures();
    res.json({ features });
  } catch (error) {
    logger.error('Failed to fetch features', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch features' });
  }
});

/**
 * GET /sa/companies/:companyId/billing-entitlements
 * Get full billing/entitlements view for a company
 */
router.get('/companies/:companyId/billing-entitlements', async (req, res) => {
  try {
    const { companyId } = req.params;

    // Validate company exists
    const companyCheck = await db.query(
      'SELECT id FROM fm_company WHERE id = $1',
      [companyId]
    );

    if (companyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const summary = await entitlementService.getCompanyBillingSummary(companyId);
    res.json(summary);
  } catch (error) {
    logger.error('Failed to fetch billing entitlements', {
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to fetch billing entitlements' });
  }
});

/**
 * PUT /sa/companies/:companyId/plan
 * Change company's plan
 */
router.put('/companies/:companyId/plan', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { package_id } = req.body;

    if (!package_id) {
      return res.status(400).json({ error: 'package_id required' });
    }

    // Validate company exists
    const companyCheck = await db.query(
      'SELECT id, name FROM fm_company WHERE id = $1',
      [companyId]
    );

    if (companyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const result = await entitlementService.changeCompanyPlan(
      companyId,
      package_id,
      req.superAdmin.id,
      'super_admin'
    );

    logger.info('SA changed company plan', {
      companyId,
      companyName: companyCheck.rows[0].name,
      newPackageId: package_id,
      actorId: req.superAdmin.id,
      actorEmail: req.superAdmin.email
    });

    res.json({
      success: true,
      entitlements: result
    });
  } catch (error) {
    logger.error('Failed to change company plan', {
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /sa/companies/:companyId/addons
 * Toggle addon for company
 */
router.post('/companies/:companyId/addons', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { feature_id, enable, source } = req.body;

    if (!feature_id || typeof enable !== 'boolean') {
      return res.status(400).json({
        error: 'feature_id (string) and enable (boolean) required'
      });
    }

    // Validate company exists
    const companyCheck = await db.query(
      'SELECT id, name FROM fm_company WHERE id = $1',
      [companyId]
    );

    if (companyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const result = await entitlementService.toggleAddon(
      companyId,
      feature_id,
      enable,
      req.superAdmin.id,
      source || 'manual_override'
    );

    logger.info('SA toggled addon', {
      companyId,
      companyName: companyCheck.rows[0].name,
      featureId: feature_id,
      enable,
      actorId: req.superAdmin.id,
      actorEmail: req.superAdmin.email
    });

    res.json({
      success: true,
      entitlements: result
    });
  } catch (error) {
    logger.error('Failed to toggle addon', {
      error: error.message,
      companyId: req.params.companyId,
      featureId: req.body?.feature_id
    });
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /sa/companies/:companyId/addons/bulk
 * Enable multiple addons at once (useful for enabling with dependencies)
 */
router.post('/companies/:companyId/addons/bulk', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { feature_ids, enable, source } = req.body;

    if (!Array.isArray(feature_ids) || feature_ids.length === 0 || typeof enable !== 'boolean') {
      return res.status(400).json({
        error: 'feature_ids (array) and enable (boolean) required'
      });
    }

    // Validate company exists
    const companyCheck = await db.query(
      'SELECT id, name FROM fm_company WHERE id = $1',
      [companyId]
    );

    if (companyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Process in order (dependencies first when enabling)
    const results = [];
    const errors = [];

    for (const featureId of feature_ids) {
      try {
        await entitlementService.toggleAddon(
          companyId,
          featureId,
          enable,
          req.superAdmin.id,
          source || 'manual_override'
        );
        results.push({ feature_id: featureId, success: true });
      } catch (err) {
        errors.push({ feature_id: featureId, error: err.message });
      }
    }

    // Get updated entitlements
    const entitlements = await entitlementService.getCompanyEntitlements(companyId);

    logger.info('SA bulk toggled addons', {
      companyId,
      companyName: companyCheck.rows[0].name,
      featureIds: feature_ids,
      enable,
      results,
      errors,
      actorId: req.superAdmin.id
    });

    res.json({
      success: errors.length === 0,
      results,
      errors,
      entitlements
    });
  } catch (error) {
    logger.error('Failed to bulk toggle addons', {
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /sa/companies/:companyId/entitlement-audit
 * Get audit log for company entitlement changes
 */
router.get('/companies/:companyId/entitlement-audit', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Validate company exists
    const companyCheck = await db.query(
      'SELECT id FROM fm_company WHERE id = $1',
      [companyId]
    );

    if (companyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const result = await entitlementService.getAuditLog(
      companyId,
      parseInt(limit, 10),
      parseInt(offset, 10)
    );

    res.json(result);
  } catch (error) {
    logger.error('Failed to fetch entitlement audit log', {
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

/**
 * GET /sa/entitlements/stats
 * Get overall entitlement statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Companies by package
    const byPackage = await db.query(`
      SELECT
        p.id as package_id,
        p.name as package_name,
        COUNT(fc.id) as company_count
      FROM packages p
      LEFT JOIN fm_company fc ON fc.package_id = p.id
      WHERE p.is_active = TRUE
      GROUP BY p.id, p.name
      ORDER BY p.display_order
    `);

    // Active addons count
    const addonStats = await db.query(`
      SELECT
        f.id as feature_id,
        f.name as feature_name,
        COUNT(ca.id) as active_count
      FROM features f
      LEFT JOIN company_addons ca ON ca.feature_id = f.id AND ca.status = 'active'
      WHERE f.is_addon = TRUE
      GROUP BY f.id, f.name
      ORDER BY active_count DESC
    `);

    // Recent changes
    const recentChanges = await db.query(`
      SELECT
        eae.event_type,
        COUNT(*) as count
      FROM entitlement_audit_events eae
      WHERE eae.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY eae.event_type
    `);

    res.json({
      companies_by_package: byPackage.rows,
      addon_usage: addonStats.rows,
      recent_changes_30d: recentChanges.rows
    });
  } catch (error) {
    logger.error('Failed to fetch entitlement stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
