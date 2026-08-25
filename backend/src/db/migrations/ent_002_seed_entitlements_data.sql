-- Migration: Seed Features and Packages Data
-- Description: Inserts canonical feature catalog and plan presets
-- Part of A-Z Delivery Spec: Super Admin Entitlements + Customer Plan & Add-Ons

-- ============================================
-- 1. INSERT BASE FEATURES
-- ============================================
INSERT INTO features (id, name, description, category, is_base, is_addon, display_order) VALUES
    ('BASE_INTAKE_CLASSIFICATION', 'Intake & Classification', 'Basic incident intake and classification system', 'base', TRUE, FALSE, 1),
    ('BASE_HUMAN_DISPATCH', 'Human Dispatch', 'Manual dispatch assignment to human operators', 'base', TRUE, FALSE, 2),
    ('BASE_TRACEABILITY_MIN', 'Minimum Traceability', 'Basic audit trail and traceability for incidents', 'base', TRUE, FALSE, 3),
    ('BASE_VISIBILITY_BASIC_REPORT', 'Basic Visibility Report', 'Basic reporting and visibility dashboard', 'base', TRUE, FALSE, 4)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_base = EXCLUDED.is_base,
    is_addon = EXCLUDED.is_addon,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- ============================================
-- 2. INSERT ADD-ON FEATURES
-- ============================================
INSERT INTO features (id, name, description, category, is_base, is_addon, depends_on, display_order) VALUES
    ('AO_DETAILED_INCIDENT_REPORT', 'Detailed Incident Reports', 'Comprehensive incident reports with full details, attachments, and timeline', 'addon', FALSE, TRUE, '[]', 10),
    ('AO_CONFIDENCE_SCORE', 'AI Confidence Score', 'AI-powered confidence scoring for incident classification accuracy', 'addon', FALSE, TRUE, '[]', 11),
    ('AO_SLA_TIMERS', 'SLA Timers', 'Service level agreement tracking with configurable response time targets', 'addon', FALSE, TRUE, '[]', 12),
    ('AO_ESCALATION_SUPPORT', 'Escalation Support', 'Automated multi-tier escalation workflows with notifications', 'addon', FALSE, TRUE, '["AO_SLA_TIMERS"]', 13),
    ('AO_AUTO_REPORT_DELIVERY', 'Auto Report Delivery', 'Automated report delivery via email with next-day handover scheduling', 'addon', FALSE, TRUE, '[]', 14),
    ('AO_EXTENDED_AUDIT_TRAIL', 'Extended Audit Trail', 'Full audit trail with extended retention, decision chain visibility, and export', 'addon', FALSE, TRUE, '[]', 15),
    ('AO_CLIENT_READY_COMPLIANCE_REPORT', 'Client-Ready Compliance Reports', 'Exportable, structured incident documentation formatted for internal reviews', 'addon', FALSE, TRUE, '[]', 16),
    ('AO_ANALYTICS_BACKLOG_TRENDS', 'Analytics & Backlog Trends', 'Advanced analytics dashboard with backlog analysis and trend reporting', 'addon', FALSE, TRUE, '[]', 17)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_base = EXCLUDED.is_base,
    is_addon = EXCLUDED.is_addon,
    depends_on = EXCLUDED.depends_on,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- ============================================
-- 3. ADD LIMITS COLUMN TO PACKAGES (if not exists)
-- ============================================
ALTER TABLE packages ADD COLUMN IF NOT EXISTS limits_json JSONB DEFAULT '{}'::JSONB;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS tagline VARCHAR(128);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS setup_fee_cents INTEGER DEFAULT 0;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS ideal_for TEXT;

-- ============================================
-- 4. INSERT PACKAGES (Plan Presets) - Matching Website Pricing
-- ============================================
INSERT INTO packages (id, name, tagline, description, is_active, display_order, monthly_price_cents, setup_fee_cents, limits_json, ideal_for) VALUES
    ('PLAN_MICRO', 'Micro', 'Best for small portfolios needing basic after-hours protection', 'Human-verified alerts, Basic escalation (call or message), Basic incident summary', TRUE, 1, 19900, 0, '{"max_properties": 5, "max_incidents_month": 20}', 'Entry-level solution for small operators'),
    ('PLAN_STARTER', 'Starter', 'Managed after-hours response', 'Everything in Micro, plus: Structured incident reports, Priority escalation rules, Named escalation contacts', TRUE, 2, 34900, 0, '{"max_properties": 15, "max_incidents_month": 50}', 'Ideal for growing portfolios'),
    ('PLAN_PROFESSIONAL', 'Professional', 'Guaranteed after-hours outcomes', 'Everything in Starter, plus: SLA-backed response times, Multi-step escalation workflows, Incident categorization & severity, Monthly trend & insight reports', TRUE, 3, 64900, 75000, '{"max_properties": 50, "max_incidents_month": 150}', 'Ideal for risk-sensitive operators and multi-location businesses'),
    ('PLAN_COMPLIANCE', 'Compliance', 'Audit-ready after-hours governance', 'Everything in Professional, plus: Extended incident logging with long-term retention, Exportable incident reports for internal reviews, Structured reporting format', TRUE, 4, 99900, 150000, '{"max_properties": 150, "max_incidents_month": 300}', 'Ideal for compliance-bound organizations and insurers')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order,
    monthly_price_cents = EXCLUDED.monthly_price_cents,
    setup_fee_cents = EXCLUDED.setup_fee_cents,
    limits_json = EXCLUDED.limits_json,
    ideal_for = EXCLUDED.ideal_for,
    updated_at = NOW();

-- ============================================
-- 4. MAP PACKAGE FEATURES
-- ============================================

-- Clear existing mappings to ensure clean state
DELETE FROM package_features WHERE package_id IN ('PLAN_MICRO', 'PLAN_STARTER', 'PLAN_PROFESSIONAL', 'PLAN_COMPLIANCE');

-- PLAN_MICRO: Base features only
INSERT INTO package_features (package_id, feature_id) VALUES
    ('PLAN_MICRO', 'BASE_INTAKE_CLASSIFICATION'),
    ('PLAN_MICRO', 'BASE_HUMAN_DISPATCH'),
    ('PLAN_MICRO', 'BASE_TRACEABILITY_MIN'),
    ('PLAN_MICRO', 'BASE_VISIBILITY_BASIC_REPORT');

-- PLAN_STARTER: Base + Detailed Incident Reports
INSERT INTO package_features (package_id, feature_id) VALUES
    ('PLAN_STARTER', 'BASE_INTAKE_CLASSIFICATION'),
    ('PLAN_STARTER', 'BASE_HUMAN_DISPATCH'),
    ('PLAN_STARTER', 'BASE_TRACEABILITY_MIN'),
    ('PLAN_STARTER', 'BASE_VISIBILITY_BASIC_REPORT'),
    ('PLAN_STARTER', 'AO_DETAILED_INCIDENT_REPORT');

-- PLAN_PROFESSIONAL: Base + Several Add-ons
INSERT INTO package_features (package_id, feature_id) VALUES
    ('PLAN_PROFESSIONAL', 'BASE_INTAKE_CLASSIFICATION'),
    ('PLAN_PROFESSIONAL', 'BASE_HUMAN_DISPATCH'),
    ('PLAN_PROFESSIONAL', 'BASE_TRACEABILITY_MIN'),
    ('PLAN_PROFESSIONAL', 'BASE_VISIBILITY_BASIC_REPORT'),
    ('PLAN_PROFESSIONAL', 'AO_DETAILED_INCIDENT_REPORT'),
    ('PLAN_PROFESSIONAL', 'AO_SLA_TIMERS'),
    ('PLAN_PROFESSIONAL', 'AO_ESCALATION_SUPPORT'),
    ('PLAN_PROFESSIONAL', 'AO_AUTO_REPORT_DELIVERY');

-- PLAN_COMPLIANCE: All features
INSERT INTO package_features (package_id, feature_id) VALUES
    ('PLAN_COMPLIANCE', 'BASE_INTAKE_CLASSIFICATION'),
    ('PLAN_COMPLIANCE', 'BASE_HUMAN_DISPATCH'),
    ('PLAN_COMPLIANCE', 'BASE_TRACEABILITY_MIN'),
    ('PLAN_COMPLIANCE', 'BASE_VISIBILITY_BASIC_REPORT'),
    ('PLAN_COMPLIANCE', 'AO_DETAILED_INCIDENT_REPORT'),
    ('PLAN_COMPLIANCE', 'AO_CONFIDENCE_SCORE'),
    ('PLAN_COMPLIANCE', 'AO_SLA_TIMERS'),
    ('PLAN_COMPLIANCE', 'AO_ESCALATION_SUPPORT'),
    ('PLAN_COMPLIANCE', 'AO_AUTO_REPORT_DELIVERY'),
    ('PLAN_COMPLIANCE', 'AO_EXTENDED_AUDIT_TRAIL'),
    ('PLAN_COMPLIANCE', 'AO_CLIENT_READY_COMPLIANCE_REPORT'),
    ('PLAN_COMPLIANCE', 'AO_ANALYTICS_BACKLOG_TRENDS');
