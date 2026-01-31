/**
 * Customer Entitlements Routes
 * Endpoints for customer-facing entitlement information
 *
 * Part of A-Z Delivery Spec: Super Admin Entitlements + Customer Plan & Add-Ons
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { entitlementService } from '../services/EntitlementService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/me/entitlements
 * Get current user's company entitlements
 */
router.get('/me/entitlements', async (req, res) => {
  try {
    const companyId = req.user.fm_company_id;
    const entitlements = await entitlementService.getCompanyEntitlements(companyId);

    res.json({
      company_id: entitlements.company_id,
      entitlement_version: entitlements.entitlement_version,
      features: entitlements.features
    });
  } catch (error) {
    logger.error('Failed to fetch entitlements', {
      error: error.message,
      companyId: req.user?.fm_company_id
    });
    res.status(500).json({ error: 'Failed to fetch entitlements' });
  }
});

/**
 * GET /api/settings/billing
 * Get billing overview for customer (plan, addons, available upgrades)
 */
router.get('/settings/billing', async (req, res) => {
  try {
    const companyId = req.user.fm_company_id;
    const summary = await entitlementService.getCompanyBillingSummary(companyId);

    // Filter to customer-appropriate view (hide internal details)
    const customerView = {
      current_plan: summary.current_package
        ? {
            id: summary.current_package.id,
            name: summary.current_package.name,
            description: summary.current_package.description
          }
        : null,
      included_features: summary.features
        .filter(f => f.enabled && (summary.entitlements[f.id]?.source === 'PLAN' || summary.entitlements[f.id]?.source === 'BASE'))
        .map(f => ({
          id: f.id,
          name: f.name,
          description: f.description,
          source: summary.entitlements[f.id]?.source
        })),
      active_addons: summary.features
        .filter(f => f.enabled && (summary.entitlements[f.id]?.source === 'ADDON' || summary.entitlements[f.id]?.source === 'OVERRIDE'))
        .map(f => ({
          id: f.id,
          name: f.name,
          description: f.description
        })),
      available_addons: summary.features
        .filter(f => f.is_addon && !f.enabled)
        .map(f => ({
          id: f.id,
          name: f.name,
          description: f.description,
          dependencies_met: f.dependencies_met,
          missing_dependencies: f.missing_dependencies
        })),
      available_plans: summary.packages.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        monthly_price_cents: p.monthly_price_cents,
        is_current: p.id === summary.current_package?.id
      }))
    };

    res.json(customerView);
  } catch (error) {
    logger.error('Failed to fetch billing info', {
      error: error.message,
      companyId: req.user?.fm_company_id
    });
    res.status(500).json({ error: 'Failed to fetch billing info' });
  }
});

/**
 * GET /api/entitlements/packages
 * Get all available packages/plans
 */
router.get('/entitlements/packages', async (req, res) => {
  try {
    const packages = await entitlementService.getAllPackages();

    // Filter to customer-appropriate view
    const customerView = packages.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      monthly_price_cents: p.monthly_price_cents,
      feature_count: parseInt(p.feature_count, 10),
      feature_ids: p.feature_ids
    }));

    res.json({ packages: customerView });
  } catch (error) {
    logger.error('Failed to fetch packages', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

/**
 * GET /api/entitlements/features
 * Get all available features
 */
router.get('/entitlements/features', async (req, res) => {
  try {
    const features = await entitlementService.getAllFeatures();

    // Filter to customer-appropriate view
    const customerView = features.map(f => ({
      id: f.id,
      name: f.name,
      description: f.description,
      category: f.category,
      is_addon: f.is_addon,
      is_base: f.is_base,
      depends_on: f.depends_on || []
    }));

    res.json({ features: customerView });
  } catch (error) {
    logger.error('Failed to fetch features', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch features' });
  }
});

/**
 * POST /api/entitlements/request-addon
 * Request an addon (pre-Stripe: just logs the request)
 * In production, this would trigger a Stripe checkout or sales contact
 */
router.post('/entitlements/request-addon', async (req, res) => {
  try {
    const { feature_id } = req.body;
    const companyId = req.user.fm_company_id;

    if (!feature_id) {
      return res.status(400).json({ error: 'feature_id required' });
    }

    // Log the request for now
    logger.info('Addon request received', {
      companyId,
      feature_id,
      userId: req.user.id,
      userEmail: req.user.email
    });

    // In production, this would:
    // 1. Create a Stripe checkout session for the addon
    // 2. Or trigger a sales contact flow
    // 3. Or directly enable if self-service is allowed

    res.json({
      success: true,
      message: 'Addon request received. Our team will contact you shortly.',
      feature_id
    });
  } catch (error) {
    logger.error('Failed to process addon request', {
      error: error.message,
      companyId: req.user?.fm_company_id
    });
    res.status(500).json({ error: 'Failed to process addon request' });
  }
});

export default router;
