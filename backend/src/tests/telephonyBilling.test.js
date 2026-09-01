/**
 * telephonyBilling — config + line-item helpers.
 * The Stripe-touching syncDedicatedNumberBilling path is exercised in the
 * E2E pass against a Stripe test account; here we cover the pure surface.
 */

import {
  isTelephonyBillingConfigured,
  dedicatedNumberCheckoutLineItem,
  DEDICATED_NUMBER_PRICE_CENTS,
} from '../services/telephonyBilling.js';

describe('telephonyBilling config', () => {
  const OLD_ENV = { ...process.env };
  afterEach(() => { process.env = { ...OLD_ENV }; });

  test('DEDICATED_NUMBER_PRICE_CENTS is 499 (€4.99) by default', () => {
    // Module loaded with no override in the test env → the €4.99 default.
    expect(DEDICATED_NUMBER_PRICE_CENTS).toBe(499);
  });

  test('isTelephonyBillingConfigured is false without a Stripe key', () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_ID_DEDICATED_NUMBER;
    expect(isTelephonyBillingConfigured()).toBe(false);
  });

  test('isTelephonyBillingConfigured needs BOTH the key and the price id', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    delete process.env.STRIPE_PRICE_ID_DEDICATED_NUMBER;
    expect(isTelephonyBillingConfigured()).toBe(false);

    process.env.STRIPE_PRICE_ID_DEDICATED_NUMBER = 'price_123';
    expect(isTelephonyBillingConfigured()).toBe(true);
  });

  test('dedicatedNumberCheckoutLineItem: null without a price id, else {price, quantity:1}', () => {
    delete process.env.STRIPE_PRICE_ID_DEDICATED_NUMBER;
    expect(dedicatedNumberCheckoutLineItem()).toBeNull();

    process.env.STRIPE_PRICE_ID_DEDICATED_NUMBER = 'price_abc';
    expect(dedicatedNumberCheckoutLineItem()).toEqual({ price: 'price_abc', quantity: 1 });
  });
});
