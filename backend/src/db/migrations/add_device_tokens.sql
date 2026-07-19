-- Device tokens for push notifications (mobile companion app). One
-- fm_admin can have multiple devices; a token is replaced, not duplicated,
-- when the same device re-registers (app reinstall, token refresh).
CREATE TABLE IF NOT EXISTS device_token (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fm_admin_id UUID NOT NULL REFERENCES fm_admin(id) ON DELETE CASCADE,
  fcm_token VARCHAR(255) NOT NULL UNIQUE,
  platform VARCHAR(20) NOT NULL DEFAULT 'android',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_token_admin ON device_token(fm_admin_id);
