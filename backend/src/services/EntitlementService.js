/**
 * Entitlement Service
 * Core business logic for resolving, caching, and managing company entitlements
 *
 * Part of A-Z Delivery Spec: Super Admin Entitlements + Customer Plan & Add-Ons
 */

import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

// In-memory cache for entitlements (simple implementation)
// In production, consider Redis for distributed caching
const entitlementCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * EntitlementService class
 * Handles all entitlement-related operations
 */
class EntitlementService {
  /**
   * Get all effective entitlements for a company
   * @param {string} companyId - Company UUID
   * @returns {Object} { features: Object, version: number }
   */
  async getCompanyEntitlements(companyId) {
    // 1. Check cache first
    const cacheKey = `entitlements:${companyId}`;
    const cached = entitlementCache.get(cacheKey);

    // 2. Get company's current version
    const companyResult = await db.query(
      'SELECT package_id, entitlements_version FROM fm_company WHERE id = $1',
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      throw new Error('Company not found');
    }

    const company = companyResult.rows[0];

    // 3. Return cached if valid
    if (cached && cached.version === company.entitlements_version && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // 4. Resolve entitlements fresh
    const entitlements = await this._resolveEntitlements(companyId, company.package_id);

    // 5. Cache with version
    const cacheEntry = {
      data: {
        company_id: companyId,
        entitlement_version: company.entitlements_version,
        features: entitlements.features
      },
      version: company.entitlements_version,
      expiresAt: Date.now() + CACHE_TTL_MS
    };
    entitlementCache.set(cacheKey, cacheEntry);

    return cacheEntry.data;
  }

  /**
   * Resolve entitlements by merging package features and company addons
   * @private
   */
  async _resolveEntitlements(companyId, packageId) {
    const features = {};

    // 1. Get all base features (always included)
    const baseFeatures = await db.query(`
      SELECT f.id, f.name, f.description, f.depends_on, f.is_addon, f.is_base, f.display_order
      FROM features f
      WHERE f.is_base = TRUE
      ORDER BY f.display_order
    `);

    for (const f of baseFeatures.rows) {
      features[f.id] = {
        enabled: true,
        source: 'BASE',
        name: f.name,
        description: f.description,
        depends_on: f.depends_on || [],
        limits: null
      };
    }

    // 2. Get package features (included by plan)
    if (packageId) {
      const packageFeatures = await db.query(`
        SELECT f.id, f.name, f.description, f.depends_on, f.is_addon, f.is_base,
               pf.limits_json, f.display_order
        FROM package_features pf
        JOIN features f ON f.id = pf.feature_id
        WHERE pf.package_id = $1
        ORDER BY f.display_order
      `, [packageId]);

      for (const pf of packageFeatures.rows) {
        features[pf.id] = {
          enabled: true,
          source: pf.is_base ? 'BASE' : 'PLAN',
          name: pf.name,
          description: pf.description,
          depends_on: pf.depends_on || [],
          limits: pf.limits_json || null
        };
      }
    }

    // 3. Get company addons (overrides)
    const companyAddons = await db.query(`
      SELECT f.id, f.name, f.description, f.depends_on, f.display_order,
             ca.status, ca.source, ca.effective_at, ca.expires_at
      FROM company_addons ca
      JOIN features f ON f.id = ca.feature_id
      WHERE ca.company_id = $1
        AND ca.status = 'active'
        AND (ca.expires_at IS NULL OR ca.expires_at > NOW())
      ORDER BY f.display_order
    `, [companyId]);

    // 4. Merge company addons (they override package features)
    for (const addon of companyAddons.rows) {
      features[addon.id] = {
        enabled: true,
        source: addon.source === 'purchased' ? 'ADDON' : 'OVERRIDE',
        name: addon.name,
        description: addon.description,
        depends_on: addon.depends_on || [],
        limits: null,
        effective_at: addon.effective_at,
        expires_at: addon.expires_at
      };
    }

    // 5. Check and annotate disabled addons
    const allAddons = await db.query(`
      SELECT f.id, f.name, f.description, f.depends_on
      FROM features f
      WHERE f.is_addon = TRUE
      ORDER BY f.display_order
    `);

    for (const addon of allAddons.rows) {
      if (!features[addon.id]) {
        // Check if dependencies are met
        const deps = addon.depends_on || [];
        const depsMet = deps.every(depId => features[depId]?.enabled);

        features[addon.id] = {
          enabled: false,
          source: null,
          name: addon.name,
          description: addon.description,
          depends_on: deps,
          limits: null,
          reason_disabled: depsMet ? null : `Requires: ${deps.filter(d => !features[d]?.enabled).join(', ')}`
        };
      }
    }

    return { features };
  }

  /**
   * Check if company has a specific feature
   * @param {string} companyId - Company UUID
   * @param {string} featureId - Feature ID
   * @returns {boolean}
   */
  async hasFeature(companyId, featureId) {
    const entitlements = await this.getCompanyEntitlements(companyId);
    return !!entitlements.features[featureId]?.enabled;
  }

  /**
   * Change company's plan (Super Admin only)
   * @param {string} companyId - Company UUID
   * @param {string} newPackageId - New package ID
   * @param {string} actorId - Admin UUID who made the change
   * @param {string} actorType - Actor type (default: 'super_admin')
   * @returns {Object} Updated entitlements
   */
  async changeCompanyPlan(companyId, newPackageId, actorId, actorType = 'super_admin') {
    // 1. Validate package exists and is active
    const pkgResult = await db.query(
      'SELECT * FROM packages WHERE id = $1 AND is_active = TRUE',
      [newPackageId]
    );

    if (pkgResult.rows.length === 0) {
      throw new Error('Invalid or inactive package');
    }

    // 2. Get current state for audit
    const currentCompany = await db.query(
      'SELECT package_id, entitlements_version FROM fm_company WHERE id = $1',
      [companyId]
    );

    if (currentCompany.rows.length === 0) {
      throw new Error('Company not found');
    }

    const oldPackageId = currentCompany.rows[0].package_id;
    const beforeEntitlements = await this.getCompanyEntitlements(companyId);

    // 3. Update company package in transaction
    await db.transaction(async (client) => {
      // Update company package
      await client.query(
        'UPDATE fm_company SET package_id = $1, entitlements_version = entitlements_version + 1, updated_at = NOW() WHERE id = $2',
        [newPackageId, companyId]
      );

      // Calculate after state
      // Note: We need fresh resolution, not cached
      this._invalidateCache(companyId);
    });

    const afterEntitlements = await this.getCompanyEntitlements(companyId);

    // 4. Audit log
    await this._logAuditEvent(companyId, actorType, actorId, 'plan_changed', {
      before: { package_id: oldPackageId, features: Object.keys(beforeEntitlements.features).filter(k => beforeEntitlements.features[k].enabled) },
      after: { package_id: newPackageId, features: Object.keys(afterEntitlements.features).filter(k => afterEntitlements.features[k].enabled) }
    });

    logger.info('Company plan changed', {
      companyId,
      oldPackageId,
      newPackageId,
      actorId,
      actorType
    });

    return afterEntitlements;
  }

  /**
   * Toggle addon for company (Super Admin only)
   * @param {string} companyId - Company UUID
   * @param {string} featureId - Feature ID
   * @param {boolean} enable - Enable or disable
   * @param {string} actorId - Admin UUID who made the change
   * @param {string} source - Source of the change (default: 'manual_override')
   * @returns {Object} Updated entitlements
   */
  async toggleAddon(companyId, featureId, enable, actorId, source = 'manual_override') {
    // 1. Validate feature exists and is addon
    const featureResult = await db.query(
      'SELECT * FROM features WHERE id = $1 AND is_addon = TRUE',
      [featureId]
    );

    if (featureResult.rows.length === 0) {
      throw new Error('Invalid addon feature');
    }

    const feature = featureResult.rows[0];

    // 2. Check dependencies if enabling
    if (enable) {
      const deps = feature.depends_on || [];
      for (const depId of deps) {
        const hasDep = await this.hasFeature(companyId, depId);
        if (!hasDep) {
          throw new Error(`Dependency not met: ${depId} must be enabled first`);
        }
      }
    }

    // 3. Check if disabling would break dependents
    if (!enable) {
      const dependentsResult = await db.query(`
        SELECT id, name FROM features
        WHERE depends_on @> $1::jsonb AND is_addon = TRUE
      `, [JSON.stringify([featureId])]);

      for (const dep of dependentsResult.rows) {
        const hasDependent = await this.hasFeature(companyId, dep.id);
        if (hasDependent) {
          throw new Error(`Cannot disable: ${dep.name} depends on this feature`);
        }
      }
    }

    // 4. Check if feature is included by plan (can't disable if from plan)
    if (!enable) {
      const companyResult = await db.query(
        'SELECT package_id FROM fm_company WHERE id = $1',
        [companyId]
      );

      if (companyResult.rows[0]?.package_id) {
        const planIncludesResult = await db.query(
          'SELECT 1 FROM package_features WHERE package_id = $1 AND feature_id = $2',
          [companyResult.rows[0].package_id, featureId]
        );

        if (planIncludesResult.rows.length > 0) {
          throw new Error('Cannot disable feature included by plan. Change plan instead.');
        }
      }
    }

    // 5. Upsert company_addon
    if (enable) {
      await db.query(`
        INSERT INTO company_addons (company_id, feature_id, status, source, created_by)
        VALUES ($1, $2, 'active', $3, $4)
        ON CONFLICT (company_id, feature_id)
        DO UPDATE SET status = 'active', source = $3, updated_at = NOW()
      `, [companyId, featureId, source, actorId]);
    } else {
      await db.query(`
        UPDATE company_addons
        SET status = 'inactive', updated_at = NOW()
        WHERE company_id = $1 AND feature_id = $2
      `, [companyId, featureId]);
    }

    // 6. Audit
    await this._logAuditEvent(companyId, 'super_admin', actorId,
      enable ? 'addon_enabled' : 'addon_disabled',
      { feature_id: featureId, feature_name: feature.name, source }
    );

    // 7. Invalidate cache
    this._invalidateCache(companyId);

    logger.info('Addon toggled', {
      companyId,
      featureId,
      enable,
      actorId,
      source
    });

    return this.getCompanyEntitlements(companyId);
  }

  /**
   * Get billing/entitlements summary for Super Admin view
   * @param {string} companyId - Company UUID
   * @returns {Object} Full billing summary
   */
  async getCompanyBillingSummary(companyId) {
    // Get company with package info
    const companyResult = await db.query(`
      SELECT c.*, p.name as package_name, p.description as package_description,
             p.monthly_price_cents
      FROM fm_company c
      LEFT JOIN packages p ON p.id = c.package_id
      WHERE c.id = $1
    `, [companyId]);

    if (companyResult.rows.length === 0) {
      throw new Error('Company not found');
    }

    const company = companyResult.rows[0];

    // Get current entitlements
    const entitlements = await this.getCompanyEntitlements(companyId);

    // Get all features
    const allFeatures = await db.query(
      'SELECT * FROM features ORDER BY display_order'
    );

    // Get all active packages
    const allPackages = await db.query(
      'SELECT * FROM packages WHERE is_active = TRUE ORDER BY display_order'
    );

    // Get company addons
    const companyAddons = await db.query(`
      SELECT ca.*, f.name as feature_name
      FROM company_addons ca
      JOIN features f ON f.id = ca.feature_id
      WHERE ca.company_id = $1
      ORDER BY ca.created_at DESC
    `, [companyId]);

    // Annotate features with status
    const featuresWithStatus = allFeatures.rows.map(f => {
      const entitlement = entitlements.features[f.id];
      const deps = f.depends_on || [];
      const depsMet = deps.every(depId => entitlements.features[depId]?.enabled);

      return {
        ...f,
        enabled: entitlement?.enabled || false,
        source: entitlement?.source || null,
        dependencies_met: depsMet,
        missing_dependencies: deps.filter(d => !entitlements.features[d]?.enabled)
      };
    });

    return {
      company: {
        id: company.id,
        name: company.name,
        status: company.status,
        owner_email: company.owner_email,
        entitlements_version: company.entitlements_version,
        created_at: company.created_at,
        updated_at: company.updated_at
      },
      current_package: {
        id: company.package_id,
        name: company.package_name,
        description: company.package_description,
        monthly_price_cents: company.monthly_price_cents
      },
      packages: allPackages.rows,
      features: featuresWithStatus,
      company_addons: companyAddons.rows,
      entitlements: entitlements.features
    };
  }

  /**
   * Get audit log for company entitlement changes
   * @param {string} companyId - Company UUID
   * @param {number} limit - Max results (default: 50)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Object} Audit events with pagination
   */
  async getAuditLog(companyId, limit = 50, offset = 0) {
    const result = await db.query(`
      SELECT * FROM entitlement_audit_events
      WHERE company_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [companyId, limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) FROM entitlement_audit_events WHERE company_id = $1',
      [companyId]
    );

    return {
      events: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit,
      offset
    };
  }

  /**
   * Get all packages with feature counts
   * @returns {Array} Packages with included feature counts
   */
  async getAllPackages() {
    const result = await db.query(`
      SELECT p.*,
             COUNT(pf.feature_id) as feature_count,
             ARRAY_AGG(pf.feature_id) as feature_ids
      FROM packages p
      LEFT JOIN package_features pf ON p.id = pf.package_id
      WHERE p.is_active = TRUE
      GROUP BY p.id
      ORDER BY p.display_order
    `);

    return result.rows;
  }

  /**
   * Get all features
   * @returns {Array} All features ordered by display_order
   */
  async getAllFeatures() {
    const result = await db.query(
      'SELECT * FROM features ORDER BY display_order'
    );
    return result.rows;
  }

  /**
   * Log audit event
   * @private
   */
  async _logAuditEvent(companyId, actorType, actorId, eventType, payload, req = null) {
    await db.query(`
      INSERT INTO entitlement_audit_events
      (company_id, actor_type, actor_id, event_type, payload_json, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      companyId,
      actorType,
      actorId,
      eventType,
      JSON.stringify(payload),
      req?.ip || null,
      req?.get?.('user-agent') || null
    ]);
  }

  /**
   * Invalidate cache for company
   * @private
   */
  _invalidateCache(companyId) {
    entitlementCache.delete(`entitlements:${companyId}`);
  }

  /**
   * Clear all cached entitlements
   * Useful for testing or after bulk operations
   */
  clearAllCache() {
    entitlementCache.clear();
    logger.info('Entitlement cache cleared');
  }
}

// Singleton instance
const entitlementService = new EntitlementService();

export { entitlementService, EntitlementService };
export default entitlementService;
