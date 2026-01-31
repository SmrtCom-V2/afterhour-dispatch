-- Migration: Create Entitlements Schema
-- Description: Creates packages, features, package_features, company_addons, and entitlement_audit_events tables
-- Part of A-Z Delivery Spec: Super Admin Entitlements + Customer Plan & Add-Ons

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. FEATURES TABLE (Canonical Feature Catalog)
-- ============================================
CREATE TABLE IF NOT EXISTS features (
    id VARCHAR(64) PRIMARY KEY,  -- e.g., 'BASE_INTAKE_CLASSIFICATION', 'AO_SLA_TIMERS'
    name VARCHAR(128) NOT NULL,
    description TEXT,
    category VARCHAR(32) NOT NULL CHECK (category IN ('base', 'addon')),
    depends_on JSONB DEFAULT '[]'::JSONB,  -- Array of feature IDs this depends on
    is_addon BOOLEAN NOT NULL DEFAULT FALSE,
    is_base BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_features_category ON features(category);
CREATE INDEX IF NOT EXISTS idx_features_is_addon ON features(is_addon) WHERE is_addon = TRUE;
CREATE INDEX IF NOT EXISTS idx_features_is_base ON features(is_base) WHERE is_base = TRUE;

-- ============================================
-- 2. PACKAGES TABLE (Plan Presets)
-- ============================================
CREATE TABLE IF NOT EXISTS packages (
    id VARCHAR(32) PRIMARY KEY,  -- e.g., 'PLAN_MICRO', 'PLAN_STARTER'
    name VARCHAR(64) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    stripe_price_id VARCHAR(128),  -- Link to Stripe price
    monthly_price_cents INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_packages_is_active ON packages(is_active) WHERE is_active = TRUE;

-- ============================================
-- 3. PACKAGE_FEATURES TABLE (Junction)
-- ============================================
CREATE TABLE IF NOT EXISTS package_features (
    package_id VARCHAR(32) NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    feature_id VARCHAR(64) NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    limits_json JSONB DEFAULT '{}'::JSONB,  -- Feature-specific limits per package
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (package_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_package_features_package ON package_features(package_id);
CREATE INDEX IF NOT EXISTS idx_package_features_feature ON package_features(feature_id);

-- ============================================
-- 4. COMPANY_ADDONS TABLE (Per-Company Overrides)
-- ============================================
CREATE TABLE IF NOT EXISTS company_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES fm_company(id) ON DELETE CASCADE,
    feature_id VARCHAR(64) NOT NULL REFERENCES features(id) ON DELETE RESTRICT,
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    effective_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,  -- Optional expiration for trials
    source VARCHAR(32) NOT NULL CHECK (source IN ('purchased', 'manual_override', 'trial', 'included_by_plan')),
    created_by UUID REFERENCES fm_admin(id),  -- SA or admin user who enabled it
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (company_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_company_addons_company ON company_addons(company_id);
CREATE INDEX IF NOT EXISTS idx_company_addons_company_status ON company_addons(company_id, status);
CREATE INDEX IF NOT EXISTS idx_company_addons_feature ON company_addons(feature_id);
CREATE INDEX IF NOT EXISTS idx_company_addons_active ON company_addons(status) WHERE status = 'active';

-- ============================================
-- 5. ENTITLEMENT_AUDIT_EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS entitlement_audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES fm_company(id) ON DELETE CASCADE,
    actor_type VARCHAR(16) NOT NULL CHECK (actor_type IN ('super_admin', 'system', 'stripe_webhook', 'customer')),
    actor_id UUID,  -- User ID if applicable
    event_type VARCHAR(32) NOT NULL CHECK (event_type IN (
        'plan_changed',
        'addon_enabled',
        'addon_disabled',
        'addon_purchased',
        'addon_expired',
        'bulk_sync',
        'dependency_auto_enabled'
    )),
    payload_json JSONB NOT NULL DEFAULT '{}'::JSONB,
    ip_address VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entitlement_audit_company ON entitlement_audit_events(company_id);
CREATE INDEX IF NOT EXISTS idx_entitlement_audit_created ON entitlement_audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entitlement_audit_company_created ON entitlement_audit_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entitlement_audit_event_type ON entitlement_audit_events(event_type);

-- ============================================
-- 6. ADD COLUMNS TO FM_COMPANY
-- ============================================

-- Add package_id column to fm_company
ALTER TABLE fm_company
ADD COLUMN IF NOT EXISTS package_id VARCHAR(32) REFERENCES packages(id);

-- Add entitlements_version for cache invalidation
ALTER TABLE fm_company
ADD COLUMN IF NOT EXISTS entitlements_version INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_fm_company_package ON fm_company(package_id);

-- ============================================
-- 7. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================

-- Trigger to auto-bump entitlements_version when company_addons changes
CREATE OR REPLACE FUNCTION bump_entitlements_version()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE fm_company
    SET entitlements_version = entitlements_version + 1,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.company_id, OLD.company_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_company_addons_version ON company_addons;
CREATE TRIGGER trigger_company_addons_version
AFTER INSERT OR UPDATE OR DELETE ON company_addons
FOR EACH ROW EXECUTE FUNCTION bump_entitlements_version();

-- Trigger to update updated_at on features
DROP TRIGGER IF EXISTS update_features_updated_at ON features;
CREATE TRIGGER update_features_updated_at
BEFORE UPDATE ON features
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on packages
DROP TRIGGER IF EXISTS update_packages_updated_at ON packages;
CREATE TRIGGER update_packages_updated_at
BEFORE UPDATE ON packages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on company_addons
DROP TRIGGER IF EXISTS update_company_addons_updated_at ON company_addons;
CREATE TRIGGER update_company_addons_updated_at
BEFORE UPDATE ON company_addons
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
