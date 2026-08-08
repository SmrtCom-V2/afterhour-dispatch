-- Follow-up to Blocker #1 (add_phone_pii_encryption.sql) and Blocker #4
-- (access-code encryption, 002_update_schema.sql): both encrypted formats
-- ("enc:<iv>:<authTag>:<ciphertext>", all base64) run 54-70+ characters for
-- even a short plaintext value, but every column that stores one was sized
-- VARCHAR(50) for the original plaintext length. Caught live (2026-08-08)
-- when a backfill of existing phone numbers hit "value too long for type
-- character varying(50)" — same failure would happen to any FM saving a
-- building access code right now, since encryptAccessCode('1234') alone is
-- already 54 chars. No building had an access code set yet, so nothing was
-- silently truncated/lost, but this needed fixing before any real save.
ALTER TABLE tenant ALTER COLUMN phone TYPE VARCHAR(255);
ALTER TABLE call ALTER COLUMN caller_phone TYPE VARCHAR(255);
ALTER TABLE incident ALTER COLUMN tenant_phone_given TYPE VARCHAR(255);
ALTER TABLE building ALTER COLUMN key_safe_code TYPE VARCHAR(255);
ALTER TABLE building ALTER COLUMN gate_code TYPE VARCHAR(255);
ALTER TABLE building ALTER COLUMN main_entrance_code TYPE VARCHAR(255);
