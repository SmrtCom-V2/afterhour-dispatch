-- FM After-Hours Dispatch System - MVP Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE ENTITIES
-- ============================================

-- FM Company (the client using this system)
CREATE TABLE fm_company (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL UNIQUE, -- Inbound number for this FM
    ai_confidence_threshold INTEGER DEFAULT 80 CHECK (ai_confidence_threshold >= 0 AND ai_confidence_threshold <= 100),
    fm_oncall_phone VARCHAR(50) NOT NULL, -- SMS escalation target
    fm_oncall_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
    past_due_since TIMESTAMP WITH TIME ZONE,
    trial_start_at TIMESTAMP WITH TIME ZONE,
    trial_end_at TIMESTAMP WITH TIME ZONE,
    paid_start_at TIMESTAMP WITH TIME ZONE,
    current_period_end_at TIMESTAMP WITH TIME ZONE,
    plan_id UUID,
    seats_limit INTEGER DEFAULT 0,
    seats_used INTEGER DEFAULT 0,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    owner_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FM Admin User (single admin per FM company in MVP)
CREATE TABLE fm_admin (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fm_company_id UUID NOT NULL REFERENCES fm_company(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    token_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PM Company (Property Management - logical entity, no login)
CREATE TABLE pm_company (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fm_company_id UUID NOT NULL REFERENCES fm_company(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255), -- For morning reports
    contact_phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Building
CREATE TABLE building (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pm_company_id UUID NOT NULL REFERENCES pm_company(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500) NOT NULL,
    city VARCHAR(255),
    ai_confidence_override INTEGER CHECK (ai_confidence_override >= 0 AND ai_confidence_override <= 100),
    -- After-hours schedule (simplified for MVP: same every day)
    afterhours_start TIME DEFAULT '18:00',
    afterhours_end TIME DEFAULT '07:00',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tenant (for verification only)
CREATE TABLE tenant (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID NOT NULL REFERENCES building(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    unit VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for tenant verification lookup
CREATE INDEX idx_tenant_phone ON tenant(phone);
CREATE INDEX idx_tenant_building_name ON tenant(building_id, LOWER(name));

-- Service Provider
CREATE TABLE service_provider (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fm_company_id UUID NOT NULL REFERENCES fm_company(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    trade VARCHAR(100) NOT NULL, -- plumber, electrician, locksmith, general, etc.
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Building <-> Service Provider assignment (with priority per trade)
CREATE TABLE building_service_provider (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID NOT NULL REFERENCES building(id) ON DELETE CASCADE,
    service_provider_id UUID NOT NULL REFERENCES service_provider(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 1, -- Lower = higher priority
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(building_id, service_provider_id)
);

CREATE INDEX idx_bsp_building_priority ON building_service_provider(building_id, priority);

-- ============================================
-- INCIDENT TRACKING
-- ============================================

-- Call record (every inbound call)
CREATE TABLE call (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fm_company_id UUID NOT NULL REFERENCES fm_company(id),
    caller_phone VARCHAR(50) NOT NULL,
    call_provider_id VARCHAR(255), -- External call ID from telephony provider
    language VARCHAR(10) DEFAULT 'de', -- de or en
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    transcript TEXT,
    end_reason VARCHAR(30), -- added live July 26 (ALTER TABLE) for voice-gateway call closeout
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Incident (created when a call identifies a potential issue)
CREATE TABLE incident (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES call(id),
    building_id UUID REFERENCES building(id),
    tenant_id UUID REFERENCES tenant(id),

    -- Tenant info (captured during call, even if no match)
    tenant_name_given VARCHAR(255),
    tenant_phone_given VARCHAR(50),
    tenant_address_given VARCHAR(500),
    tenant_unit_given VARCHAR(50),

    -- Verification
    verification_status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'verified', 'partial_match', 'failed')),

    -- Issue classification
    issue_category VARCHAR(100), -- water_leak, fire, smoke, gas_smell, total_power_outage, lockout, other
    issue_description TEXT,
    guided_answers JSONB, -- Stores answers to guided questions

    -- AI Classification
    ai_confidence INTEGER CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
    classification_reason TEXT,

    -- Decision
    is_emergency BOOLEAN,
    decision VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (decision IN ('pending', 'emergency_dispatch', 'not_emergency', 'unclear_escalated', 'verification_failed')),
    decision_at TIMESTAMP WITH TIME ZONE,

    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'sp_dispatched', 'sp_accepted', 'sp_completed', 'closed', 'no_sp_available', 'escalated_to_fm')),

    -- Final SP (if dispatched)
    assigned_sp_id UUID REFERENCES service_provider(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_incident_status ON incident(status);
CREATE INDEX idx_incident_created ON incident(created_at);
CREATE INDEX idx_incident_building ON incident(building_id);

-- Dispatch attempt (each try to reach an SP)
CREATE TABLE dispatch_attempt (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
    service_provider_id UUID NOT NULL REFERENCES service_provider(id),

    -- Attempt tracking
    attempt_number INTEGER NOT NULL,
    method VARCHAR(20) NOT NULL CHECK (method IN ('call', 'sms')),

    -- Call/SMS details
    provider_message_id VARCHAR(255), -- External ID from telephony provider
    message_content TEXT, -- For SMS: the actual message sent

    -- Response
    response VARCHAR(30) CHECK (response IN ('accepted', 'declined', 'no_answer', 'timeout', 'pending')),
    response_at TIMESTAMP WITH TIME ZONE,
    dtmf_input VARCHAR(10), -- For call: 1=accept, 2=decline

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    timeout_at TIMESTAMP WITH TIME ZONE, -- When this attempt expires

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dispatch_incident ON dispatch_attempt(incident_id);
CREATE INDEX idx_dispatch_pending ON dispatch_attempt(response) WHERE response = 'pending';

-- ============================================
-- SP REPORT
-- ============================================

-- SP Report (one-time link, no account needed)
CREATE TABLE sp_report (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
    service_provider_id UUID NOT NULL REFERENCES service_provider(id),

    -- Secure link token
    token VARCHAR(255) NOT NULL UNIQUE,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Report content
    description TEXT,
    finish_time TIMESTAMP WITH TIME ZONE, -- Entered by SP
    submitted_at TIMESTAMP WITH TIME ZONE, -- Actual submission time

    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'submitted', 'missing', 'flagged_unpaid')),

    -- Reminders
    reminder_sent_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sp_report_token ON sp_report(token);
CREATE INDEX idx_sp_report_status ON sp_report(status);

-- SP Report Attachments (photos)
CREATE TABLE sp_report_attachment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sp_report_id UUID NOT NULL REFERENCES sp_report(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TIMELINE / AUDIT LOG
-- ============================================

-- Incident timeline (audit trail)
CREATE TABLE incident_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_timeline_incident ON incident_timeline(incident_id, created_at);

-- ============================================
-- MORNING REPORT TRACKING
-- ============================================

CREATE TABLE morning_report (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pm_company_id UUID NOT NULL REFERENCES pm_company(id),
    report_date DATE NOT NULL,
    incidents_included UUID[] NOT NULL, -- Array of incident IDs
    pdf_path VARCHAR(500),
    sent_at TIMESTAMP WITH TIME ZONE,
    sent_to VARCHAR(255), -- Email address
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_morning_report_date ON morning_report(pm_company_id, report_date);

-- ============================================
-- SUPER ADMIN PLATFORM DATA
-- ============================================

CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    limits JSONB DEFAULT '{}'::jsonb,
    features JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE company_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES fm_company(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    actor_type VARCHAR(30) NOT NULL,
    actor_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_company_events_company ON company_events(company_id, created_at);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_admin_id UUID NOT NULL REFERENCES fm_admin(id) ON DELETE CASCADE,
    company_id UUID REFERENCES fm_company(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    ip VARCHAR(64),
    user_agent VARCHAR(255),
    before JSONB,
    after JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_company ON audit_log(company_id, created_at);

CREATE TABLE support_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES fm_company(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES fm_admin(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_support_notes_company ON support_notes(company_id, created_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_fm_company_updated_at BEFORE UPDATE ON fm_company FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fm_admin_updated_at BEFORE UPDATE ON fm_admin FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pm_company_updated_at BEFORE UPDATE ON pm_company FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_building_updated_at BEFORE UPDATE ON building FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_updated_at BEFORE UPDATE ON tenant FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_provider_updated_at BEFORE UPDATE ON service_provider FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_incident_updated_at BEFORE UPDATE ON incident FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sp_report_updated_at BEFORE UPDATE ON sp_report FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
