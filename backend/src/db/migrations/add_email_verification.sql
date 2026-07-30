-- Email verification for signup flow
-- Adds email_verified column to fm_admin and creates verification tokens table

-- Add email_verified column to fm_admin
ALTER TABLE fm_admin
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Create email verification tokens table
CREATE TABLE IF NOT EXISTS email_verification_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token VARCHAR(6) NOT NULL, -- 6-digit code
  fm_company_id UUID REFERENCES fm_company(id) ON DELETE CASCADE,
  -- Store pending registration data
  pending_data JSONB,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick token lookup
CREATE INDEX IF NOT EXISTS idx_email_verification_token_email ON email_verification_token(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_token_token ON email_verification_token(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_token_expires ON email_verification_token(expires_at);

-- Clean up expired tokens (can be run periodically)
-- DELETE FROM email_verification_token WHERE expires_at < NOW();
