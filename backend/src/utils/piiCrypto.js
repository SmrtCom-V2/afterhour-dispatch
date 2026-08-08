/**
 * Blocker #1 (2026-08-08 Go/No-Go audit): tenant.phone, call.caller_phone,
 * incident.tenant_phone_given were stored as plain VARCHAR — same exposure
 * as the access-code gap (Blocker #4), but for caller PII instead of
 * building entry codes.
 *
 * Reuses encryptAccessCode/decryptAccessCode (AES-256-GCM, same key) for
 * storage. The extra piece PII needs that access codes never did: AES-GCM
 * output is non-deterministic (random IV per call), so it can't be used in
 * a `WHERE phone = $1` lookup — and callFlow.js:109 does exactly that to
 * match an inbound caller to a known tenant during a live emergency call.
 * hashPhone() is a deterministic HMAC-SHA256 (same input -> same output,
 * but not reversible) stored alongside the encrypted value purely so that
 * lookup can still work without the DB ever holding the plaintext number.
 */
import crypto from 'crypto';
import { encryptAccessCode, decryptAccessCode } from './accessCodeCrypto.js';

let cachedHashKey = null;

function getHashKey() {
  if (cachedHashKey) return cachedHashKey;

  const secret = process.env.ACCESS_CODE_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      'ACCESS_CODE_ENCRYPTION_KEY environment variable is required and must not be empty ' +
      '(also used to derive the phone lookup-hash key).'
    );
  }

  // Separate derived key from the AES key (HMAC('phone-lookup-hash', secret))
  // so the hash key and the encryption key are not the same bytes.
  cachedHashKey = crypto.createHash('sha256').update(`phone-lookup-hash:${secret}`).digest();
  return cachedHashKey;
}

/**
 * Normalizes to digits-only before hashing so "+49 30 1234567", "0301234567",
 * and "030-1234567" all hash identically — callers/Twilio don't guarantee a
 * single consistent format, and the lookup must match regardless of formatting.
 */
function normalize(phone) {
  return String(phone).replace(/\D/g, '');
}

export function hashPhone(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return plaintext;
  return crypto.createHmac('sha256', getHashKey()).update(normalize(plaintext)).digest('hex');
}

export const encryptPhone = encryptAccessCode;
export const decryptPhone = decryptAccessCode;

// Same row-mutating convention as decryptBuildingCodes (buildings.js) — used
// everywhere a tenant/call/incident row (or a JOIN carrying their columns
// via aliases like tenant_phone, caller_phone) is sent back to a client.
// Only decrypts columns present on the row so it's safe to call on any
// SELECT shape without knowing in advance which phone columns it included.
export function decryptPiiFields(row) {
  if (!row) return row;
  if ('phone' in row) row.phone = decryptPhone(row.phone);
  if ('tenant_phone' in row) row.tenant_phone = decryptPhone(row.tenant_phone);
  if ('caller_phone' in row) row.caller_phone = decryptPhone(row.caller_phone);
  if ('tenant_phone_given' in row) row.tenant_phone_given = decryptPhone(row.tenant_phone_given);
  return row;
}
