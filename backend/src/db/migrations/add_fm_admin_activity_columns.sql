-- Add missing columns to fm_admin for user activity tracking
ALTER TABLE fm_admin
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE fm_admin
ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Create sa_audit_log table if not exists
CREATE TABLE IF NOT EXISTS sa_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_admin_id UUID,
    company_id UUID REFERENCES fm_company(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    ip VARCHAR(64),
    user_agent VARCHAR(500),
    before JSONB,
    after JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sa_audit_log_target ON sa_audit_log(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_sa_audit_log_created ON sa_audit_log(created_at);
