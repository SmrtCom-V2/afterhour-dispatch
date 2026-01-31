/**
 * Super Admin Feature Flags Management
 * Allows enabling/disabling features globally or per-company
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';

const router = Router();

// Default feature flags with descriptions
const DEFAULT_FLAGS = [
  { key: 'incident_management', name: 'Incident Management', description: 'Core incident tracking and management', category: 'core', default_enabled: true },
  { key: 'call_recording', name: 'Call Recording', description: 'Record and store customer calls', category: 'calls', default_enabled: true },
  { key: 'sp_reports', name: 'SP Reports', description: 'Service provider reporting portal', category: 'reports', default_enabled: true },
  { key: 'bulk_operations', name: 'Bulk Operations', description: 'Allow bulk editing of records', category: 'core', default_enabled: false },
  { key: 'api_access', name: 'API Access', description: 'REST API access for integrations', category: 'integrations', default_enabled: false },
  { key: 'webhooks', name: 'Webhooks', description: 'Outbound webhook notifications', category: 'integrations', default_enabled: false },
  { key: 'advanced_analytics', name: 'Advanced Analytics', description: 'Detailed analytics and insights', category: 'analytics', default_enabled: false },
  { key: 'custom_branding', name: 'Custom Branding', description: 'White-label branding options', category: 'customization', default_enabled: false },
  { key: 'multi_language', name: 'Multi-Language', description: 'Support for multiple languages', category: 'customization', default_enabled: true },
  { key: 'sms_notifications', name: 'SMS Notifications', description: 'Send SMS alerts', category: 'notifications', default_enabled: false },
  { key: 'email_notifications', name: 'Email Notifications', description: 'Send email alerts', category: 'notifications', default_enabled: true },
  { key: 'mobile_app', name: 'Mobile App Access', description: 'Access from mobile applications', category: 'access', default_enabled: false },
  { key: 'export_data', name: 'Export Data', description: 'Allow data export to CSV/Excel', category: 'core', default_enabled: true },
  { key: 'oncall_scheduling', name: 'On-Call Scheduling', description: 'Employee on-call scheduling', category: 'core', default_enabled: true },
  { key: 'tenant_portal', name: 'Tenant Portal', description: 'Self-service tenant portal', category: 'access', default_enabled: false },
];

// GET /sa/feature-flags - List all feature flags with global settings
router.get('/', authenticateSuperAdmin, async (req, res) => {
  try {
    // Get saved feature flags from database
    const savedFlags = await db.query(`
      SELECT * FROM feature_flags ORDER BY category, name
    `).catch(() => ({ rows: [] }));

    // Get company-specific overrides count
    const overrides = await db.query(`
      SELECT flag_key, COUNT(*) as count
      FROM company_feature_flags
      GROUP BY flag_key
    `).catch(() => ({ rows: [] }));

    const overrideMap = {};
    overrides.rows.forEach(o => {
      overrideMap[o.flag_key] = parseInt(o.count, 10);
    });

    // Merge defaults with saved flags
    const flagMap = {};
    savedFlags.rows.forEach(f => {
      flagMap[f.key] = f;
    });

    const flags = DEFAULT_FLAGS.map(def => {
      const saved = flagMap[def.key];
      return {
        key: def.key,
        name: saved?.name || def.name,
        description: saved?.description || def.description,
        category: saved?.category || def.category,
        enabled: saved ? saved.enabled : def.default_enabled,
        default_enabled: def.default_enabled,
        override_count: overrideMap[def.key] || 0,
        updated_at: saved?.updated_at || null,
      };
    });

    // Get categories summary
    const categories = [...new Set(flags.map(f => f.category))].map(cat => ({
      name: cat,
      total: flags.filter(f => f.category === cat).length,
      enabled: flags.filter(f => f.category === cat && f.enabled).length,
    }));

    res.json({
      flags,
      categories,
      total: flags.length,
      enabled: flags.filter(f => f.enabled).length,
    });
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
});

// PUT /sa/feature-flags/:key - Update a global feature flag
router.put('/:key', authenticateSuperAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { enabled, name, description } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const defaultFlag = DEFAULT_FLAGS.find(f => f.key === key);
    if (!defaultFlag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    // Upsert the feature flag
    await db.query(`
      INSERT INTO feature_flags (key, name, description, category, enabled, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (key) DO UPDATE SET
        enabled = $5,
        name = COALESCE($2, feature_flags.name),
        description = COALESCE($3, feature_flags.description),
        updated_at = NOW()
    `, [
      key,
      name || defaultFlag.name,
      description || defaultFlag.description,
      defaultFlag.category,
      enabled
    ]).catch(async () => {
      // Table might not exist, create it
      await db.query(`
        CREATE TABLE IF NOT EXISTS feature_flags (
          key VARCHAR(100) PRIMARY KEY,
          name VARCHAR(200),
          description TEXT,
          category VARCHAR(50),
          enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.query(`
        INSERT INTO feature_flags (key, name, description, category, enabled, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (key) DO UPDATE SET enabled = $5, updated_at = NOW()
      `, [key, name || defaultFlag.name, description || defaultFlag.description, defaultFlag.category, enabled]);
    });

    res.json({
      ok: true,
      flag: {
        key,
        enabled,
        name: name || defaultFlag.name,
        description: description || defaultFlag.description,
      }
    });
  } catch (error) {
    console.error('Error updating feature flag:', error);
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
});

// GET /sa/feature-flags/:key/companies - Get companies with overrides for a specific flag
router.get('/:key/companies', authenticateSuperAdmin, async (req, res) => {
  try {
    const { key } = req.params;

    const result = await db.query(`
      SELECT
        cff.company_id,
        cff.enabled,
        cff.updated_at,
        c.name as company_name,
        c.status as company_status
      FROM company_feature_flags cff
      JOIN pm_companies c ON c.id = cff.company_id
      WHERE cff.flag_key = $1
      ORDER BY c.name
    `, [key]).catch(() => ({ rows: [] }));

    res.json({ companies: result.rows });
  } catch (error) {
    console.error('Error fetching company overrides:', error);
    res.status(500).json({ error: 'Failed to fetch company overrides' });
  }
});

// PUT /sa/feature-flags/:key/company/:companyId - Set company-specific override
router.put('/:key/company/:companyId', authenticateSuperAdmin, async (req, res) => {
  try {
    const { key, companyId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS company_feature_flags (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        flag_key VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, flag_key)
      )
    `).catch(() => {});

    await db.query(`
      INSERT INTO company_feature_flags (company_id, flag_key, enabled, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (company_id, flag_key) DO UPDATE SET
        enabled = $3,
        updated_at = NOW()
    `, [companyId, key, enabled]);

    res.json({ ok: true, companyId, key, enabled });
  } catch (error) {
    console.error('Error setting company override:', error);
    res.status(500).json({ error: 'Failed to set company override' });
  }
});

// DELETE /sa/feature-flags/:key/company/:companyId - Remove company-specific override
router.delete('/:key/company/:companyId', authenticateSuperAdmin, async (req, res) => {
  try {
    const { key, companyId } = req.params;

    await db.query(`
      DELETE FROM company_feature_flags
      WHERE company_id = $1 AND flag_key = $2
    `, [companyId, key]).catch(() => {});

    res.json({ ok: true });
  } catch (error) {
    console.error('Error removing company override:', error);
    res.status(500).json({ error: 'Failed to remove company override' });
  }
});

// POST /sa/feature-flags/bulk - Bulk update multiple flags
router.post('/bulk', authenticateSuperAdmin, async (req, res) => {
  try {
    const { updates } = req.body; // Array of { key, enabled }

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'updates must be an array' });
    }

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        key VARCHAR(100) PRIMARY KEY,
        name VARCHAR(200),
        description TEXT,
        category VARCHAR(50),
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});

    for (const update of updates) {
      const defaultFlag = DEFAULT_FLAGS.find(f => f.key === update.key);
      if (defaultFlag) {
        await db.query(`
          INSERT INTO feature_flags (key, name, description, category, enabled, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (key) DO UPDATE SET enabled = $5, updated_at = NOW()
        `, [update.key, defaultFlag.name, defaultFlag.description, defaultFlag.category, update.enabled]);
      }
    }

    res.json({ ok: true, updated: updates.length });
  } catch (error) {
    console.error('Error bulk updating flags:', error);
    res.status(500).json({ error: 'Failed to bulk update flags' });
  }
});

// GET /sa/feature-flags/company/:companyId - Get all flags for a specific company
router.get('/company/:companyId', authenticateSuperAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;

    // Get global flags
    const globalFlags = await db.query(`
      SELECT * FROM feature_flags
    `).catch(() => ({ rows: [] }));

    // Get company overrides
    const overrides = await db.query(`
      SELECT flag_key, enabled FROM company_feature_flags WHERE company_id = $1
    `, [companyId]).catch(() => ({ rows: [] }));

    const globalMap = {};
    globalFlags.rows.forEach(f => {
      globalMap[f.key] = f.enabled;
    });

    const overrideMap = {};
    overrides.rows.forEach(o => {
      overrideMap[o.flag_key] = o.enabled;
    });

    // Build company flags
    const flags = DEFAULT_FLAGS.map(def => {
      const globalEnabled = globalMap[def.key] !== undefined ? globalMap[def.key] : def.default_enabled;
      const hasOverride = overrideMap[def.key] !== undefined;
      const effectiveEnabled = hasOverride ? overrideMap[def.key] : globalEnabled;

      return {
        key: def.key,
        name: def.name,
        description: def.description,
        category: def.category,
        global_enabled: globalEnabled,
        has_override: hasOverride,
        override_enabled: hasOverride ? overrideMap[def.key] : null,
        effective_enabled: effectiveEnabled,
      };
    });

    res.json({ companyId, flags });
  } catch (error) {
    console.error('Error fetching company flags:', error);
    res.status(500).json({ error: 'Failed to fetch company flags' });
  }
});

export default router;
