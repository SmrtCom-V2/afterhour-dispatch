-- Blocker #3 (2026-08-08 Go/No-Go audit): a Twilio webhook retry (normal
-- network behavior, not rare) hit /incoming-call with the same CallSid
-- twice, and handleIncomingCall had no dedupe check — it just INSERTed a
-- second call + incident row every time, producing a duplicate ticket and
-- a duplicate page to the on-call worker. call_provider_id had no
-- uniqueness constraint at all before this migration.
--
-- Partial index (WHERE call_provider_id IS NOT NULL) because the column is
-- nullable and multiple legitimately-unrelated NULLs must not collide —
-- Postgres treats NULLs as distinct in a plain UNIQUE constraint anyway,
-- but being explicit here documents the intent rather than relying on that.
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_provider_id_unique
  ON call (call_provider_id)
  WHERE call_provider_id IS NOT NULL;
