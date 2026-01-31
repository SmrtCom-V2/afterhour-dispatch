-- Migration 002: Update schema for full FM Admin Panel
-- Run after initial schema

-- ============================================
-- UPDATE PM_COMPANY - Add service phone and more contact info
-- ============================================
ALTER TABLE pm_company ADD COLUMN IF NOT EXISTS service_phone VARCHAR(50); -- The after-hours hotline tenants call
ALTER TABLE pm_company ADD COLUMN IF NOT EXISTS address VARCHAR(500);
ALTER TABLE pm_company ADD COLUMN IF NOT EXISTS city VARCHAR(255);
ALTER TABLE pm_company ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE pm_company ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Germany';
ALTER TABLE pm_company ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);
ALTER TABLE pm_company ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE pm_company ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- AI/Rules settings per PM
ALTER TABLE pm_company ADD COLUMN IF NOT EXISTS ai_confidence_threshold INTEGER DEFAULT 80 CHECK (ai_confidence_threshold >= 0 AND ai_confidence_threshold <= 100);
ALTER TABLE pm_company ADD COLUMN IF NOT EXISTS emergency_rules JSONB DEFAULT '{}'; -- Custom rules per PM
ALTER TABLE pm_company ADD COLUMN IF NOT EXISTS afterhours_start TIME DEFAULT '18:00';
ALTER TABLE pm_company ADD COLUMN IF NOT EXISTS afterhours_end TIME DEFAULT '07:00';

-- ============================================
-- UPDATE SERVICE_PROVIDER - Move to PM Company level
-- ============================================
-- Add pm_company_id to service_provider (SPs belong to PM, not FM)
ALTER TABLE service_provider ADD COLUMN IF NOT EXISTS pm_company_id UUID REFERENCES pm_company(id) ON DELETE CASCADE;

-- Additional SP fields
ALTER TABLE service_provider ADD COLUMN IF NOT EXISTS address VARCHAR(500);
ALTER TABLE service_provider ADD COLUMN IF NOT EXISTS city VARCHAR(255);
ALTER TABLE service_provider ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE service_provider ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE service_provider ADD COLUMN IF NOT EXISTS availability JSONB DEFAULT '{}'; -- Working hours, days
ALTER TABLE service_provider ADD COLUMN IF NOT EXISTS trades TEXT[]; -- Multiple trades possible

-- ============================================
-- UPDATE BUILDING - Add comprehensive property fields
-- ============================================
ALTER TABLE building ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE building ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Germany';

-- Building structure
ALTER TABLE building ADD COLUMN IF NOT EXISTS building_type VARCHAR(50) DEFAULT 'residential' CHECK (building_type IN ('residential', 'commercial', 'mixed', 'industrial'));
ALTER TABLE building ADD COLUMN IF NOT EXISTS total_units INTEGER;
ALTER TABLE building ADD COLUMN IF NOT EXISTS total_floors INTEGER;
ALTER TABLE building ADD COLUMN IF NOT EXISTS has_basement BOOLEAN DEFAULT FALSE;
ALTER TABLE building ADD COLUMN IF NOT EXISTS basement_floors INTEGER DEFAULT 0;
ALTER TABLE building ADD COLUMN IF NOT EXISTS has_penthouse BOOLEAN DEFAULT FALSE;
ALTER TABLE building ADD COLUMN IF NOT EXISTS num_entrances INTEGER DEFAULT 1;
ALTER TABLE building ADD COLUMN IF NOT EXISTS entrance_names TEXT[]; -- ['A', 'B', 'C'] or ['Main', 'Side']
ALTER TABLE building ADD COLUMN IF NOT EXISTS units_per_floor INTEGER;
ALTER TABLE building ADD COLUMN IF NOT EXISTS unit_numbering_format VARCHAR(100); -- e.g., 'floor-number', 'entrance-floor-number'

-- Elevator info
ALTER TABLE building ADD COLUMN IF NOT EXISTS has_elevator BOOLEAN DEFAULT FALSE;
ALTER TABLE building ADD COLUMN IF NOT EXISTS num_elevators INTEGER DEFAULT 0;

-- Parking
ALTER TABLE building ADD COLUMN IF NOT EXISTS parking_type VARCHAR(50) CHECK (parking_type IN ('none', 'street', 'underground', 'garage', 'mixed'));
ALTER TABLE building ADD COLUMN IF NOT EXISTS parking_spaces INTEGER;

-- Access & Emergency info
ALTER TABLE building ADD COLUMN IF NOT EXISTS key_safe_location TEXT;
ALTER TABLE building ADD COLUMN IF NOT EXISTS key_safe_code VARCHAR(50);
ALTER TABLE building ADD COLUMN IF NOT EXISTS gate_code VARCHAR(50);
ALTER TABLE building ADD COLUMN IF NOT EXISTS main_entrance_code VARCHAR(50);
ALTER TABLE building ADD COLUMN IF NOT EXISTS water_shutoff_location TEXT;
ALTER TABLE building ADD COLUMN IF NOT EXISTS gas_shutoff_location TEXT;
ALTER TABLE building ADD COLUMN IF NOT EXISTS electric_shutoff_location TEXT;
ALTER TABLE building ADD COLUMN IF NOT EXISTS special_access_instructions TEXT;

-- Contacts
ALTER TABLE building ADD COLUMN IF NOT EXISTS janitor_name VARCHAR(255);
ALTER TABLE building ADD COLUMN IF NOT EXISTS janitor_phone VARCHAR(50);
ALTER TABLE building ADD COLUMN IF NOT EXISTS janitor_email VARCHAR(255);
ALTER TABLE building ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE building ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);

-- Service notes
ALTER TABLE building ADD COLUMN IF NOT EXISTS special_instructions TEXT;
ALTER TABLE building ADD COLUMN IF NOT EXISTS known_issues TEXT;
ALTER TABLE building ADD COLUMN IF NOT EXISTS notes TEXT;

-- Status
ALTER TABLE building ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- ============================================
-- UPDATE TENANT - Add more fields
-- ============================================
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS floor INTEGER;
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS entrance VARCHAR(50);
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS move_in_date DATE;
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS move_out_date DATE;
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS language_preference VARCHAR(10) DEFAULT 'de';
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS secondary_phone VARCHAR(50);
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS household_size INTEGER;

-- ============================================
-- NEW TABLE: FM_EMPLOYEE - Staff of the FM company
-- ============================================
CREATE TABLE IF NOT EXISTS fm_employee (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fm_company_id UUID NOT NULL REFERENCES fm_company(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    role VARCHAR(100), -- 'dispatcher', 'manager', 'technician', etc.
    is_active BOOLEAN DEFAULT TRUE,
    can_be_oncall BOOLEAN DEFAULT TRUE, -- Can this employee be on-call?
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fm_employee_company ON fm_employee(fm_company_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_fm_employee_updated_at ON fm_employee;
CREATE TRIGGER update_fm_employee_updated_at BEFORE UPDATE ON fm_employee FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NEW TABLE: ON_CALL_SCHEDULE - Who holds the phone when
-- ============================================
CREATE TABLE IF NOT EXISTS on_call_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fm_company_id UUID NOT NULL REFERENCES fm_company(id) ON DELETE CASCADE,
    fm_employee_id UUID NOT NULL REFERENCES fm_employee(id) ON DELETE CASCADE,

    -- Schedule type: recurring or one-time
    schedule_type VARCHAR(20) NOT NULL DEFAULT 'recurring' CHECK (schedule_type IN ('recurring', 'one_time')),

    -- For recurring schedules
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- For one-time schedules (overrides)
    specific_date DATE,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Priority (for conflicts)
    priority INTEGER DEFAULT 1, -- Lower = higher priority

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oncall_company ON on_call_schedule(fm_company_id);
CREATE INDEX IF NOT EXISTS idx_oncall_employee ON on_call_schedule(fm_employee_id);
CREATE INDEX IF NOT EXISTS idx_oncall_day ON on_call_schedule(day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_oncall_date ON on_call_schedule(specific_date);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_on_call_schedule_updated_at ON on_call_schedule;
CREATE TRIGGER update_on_call_schedule_updated_at BEFORE UPDATE ON on_call_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INDEXES FOR NEW COLUMNS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_pm_company_service_phone ON pm_company(service_phone);
CREATE INDEX IF NOT EXISTS idx_sp_pm_company ON service_provider(pm_company_id);
CREATE INDEX IF NOT EXISTS idx_building_status ON building(status);
CREATE INDEX IF NOT EXISTS idx_tenant_email ON tenant(email);
