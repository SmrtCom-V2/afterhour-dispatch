/**
 * Number Provisioning — Twilio DID lifecycle
 * Spec: AFTERHOUR_PHONE_NUMBER_PROVISIONING_SPEC.md
 *
 * Buys, configures, and releases the dedicated after-hours numbers that
 * tenant calls route through. Separate from providers/telephony/index.js
 * (which handles outbound dispatch calls on the one shared platform number) —
 * this module manages the pool of per-customer inbound DIDs.
 *
 * Phase 1: single shared Twilio account (no per-FM subaccounts yet — the
 * column exists on fm_company for a later move). German national numbers
 * (+49 32x) by default; the account's DE Regulatory Bundle must be approved
 * for purchases to succeed (see spec §1b).
 */

import twilio from 'twilio';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

// Voice webhook every bought number points at. This is the direct-Twilio
// Media Streams entrypoint (voice-brain-direct-twilio-poc/server.js
// `/voice/incoming`, exposed by nginx as `/poc-voice-incoming`) — NOT the
// web-system backend's own /api/webhooks. The one working test number
// (+493082682640) already points here; new numbers must match it exactly or
// calls silently fail. Overridable per-env for staging / a future rename.
const VOICE_WEBHOOK_URL =
  process.env.TWILIO_VOICE_WEBHOOK_URL || 'https://api-afterhour.smrtcom.com/poc-voice-incoming';
// The POC server has no separate status callback path; leave unset by default.
const VOICE_STATUS_CALLBACK_URL =
  process.env.TWILIO_VOICE_STATUS_CALLBACK_URL || '';

// Default country + type for new numbers. DE national (+49 32) has no
// area-code locality requirement — see spec §1b.
const DEFAULT_COUNTRY = 'DE';

// ── PURCHASE KILL-SWITCH (Ron, 2026-09-01) ───────────────────────────────
// Buying a Twilio number costs real money every month. Until we are actually
// ready to launch, NO code path may buy one — not a test, not a stray API
// call, not a QA click. purchaseNumber() throws unless ALL of these are set:
//   TELEPHONY_PURCHASE_ENABLED=true
//   TWILIO_PROVISIONING_BUNDLE_SID   (the approved DE regulatory bundle)
//   TWILIO_PROVISIONING_ADDRESS_SID  (the validated DE address)
// Searching for available numbers stays allowed (read-only, free). Flip the
// flag on ONLY at launch, after the E2E test plan is signed off.
const PROVISIONING_BUNDLE_SID = process.env.TWILIO_PROVISIONING_BUNDLE_SID || '';
const PROVISIONING_ADDRESS_SID = process.env.TWILIO_PROVISIONING_ADDRESS_SID || '';
const PURCHASE_ENABLED = process.env.TELEPHONY_PURCHASE_ENABLED === 'true';

export function isPurchaseEnabled() {
  return PURCHASE_ENABLED && !!PROVISIONING_BUNDLE_SID && !!PROVISIONING_ADDRESS_SID;
}

function assertPurchaseAllowed() {
  if (!PURCHASE_ENABLED) {
    throw new Error(
      'PURCHASE BLOCKED: TELEPHONY_PURCHASE_ENABLED is not "true". Number buying is disabled until launch — this is deliberate (see provisioning.js kill-switch).'
    );
  }
  if (!PROVISIONING_BUNDLE_SID || !PROVISIONING_ADDRESS_SID) {
    throw new Error(
      'PURCHASE BLOCKED: TWILIO_PROVISIONING_BUNDLE_SID / TWILIO_PROVISIONING_ADDRESS_SID not configured — a German number cannot be bought without an approved regulatory bundle + address.'
    );
  }
}

let _client = null;
function getClient() {
  if (_client) return _client;
  const { accountSid, authToken } = config.telephony.twilio;
  if (!accountSid || !authToken) {
    throw new Error('provisioning: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured');
  }
  _client = twilio(accountSid, authToken);
  return _client;
}

/**
 * Is provisioning usable right now? (creds present + not the mock provider)
 * Routes call this to give a clean 503 instead of a stack trace.
 */
export function isProvisioningAvailable() {
  const { provider, twilio: tw } = config.telephony;
  return provider === 'twilio' && !!tw.accountSid && !!tw.authToken;
}

/**
 * Search for available numbers.
 * @param {object} opts
 * @param {'national'|'local'|'mobile'|'tollfree'} opts.type
 * @param {string} [opts.areaCode]  e.g. '30' for Berlin (local only)
 * @param {number} [opts.limit]
 * @returns {Promise<Array<{phoneNumber, friendlyName, locality, region}>>}
 */
export async function searchAvailableNumbers({ type = 'national', areaCode, limit = 5 } = {}) {
  const client = getClient();
  const country = DEFAULT_COUNTRY;

  // Twilio SDK: availablePhoneNumbers(country).{local|national|mobile|tollFree}.list(...)
  const listKey = type === 'tollfree' ? 'tollFree' : type;
  const params = { limit, voiceEnabled: true };
  if (areaCode && type === 'local') params.areaCode = areaCode;

  const results = await client
    .availablePhoneNumbers(country)[listKey]
    .list(params);

  return results.map((r) => ({
    phoneNumber: r.phoneNumber,
    friendlyName: r.friendlyName,
    locality: r.locality || null,
    region: r.region || null,
  }));
}

/**
 * Buy one number and configure its voice webhook.
 * Does NOT touch the DB — caller records provisioned_number + binds it to a
 * pm_company inside its own transaction.
 * @returns {Promise<{sid, phoneNumber}>}
 */
export async function purchaseNumber({ phoneNumber, friendlyName }) {
  assertPurchaseAllowed(); // kill-switch — throws unless launch-enabled
  const client = getClient();

  const createParams = {
    phoneNumber,
    friendlyName: friendlyName || `AfterHour ${phoneNumber}`,
    voiceUrl: VOICE_WEBHOOK_URL,
    voiceMethod: 'POST',
    // German numbers require the approved regulatory bundle + address on file.
    bundleSid: PROVISIONING_BUNDLE_SID,
    addressSid: PROVISIONING_ADDRESS_SID,
    // No SMS handling for after-hours numbers in Phase 1.
    smsUrl: '',
  };
  if (VOICE_STATUS_CALLBACK_URL) {
    createParams.statusCallback = VOICE_STATUS_CALLBACK_URL;
    createParams.statusCallbackMethod = 'POST';
  }
  const bought = await client.incomingPhoneNumbers.create(createParams);

  logger.info('Provisioned Twilio number', { sid: bought.sid, phoneNumber: bought.phoneNumber });
  return { sid: bought.sid, phoneNumber: bought.phoneNumber };
}

/**
 * Re-point an already-owned number's webhooks (used if the voice entrypoint
 * URL ever changes, or to repair a mis-provisioned number).
 */
export async function reconfigureNumber(sid) {
  const client = getClient();
  const updateParams = { voiceUrl: VOICE_WEBHOOK_URL, voiceMethod: 'POST' };
  if (VOICE_STATUS_CALLBACK_URL) {
    updateParams.statusCallback = VOICE_STATUS_CALLBACK_URL;
    updateParams.statusCallbackMethod = 'POST';
  }
  const updated = await client.incomingPhoneNumbers(sid).update(updateParams);
  logger.info('Reconfigured Twilio number', { sid });
  return { sid: updated.sid, phoneNumber: updated.phoneNumber };
}

/**
 * Release a number back to Twilio (offboarding). Irreversible — the number
 * goes back to the pool and may be taken by anyone. Caller marks
 * provisioned_number.status='released' + clears pm_company.service_phone.
 */
export async function releaseNumber(sid) {
  const client = getClient();
  await client.incomingPhoneNumbers(sid).remove();
  logger.info('Released Twilio number', { sid });
  return { sid, released: true };
}

/**
 * Read an owned number's current config from Twilio (used by line verification
 * to confirm the voice webhook is set correctly). Returns null if not found.
 */
export async function describeNumber(sid) {
  if (!sid) return null;
  try {
    const client = getClient();
    const n = await client.incomingPhoneNumbers(sid).fetch();
    return { sid: n.sid, phoneNumber: n.phoneNumber, voiceUrl: n.voiceUrl, voiceMethod: n.voiceMethod };
  } catch (e) {
    logger.warn('describeNumber failed', { sid, error: e.message });
    return null;
  }
}

/**
 * Fetch the monthly cost of a number from Twilio's pricing API (for the
 * cost report / to set billed_cents). Best-effort — returns null on failure
 * so provisioning never blocks on pricing.
 */
export async function getMonthlyCostCents(phoneNumber) {
  try {
    const client = getClient();
    const pricing = await client.pricing.v1
      .phoneNumbers.countries(DEFAULT_COUNTRY)
      .fetch();
    const local = pricing.phoneNumberPrices?.find((p) =>
      ['local', 'national', 'mobile'].includes(p.number_type)
    );
    if (!local) return null;
    // basePrice is a per-month USD string; store cents. Currency conversion
    // is out of scope — treat as EUR-approx for Phase 1 reporting.
    return Math.round(parseFloat(local.base_price || local.current_price) * 100);
  } catch (e) {
    logger.warn('getMonthlyCostCents failed', { error: e.message });
    return null;
  }
}

export default {
  isProvisioningAvailable,
  isPurchaseEnabled,
  searchAvailableNumbers,
  purchaseNumber,
  reconfigureNumber,
  releaseNumber,
  describeNumber,
  getMonthlyCostCents,
};
