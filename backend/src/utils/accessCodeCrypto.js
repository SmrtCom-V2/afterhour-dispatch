/**
 * Blocker #4 (2026-08-08 Go/No-Go audit): building.key_safe_code,
 * gate_code, main_entrance_code were stored as plain VARCHAR — anyone with
 * DB read access (a leak, a compromised backup, an insider) could read the
 * literal codes that open a client building. pgcrypto is NOT enabled on
 * this DB (see wakeupEngine.js's createCockpitToken comment), so this is
 * app-level AES-256-GCM instead of a Postgres-side pgcrypto column.
 *
 * Option A (Ron's call, Aug 8): key lives in an env var, same pattern as
 * RETELL_WEBHOOK_SECRET/VOICE_WS_AUTH_TOKEN elsewhere in this system — not
 * KMS/Secrets Manager (deferred to post-pilot, real client scale).
 */
import crypto from 'crypto';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard nonce size

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;

  const secret = process.env.ACCESS_CODE_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      'ACCESS_CODE_ENCRYPTION_KEY environment variable is required and must not be empty ' +
      '(encrypts building key-safe/gate/entrance codes at rest).'
    );
  }

  // Accept either a 32-byte hex string (64 chars) or derive one via SHA-256
  // from an arbitrary passphrase — hex is the recommended format
  // (openssl rand -hex 32) but this avoids a hard failure on a shorter
  // human-chosen value during initial setup.
  cachedKey = /^[0-9a-fA-F]{64}$/.test(secret)
    ? Buffer.from(secret, 'hex')
    : crypto.createHash('sha256').update(secret).digest();

  return cachedKey;
}

/**
 * Returns null unchanged (a building with no gate code stays NULL, not an
 * encrypted-empty-string) so COALESCE($n, gate_code)-style partial updates
 * in buildings.js keep working exactly as before.
 */
export function encryptAccessCode(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // iv:authTag:ciphertext, all base64 — self-contained, no separate column needed.
  return `enc:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Passes through anything not in our "enc:" format unchanged — this is what
 * makes the migration safe for pre-existing plaintext rows written before
 * this fix deployed (see backfill note in the migration file). Logs (never
 * throws) on a decrypt failure — a corrupted/foreign-format value must not
 * 500 the whole incident/building page, just surface as unreadable.
 */
export function decryptAccessCode(stored) {
  if (stored === null || stored === undefined || stored === '') return stored;
  if (!stored.startsWith('enc:')) return stored; // pre-migration plaintext, or already decrypted

  try {
    const [, ivB64, authTagB64, dataB64] = stored.split(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    logger.error('Failed to decrypt access code — returning as unreadable', { error: error.message });
    return '[unreadable]';
  }
}
