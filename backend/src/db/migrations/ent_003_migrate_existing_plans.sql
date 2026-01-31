-- Migration: Migrate Existing Companies to New Package System
-- Description: Maps existing plan_id to package_id for backward compatibility
-- Part of A-Z Delivery Spec: Super Admin Entitlements + Customer Plan & Add-Ons

-- ============================================
-- 1. MAP EXISTING PLANS TO NEW PACKAGES
-- ============================================

-- Map companies based on their existing plan name
-- This uses a subquery to match plan names to package IDs
UPDATE fm_company fc
SET package_id = CASE
    -- Match by plan name patterns
    WHEN EXISTS (
        SELECT 1 FROM plans p
        WHERE p.id = fc.plan_id
        AND (LOWER(p.name) LIKE '%micro%' OR LOWER(p.name) = 'free' OR LOWER(p.name) = 'basic')
    ) THEN 'PLAN_MICRO'

    WHEN EXISTS (
        SELECT 1 FROM plans p
        WHERE p.id = fc.plan_id
        AND (LOWER(p.name) LIKE '%starter%' OR LOWER(p.name) LIKE '%standard%')
    ) THEN 'PLAN_STARTER'

    WHEN EXISTS (
        SELECT 1 FROM plans p
        WHERE p.id = fc.plan_id
        AND (LOWER(p.name) LIKE '%professional%' OR LOWER(p.name) LIKE '%pro%' OR LOWER(p.name) LIKE '%business%')
    ) THEN 'PLAN_PROFESSIONAL'

    WHEN EXISTS (
        SELECT 1 FROM plans p
        WHERE p.id = fc.plan_id
        AND (LOWER(p.name) LIKE '%compliance%' OR LOWER(p.name) LIKE '%enterprise%' OR LOWER(p.name) LIKE '%premium%')
    ) THEN 'PLAN_COMPLIANCE'

    -- Default to MICRO for unmatched plans
    ELSE 'PLAN_MICRO'
END
WHERE fc.package_id IS NULL
  AND fc.plan_id IS NOT NULL;

-- ============================================
-- 2. SET DEFAULT FOR COMPANIES WITHOUT ANY PLAN
-- ============================================

-- All companies without a package get MICRO (base plan)
UPDATE fm_company
SET package_id = 'PLAN_MICRO'
WHERE package_id IS NULL;

-- ============================================
-- 3. INITIALIZE ENTITLEMENTS VERSION
-- ============================================

-- Ensure all companies have an entitlements_version
UPDATE fm_company
SET entitlements_version = 1
WHERE entitlements_version IS NULL;

-- ============================================
-- 4. LOG MIGRATION IN COMPANY EVENTS
-- ============================================

-- Record the migration as a system event for audit purposes
INSERT INTO company_events (company_id, type, actor_type, actor_id, metadata)
SELECT
    id,
    'entitlements_migrated',
    'system',
    NULL,
    jsonb_build_object(
        'migration', '003_migrate_existing_plans',
        'old_plan_id', plan_id::text,
        'new_package_id', package_id,
        'migrated_at', NOW()
    )
FROM fm_company
WHERE package_id IS NOT NULL;
