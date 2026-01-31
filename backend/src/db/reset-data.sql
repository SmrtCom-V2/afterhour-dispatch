-- Reset all data (preserves schema and packages/features)
-- Run with: psql $DATABASE_URL -f src/db/reset-data.sql

BEGIN;

-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- Delete in order respecting foreign keys (children first)
TRUNCATE TABLE sp_report_attachment CASCADE;
TRUNCATE TABLE sp_report CASCADE;
TRUNCATE TABLE dispatch_attempt CASCADE;
TRUNCATE TABLE incident_timeline CASCADE;
TRUNCATE TABLE incident CASCADE;
TRUNCATE TABLE call CASCADE;
TRUNCATE TABLE morning_report CASCADE;
TRUNCATE TABLE building_service_provider CASCADE;
TRUNCATE TABLE tenant CASCADE;
TRUNCATE TABLE building CASCADE;
TRUNCATE TABLE service_provider CASCADE;
TRUNCATE TABLE pm_company CASCADE;
TRUNCATE TABLE on_call_schedule CASCADE;
TRUNCATE TABLE fm_employee CASCADE;
TRUNCATE TABLE support_notes CASCADE;
TRUNCATE TABLE audit_log CASCADE;
TRUNCATE TABLE company_events CASCADE;
TRUNCATE TABLE company_addons CASCADE;
TRUNCATE TABLE entitlement_audit_events CASCADE;
TRUNCATE TABLE fm_admin CASCADE;
TRUNCATE TABLE fm_company CASCADE;

-- Keep packages and features (catalog data)
-- TRUNCATE TABLE package_features CASCADE;
-- TRUNCATE TABLE packages CASCADE;
-- TRUNCATE TABLE features CASCADE;

-- Keep super admin allowlist
-- TRUNCATE TABLE super_admin_allowlist CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

COMMIT;

SELECT 'All data deleted successfully' AS status;
