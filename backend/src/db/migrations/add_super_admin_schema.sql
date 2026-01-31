ALTER TABLE fm_admin
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE fm_company
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS trial_start_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_end_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS paid_start_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_period_end_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS plan_id UUID,
ADD COLUMN IF NOT EXISTS seats_limit INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS seats_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fm_company_status') THEN
        CREATE TYPE fm_company_status AS ENUM ('trial', 'active', 'past_due', 'suspended', 'cancelled');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    limits JSONB DEFAULT '{}'::jsonb,
    features JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES fm_company(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    actor_type VARCHAR(30) NOT NULL,
    actor_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_events_company ON company_events(company_id, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
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

CREATE INDEX IF NOT EXISTS idx_audit_log_company ON audit_log(company_id, created_at);
