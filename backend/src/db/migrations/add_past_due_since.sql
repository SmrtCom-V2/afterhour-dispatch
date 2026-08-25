-- Enables a real grace period on failed payments (7 days, per Ron's decision
-- 2026-07-30) instead of blocking access on the very first failed charge.
-- Run manually against the live DB (this codebase has no migration runner).
ALTER TABLE fm_company ADD COLUMN IF NOT EXISTS past_due_since TIMESTAMP WITH TIME ZONE;
