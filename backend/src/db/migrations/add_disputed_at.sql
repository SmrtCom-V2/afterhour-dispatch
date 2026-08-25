-- Flags a company that has an open Stripe chargeback (charge.dispute.created),
-- so ops can see it on the company record instead of only in Stripe's dashboard.
-- Run manually against the live DB (this codebase has no migration runner).
ALTER TABLE fm_company ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMP WITH TIME ZONE;
