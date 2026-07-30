-- Add table to manage super admin allowlist and metadata column for audit logs

CREATE TABLE IF NOT EXISTS super_admin_allowlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add metadata column to audit_log if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_log' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE audit_log ADD COLUMN metadata JSONB DEFAULT NULL;
    END IF;
END $$;
