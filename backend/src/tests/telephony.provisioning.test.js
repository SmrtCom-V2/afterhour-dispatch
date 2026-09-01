/**
 * Unit tests for the number-provisioning support code.
 * Pure-function coverage only — the Twilio-touching parts (purchaseNumber,
 * searchAvailableNumbers, releaseNumber) are integration-tested against a
 * Twilio test account in the E2E pass, not here.
 */

import { toE164, isE164, routingKey } from '../utils/phoneFormat.js';
import { CARRIER_FORWARDING } from '../data/carrierForwarding.js';
import { purchaseNumber, isPurchaseEnabled } from '../providers/telephony/provisioning.js';

describe('phoneFormat.toE164', () => {
  test('trims and strips separators', () => {
    expect(toE164('+49 30 8268 2640')).toBe('+493082682640');
    expect(toE164('+49-30-8268.2640')).toBe('+493082682640');
    expect(toE164('  +493082682640 ')).toBe('+493082682640');
  });
  test('converts 00 international prefix to +', () => {
    expect(toE164('004930123456')).toBe('+4930123456');
  });
  test('passes null/undefined through untouched', () => {
    expect(toE164(null)).toBeNull();
    expect(toE164(undefined)).toBeUndefined();
  });
  test('leaves a national 0-number as-is (we never fabricate a country code)', () => {
    expect(toE164('030 12345')).toBe('03012345');
  });
});

describe('phoneFormat.isE164', () => {
  test('accepts real E.164 numbers', () => {
    expect(isE164('+493082682640')).toBe(true);
    expect(isE164('+4932213456789')).toBe(true);
    expect(isE164('+1 202 555 0100')).toBe(true); // separators tolerated via toE164
  });
  test('rejects non-E.164', () => {
    expect(isE164('03012345')).toBe(false);      // no +
    expect(isE164('+0123456789')).toBe(false);    // leading zero after +
    expect(isE164('+49')).toBe(false);            // too short
    expect(isE164('')).toBe(false);
    expect(isE164('not a number')).toBe(false);
  });
});

describe('phoneFormat.routingKey', () => {
  test('reduces any format to the same digit string', () => {
    expect(routingKey('+49 30 123')).toBe('4930123');
    expect(routingKey('004930123')).toBe('004930123'); // 00 not stripped here (digits only)
    expect(routingKey('+493082682640')).toBe('493082682640');
  });
  test('handles null/undefined', () => {
    expect(routingKey(null)).toBe('');
    expect(routingKey(undefined)).toBe('');
  });
});

describe('purchase kill-switch', () => {
  test('isPurchaseEnabled is false in the test env (TELEPHONY_PURCHASE_ENABLED not "true")', () => {
    expect(isPurchaseEnabled()).toBe(false);
  });

  test('purchaseNumber throws (never reaches Twilio) while the kill-switch is off', async () => {
    await expect(purchaseNumber({ phoneNumber: '+493000000000' }))
      .rejects.toThrow(/PURCHASE BLOCKED/);
  });
});

describe('carrierForwarding data', () => {
  test('has both de and en with the same carrier ids', () => {
    const deIds = CARRIER_FORWARDING.de.map((c) => c.id).sort();
    const enIds = CARRIER_FORWARDING.en.map((c) => c.id).sort();
    expect(deIds).toEqual(enIds);
    expect(deIds.length).toBeGreaterThanOrEqual(6);
  });
  test('every carrier has a name and at least one step, each step references the forward-to placeholder or is portal-based', () => {
    for (const lang of ['de', 'en']) {
      for (const c of CARRIER_FORWARDING[lang]) {
        expect(typeof c.name).toBe('string');
        expect(c.name.length).toBeGreaterThan(0);
        expect(Array.isArray(c.steps)).toBe(true);
        expect(c.steps.length).toBeGreaterThan(0);
      }
    }
  });
  test('at least one mobile carrier gives the *61* conditional-forward GSM code', () => {
    const hasGsm = CARRIER_FORWARDING.de.some((c) =>
      c.steps.some((s) => s.includes('*61*{FORWARD_TO}#'))
    );
    expect(hasGsm).toBe(true);
  });
});
