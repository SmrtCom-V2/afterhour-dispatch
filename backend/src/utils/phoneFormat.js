/**
 * Light phone formatting for CALL ROUTING (not verification/hashing — that's
 * piiCrypto.js). The routing resolver matches pm_company.service_phone against
 * Twilio's To= field, which Twilio always delivers in strict E.164 (+49...).
 *
 * We never *construct* an E.164 number here — numbers we route on come from
 * Twilio's own purchase response and are already E.164. This just:
 *   - trims/collapses whitespace on write
 *   - gives the resolver a tolerant comparison so a stray space or a leading
 *     "00" instead of "+" doesn't silently fail to match a real customer.
 *
 * No libphonenumber dependency — deliberately minimal.
 */

/** Canonical form for storage: trim, strip spaces, "00" prefix -> "+". */
export function toE164(raw) {
  if (raw === null || raw === undefined) return raw;
  let s = String(raw).trim().replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  return s;
}

/** True if the string looks like a valid E.164 number (+ then 8–15 digits). */
export function isE164(raw) {
  return /^\+[1-9]\d{7,14}$/.test(toE164(raw || ''));
}

/**
 * Digits-only key for tolerant matching in the routing resolver. "+49 30 123",
 * "004930123", "4930123" all reduce to the same key.
 */
export function routingKey(raw) {
  return String(raw ?? '').replace(/\D/g, '');
}

export default { toE164, isE164, routingKey };
