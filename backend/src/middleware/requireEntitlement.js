/**
 * Entitlement Middleware
 * Feature gating for premium endpoints
 *
 * Part of A-Z Delivery Spec: Super Admin Entitlements + Customer Plan & Add-Ons
 */

import { entitlementService } from '../services/EntitlementService.js';
import { logger } from '../utils/logger.js';

/**
 * Factory function to create entitlement middleware
 * @param {string} featureId - Required feature ID (e.g., 'AO_SLA_TIMERS')
 * @returns {Function} Express middleware
 *
 * Usage:
 *   router.get('/premium-endpoint', requireEntitlement('AO_SLA_TIMERS'), handler)
 */
export function requireEntitlement(featureId) {
  return async (req, res, next) => {
    try {
      // 1. Get company ID from authenticated user
      const companyId = req.user?.fm_company_id;

      if (!companyId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'AUTH_REQUIRED'
        });
      }

      // 2. Check entitlement
      const hasFeature = await entitlementService.hasFeature(companyId, featureId);

      if (!hasFeature) {
        logger.info('Feature access denied', {
          companyId,
          featureId,
          userId: req.user?.id
        });

        return res.status(403).json({
          error: 'Feature not available on your current plan',
          code: 'FEATURE_NOT_AVAILABLE',
          required_feature: featureId,
          upgrade_url: '/settings/plan-addons'
        });
      }

      // 3. Attach entitlements to request for downstream use
      if (!req.entitlements) {
        req.entitlements = await entitlementService.getCompanyEntitlements(companyId);
      }

      next();
    } catch (error) {
      logger.error('Entitlement check failed', {
        error: error.message,
        featureId,
        companyId: req.user?.fm_company_id
      });

      return res.status(500).json({
        error: 'Entitlement check failed',
        code: 'ENTITLEMENT_CHECK_ERROR'
      });
    }
  };
}

/**
 * Middleware to attach entitlements to request (non-blocking)
 * Use this when you want entitlements available but don't want to block the request
 *
 * Usage:
 *   router.get('/endpoint', attachEntitlements, handler)
 *   // Then access req.entitlements in handler
 */
export async function attachEntitlements(req, res, next) {
  try {
    const companyId = req.user?.fm_company_id;

    if (companyId) {
      req.entitlements = await entitlementService.getCompanyEntitlements(companyId);
    }
  } catch (error) {
    logger.error('Failed to attach entitlements', {
      error: error.message,
      companyId: req.user?.fm_company_id
    });
    // Don't block request, just log the error
  }

  next();
}

/**
 * Factory function for multiple required features (AND logic)
 * @param {string[]} featureIds - Array of required feature IDs
 * @returns {Function} Express middleware
 *
 * Usage:
 *   router.get('/endpoint', requireAllEntitlements(['AO_SLA_TIMERS', 'AO_ESCALATION_SUPPORT']), handler)
 */
export function requireAllEntitlements(featureIds) {
  return async (req, res, next) => {
    try {
      const companyId = req.user?.fm_company_id;

      if (!companyId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'AUTH_REQUIRED'
        });
      }

      // Get all entitlements once
      const entitlements = await entitlementService.getCompanyEntitlements(companyId);
      req.entitlements = entitlements;

      // Check all required features
      const missingFeatures = featureIds.filter(
        featureId => !entitlements.features[featureId]?.enabled
      );

      if (missingFeatures.length > 0) {
        logger.info('Multiple features access denied', {
          companyId,
          required: featureIds,
          missing: missingFeatures,
          userId: req.user?.id
        });

        return res.status(403).json({
          error: 'Required features not available on your current plan',
          code: 'FEATURES_NOT_AVAILABLE',
          required_features: featureIds,
          missing_features: missingFeatures,
          upgrade_url: '/settings/plan-addons'
        });
      }

      next();
    } catch (error) {
      logger.error('Entitlement check failed', {
        error: error.message,
        featureIds,
        companyId: req.user?.fm_company_id
      });

      return res.status(500).json({
        error: 'Entitlement check failed',
        code: 'ENTITLEMENT_CHECK_ERROR'
      });
    }
  };
}

/**
 * Factory function for any of multiple features (OR logic)
 * @param {string[]} featureIds - Array of feature IDs (any one is sufficient)
 * @returns {Function} Express middleware
 *
 * Usage:
 *   router.get('/endpoint', requireAnyEntitlement(['AO_SLA_TIMERS', 'AO_CONFIDENCE_SCORE']), handler)
 */
export function requireAnyEntitlement(featureIds) {
  return async (req, res, next) => {
    try {
      const companyId = req.user?.fm_company_id;

      if (!companyId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'AUTH_REQUIRED'
        });
      }

      // Get all entitlements once
      const entitlements = await entitlementService.getCompanyEntitlements(companyId);
      req.entitlements = entitlements;

      // Check if any feature is enabled
      const hasAny = featureIds.some(
        featureId => entitlements.features[featureId]?.enabled
      );

      if (!hasAny) {
        logger.info('No matching feature found', {
          companyId,
          required_any: featureIds,
          userId: req.user?.id
        });

        return res.status(403).json({
          error: 'At least one of the required features must be available',
          code: 'FEATURES_NOT_AVAILABLE',
          required_any: featureIds,
          upgrade_url: '/settings/plan-addons'
        });
      }

      next();
    } catch (error) {
      logger.error('Entitlement check failed', {
        error: error.message,
        featureIds,
        companyId: req.user?.fm_company_id
      });

      return res.status(500).json({
        error: 'Entitlement check failed',
        code: 'ENTITLEMENT_CHECK_ERROR'
      });
    }
  };
}

export default {
  requireEntitlement,
  attachEntitlements,
  requireAllEntitlements,
  requireAnyEntitlement
};
