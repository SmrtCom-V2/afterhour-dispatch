-- Gives the on-call person (often not a trade professional) real signal
-- beyond a bare priority number when choosing which service provider to
-- call at 2am: a short usage note ("24/7 emergency line, ~30min arrival"
-- vs "business hours only") and availability hours so the app can flag or
-- skip a provider that's definitely unreachable right now.
ALTER TABLE service_provider
  ADD COLUMN IF NOT EXISTS usage_note TEXT,
  ADD COLUMN IF NOT EXISTS available_24h BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_from TIME,
  ADD COLUMN IF NOT EXISTS available_to TIME;

COMMENT ON COLUMN service_provider.usage_note IS 'Short guidance for the on-call person, e.g. "24/7 emergency line" or "business hours only, use as backup"';
COMMENT ON COLUMN service_provider.available_24h IS 'true = always available (default, matches prior behavior); false = only during available_from/available_to';
COMMENT ON COLUMN service_provider.available_from IS 'Local time availability window start, only used when available_24h = false';
COMMENT ON COLUMN service_provider.available_to IS 'Local time availability window end, only used when available_24h = false';
