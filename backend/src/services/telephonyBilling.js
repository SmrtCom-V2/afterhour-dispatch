/**
 * Telephony add-on billing — the "Dedicated number" Stripe line item.
 * Spec: AFTERHOUR_PHONE_NUMBER_PROVISIONING_SPEC.md §1c
 *
 * Customer price: €4.99/mo per active provisioned number (Ron, 2026-09-01).
 * BYO-forward numbers carry NO charge (the hidden forward-target DID is
 * absorbed into plan margin).
 *
 * Implementation: a second recurring subscription_item on the customer's
 * existing Stripe subscription, with `quantity` = number of billable
 * dedicated numbers. Added when the first dedicated number goes active,
 * quantity bumped for each extra, removed entirely when the last one is
 * released.
 *
 * Requires:
 *   STRIPE_SECRET_KEY
 *   STRIPE_PRICE_ID_DEDICATED_NUMBER  — recurring Price, €4.99/mo, EUR
 *
 * All functions are best-effort + no-throw at the callsite's option: a
 * billing hiccup must never leave a customer without a working emergency
 * line. Callers log the returned {ok,error} and continue.
 */

import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

let stripe = null;
async function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    const Stripe = (await import('stripe')).default;
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

const DEDICATED_NUMBER_PRICE_ID = () => process.env.STRIPE_PRICE_ID_DEDICATED_NUMBER || null;

/** Displayed monthly price of a dedicated number, in cents. Single source of truth for the UI. */
export const DEDICATED_NUMBER_PRICE_CENTS = parseInt(
  process.env.TELEPHONY_DEDICATED_NUMBER_PRICE_CENTS || '499',
  10
);

export function isTelephonyBillingConfigured() {
  return !!process.env.STRIPE_SECRET_KEY && !!DEDICATED_NUMBER_PRICE_ID();
}

/**
 * How many billable (telephony_model='provisioned', status active/provisioning)
 * numbers does this FM currently have?
 */
async function billableNumberCount(fmCompanyId, client = db) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS n
     FROM provisioned_number pn
     JOIN pm_company pm ON pm.id = pn.pm_company_id
     WHERE pn.fm_company_id = $1
       AND pn.status = 'active'
       AND pm.telephony_model = 'provisioned'`,
    [fmCompanyId]
  );
  return r.rows[0].n;
}

/** Find the FM's Stripe subscription id (from the subscriptions table). */
async function getStripeSubscriptionId(fmCompanyId) {
  const r = await db.query(
    `SELECT stripe_subscription_id, stripe_customer_id
     FROM subscriptions WHERE company_id = $1`,
    [fmCompanyId]
  );
  return r.rows[0] || null;
}

/**
 * Sync the dedicated-number line item on the FM's subscription to match the
 * current billable count. Called after provision and after release.
 *
 * During a trial (no active Stripe subscription yet) this is a no-op — the
 * charge starts when they convert (checkout adds the line item then, see
 * §4.0 of the spec / the checkout route).
 *
 * @returns {Promise<{ok:boolean, action?:string, quantity?:number, error?:string}>}
 */
export async function syncDedicatedNumberBilling(fmCompanyId) {
  try {
    if (!isTelephonyBillingConfigured()) {
      return { ok: false, error: 'telephony billing not configured (no STRIPE_PRICE_ID_DEDICATED_NUMBER)' };
    }
    const s = await getStripe();
    const sub = await getStripeSubscriptionId(fmCompanyId);
    if (!sub || !sub.stripe_subscription_id) {
      // Trial / not yet paying — nothing to bill against. Recorded on the
      // provisioned_number row so the checkout flow picks it up on conversion.
      return { ok: true, action: 'deferred_to_checkout', quantity: await billableNumberCount(fmCompanyId) };
    }

    const wantQty = await billableNumberCount(fmCompanyId);
    const priceId = DEDICATED_NUMBER_PRICE_ID();

    const stripeSub = await s.subscriptions.retrieve(sub.stripe_subscription_id);
    const existingItem = stripeSub.items.data.find((it) => it.price?.id === priceId);

    let action;
    if (wantQty === 0 && existingItem) {
      await s.subscriptionItems.del(existingItem.id, { proration_behavior: 'create_prorations' });
      action = 'removed';
    } else if (wantQty > 0 && !existingItem) {
      await s.subscriptionItems.create({
        subscription: sub.stripe_subscription_id,
        price: priceId,
        quantity: wantQty,
        proration_behavior: 'create_prorations',
      });
      action = 'added';
    } else if (wantQty > 0 && existingItem && existingItem.quantity !== wantQty) {
      await s.subscriptionItems.update(existingItem.id, {
        quantity: wantQty,
        proration_behavior: 'create_prorations',
      });
      action = 'quantity_updated';
    } else {
      action = 'no_change';
    }

    // Stamp the subscription_item id onto this FM's active provisioned rows
    // so release / audit can see it.
    if (action !== 'removed') {
      const item = existingItem || (await s.subscriptions.retrieve(sub.stripe_subscription_id))
        .items.data.find((it) => it.price?.id === priceId);
      if (item) {
        await db.query(
          `UPDATE provisioned_number
             SET stripe_subscription_item_id = $1, billed_cents = $2
           WHERE fm_company_id = $3 AND status = 'active'
             AND pm_company_id IN (SELECT id FROM pm_company WHERE telephony_model = 'provisioned')`,
          [item.id, DEDICATED_NUMBER_PRICE_CENTS, fmCompanyId]
        );
      }
    } else {
      await db.query(
        `UPDATE provisioned_number SET stripe_subscription_item_id = NULL
         WHERE fm_company_id = $1`,
        [fmCompanyId]
      );
    }

    logger.info('Dedicated-number billing synced', { fmCompanyId, wantQty, action });
    return { ok: true, action, quantity: wantQty };
  } catch (error) {
    logger.error('syncDedicatedNumberBilling failed', { fmCompanyId, error: error.message });
    return { ok: false, error: error.message };
  }
}

/**
 * Build the extra checkout line item for a NEW signup that chose a dedicated
 * number. The main plan line item is added by the caller; this returns the
 * add-on line to append.
 * @returns {{price:string, quantity:number}|null}
 */
export function dedicatedNumberCheckoutLineItem() {
  const priceId = DEDICATED_NUMBER_PRICE_ID();
  if (!priceId) return null;
  return { price: priceId, quantity: 1 };
}

export default {
  isTelephonyBillingConfigured,
  syncDedicatedNumberBilling,
  dedicatedNumberCheckoutLineItem,
  DEDICATED_NUMBER_PRICE_CENTS,
};
