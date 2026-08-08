-- Blocker #1 (2026-08-08 Go/No-Go audit): tenant.phone, call.caller_phone,
-- and incident.tenant_phone_given were stored as plain VARCHAR — anyone with
-- DB read access (a leak, a compromised backup, an insider) could read every
-- caller's real phone number. Same exposure class as Blocker #4 (building
-- access codes), now closed the same way (see accessCodeCrypto.js /
-- piiCrypto.js): app-level AES-256-GCM for the stored value.
--
-- Phone numbers differ from access codes in one way that matters: they're
-- looked up by exact match (callFlow.js:109, matching an inbound caller to
-- a known tenant during a live emergency call), and AES-GCM ciphertext is
-- non-deterministic — the same number encrypts to a different value every
-- time, so `WHERE phone = $1` against an encrypted column would never match.
-- idx_tenant_phone_hash below backs that lookup instead, storing a
-- deterministic HMAC-SHA256 of the normalized number (see hashPhone() in
-- piiCrypto.js) rather than the number itself.
--
-- Existing plaintext rows are left as-is here (application code's
-- decryptAccessCode already passes through anything not in "enc:" format
-- unchanged, same backfill-safety pattern as Blocker #4) — new/updated rows
-- get encrypted going forward from the app-code change that accompanies
-- this migration. A backfill of historical rows is a separate, explicit
-- follow-up (needs to run outside a request, at pilot scale it's a handful
-- of rows) and is intentionally not done inline in this migration.

ALTER TABLE tenant ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(64);
ALTER TABLE call ADD COLUMN IF NOT EXISTS caller_phone_hash VARCHAR(64);
ALTER TABLE incident ADD COLUMN IF NOT EXISTS tenant_phone_given_hash VARCHAR(64);

-- Replaces idx_tenant_phone (schema.sql:88, indexed the now-encrypted plaintext
-- column and is no longer useful for lookup) with an index on the hash instead.
DROP INDEX IF EXISTS idx_tenant_phone;
CREATE INDEX IF NOT EXISTS idx_tenant_phone_hash ON tenant(phone_hash);
