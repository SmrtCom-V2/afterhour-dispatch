-- Adds session revocation on password change.
-- Run manually against the live DB (this codebase has no migration runner —
-- schema changes are applied by hand, per web-system deploy process).
ALTER TABLE fm_admin ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;
