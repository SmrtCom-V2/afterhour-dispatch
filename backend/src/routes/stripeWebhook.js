/**
 * Stripe Webhook Handler
 * Processes Stripe events for subscription management
 *
 * Required Environment Variables:
 * - STRIPE_SECRET_KEY: Your Stripe secret key
 * - STRIPE_WEBHOOK_SECRET: Webhook signing secret
 */

import { Router } from 'express';
import express from 'express';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { sendEmail } from '../utils/email.js';
import { grantAfterHourEntitlement, revokeAfterHourEntitlement } from '../services/identityService.js';
import { getFrontendUrl } from '../utils/frontendUrl.js';

const router = Router();

// Stripe requires raw body for webhook signature verification
// This must be applied BEFORE express.json() middleware
router.use(express.raw({ type: 'application/json' }));

/**
 * POST /api/stripe-webhook
 * Handle Stripe webhook events
 */
router.post('/', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    logger.warn('Stripe webhook received but not configured');
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error('Webhook signature verification failed', { error: err.message });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  logger.info('Stripe webhook received', { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        logger.info('Unhandled webhook event', { type: event.type });
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook handler error', { type: event.type, error: error.message });
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

/**
 * Handle checkout.session.completed
 */
async function handleCheckoutCompleted(session) {
  const companyId = session.metadata?.companyId;
  if (!companyId) {
    logger.warn('Checkout completed without companyId', { sessionId: session.id });
    return;
  }

  logger.info('Checkout completed', { companyId, customerId: session.customer });

  // Update subscription record
  await db.query(
    `UPDATE subscriptions SET
      stripe_subscription_id = $1,
      status = 'active',
      updated_at = NOW()
     WHERE company_id = $2`,
    [session.subscription, companyId]
  );

  // Update company status
  await db.query(
    `UPDATE fm_company SET
      status = 'active',
      paid_start_at = NOW(),
      updated_at = NOW()
     WHERE id = $1`,
    [companyId]
  );

  // Log event
  await db.query(
    `INSERT INTO company_events (company_id, type, actor_type, metadata)
     VALUES ($1, 'subscription_started', 'system', $2)`,
    [companyId, JSON.stringify({ sessionId: session.id })]
  );

  // Sprint 4: the actual "one click" moment — a real paid subscription grants
  // the shared identity-service entitlement so the cross-product nav can show
  // this company also has After Hour, the moment they check out. Best-effort:
  // if this call fails, Stripe's own webhook retry (or a manual re-run of the
  // Sprint 3 reconciliation script) recovers it — it must never fail this
  // webhook's 200 ack, since Stripe would then retry a checkout that already
  // succeeded in this product's own database.
  await grantAfterHourEntitlement(companyId, `stripe:${session.subscription}`);
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdate(subscription) {
  // Find company by customer ID
  const result = await db.query(
    'SELECT company_id FROM subscriptions WHERE stripe_customer_id = $1',
    [subscription.customer]
  );

  if (result.rows.length === 0) {
    logger.warn('Subscription update for unknown customer', { customerId: subscription.customer });
    return;
  }

  const companyId = result.rows[0].company_id;

  // Update subscription record
  await db.query(
    `UPDATE subscriptions SET
      stripe_subscription_id = $1,
      stripe_price_id = $2,
      status = $3,
      current_period_start = to_timestamp($4),
      current_period_end = to_timestamp($5),
      cancel_at_period_end = $6,
      updated_at = NOW()
     WHERE company_id = $7`,
    [
      subscription.id,
      subscription.items.data[0]?.price?.id,
      subscription.status,
      subscription.current_period_start,
      subscription.current_period_end,
      subscription.cancel_at_period_end,
      companyId
    ]
  );

  // Update company status based on subscription status
  let companyStatus = 'active';
  if (subscription.status === 'past_due') companyStatus = 'past_due';
  if (subscription.status === 'canceled') companyStatus = 'cancelled';
  if (subscription.status === 'unpaid') companyStatus = 'suspended';

  // Clear past_due_since whenever the subscription is no longer past_due —
  // covers recovery (back to active) as well as cancellation/suspension,
  // so a stale grace-period timestamp never lingers once it's no longer
  // the relevant state.
  await db.query(
    `UPDATE fm_company SET
      status = $1,
      current_period_end_at = to_timestamp($2),
      past_due_since = CASE WHEN $1 = 'past_due' THEN past_due_since ELSE NULL END,
      updated_at = NOW()
     WHERE id = $3`,
    [companyStatus, subscription.current_period_end, companyId]
  );

  logger.info('Subscription updated', { companyId, status: subscription.status });
}

/**
 * Handle subscription deleted/cancelled
 */
async function handleSubscriptionDeleted(subscription) {
  const result = await db.query(
    'SELECT company_id FROM subscriptions WHERE stripe_customer_id = $1',
    [subscription.customer]
  );

  if (result.rows.length === 0) return;

  const companyId = result.rows[0].company_id;

  await db.query(
    `UPDATE subscriptions SET
      status = 'cancelled',
      updated_at = NOW()
     WHERE company_id = $1`,
    [companyId]
  );

  await db.query(
    `UPDATE fm_company SET
      status = 'cancelled',
      updated_at = NOW()
     WHERE id = $1`,
    [companyId]
  );

  // Log event
  await db.query(
    `INSERT INTO company_events (company_id, type, actor_type, metadata)
     VALUES ($1, 'subscription_cancelled', 'system', $2)`,
    [companyId, JSON.stringify({ subscriptionId: subscription.id })]
  );

  logger.info('Subscription cancelled', { companyId });

  // Sprint 4: mirror the grant above — cancellation revokes the shared
  // entitlement too, same best-effort contract (never blocks this webhook).
  await revokeAfterHourEntitlement(companyId);
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaid(invoice) {
  const result = await db.query(
    'SELECT company_id FROM subscriptions WHERE stripe_customer_id = $1',
    [invoice.customer]
  );

  if (result.rows.length === 0) return;

  const companyId = result.rows[0].company_id;

  // Store invoice record
  await db.query(
    `INSERT INTO invoices (company_id, stripe_invoice_id, amount_paid, currency, status, invoice_url, pdf_url, period_start, period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8), to_timestamp($9))
     ON CONFLICT (stripe_invoice_id) DO UPDATE SET
       status = $5,
       amount_paid = $3`,
    [
      companyId,
      invoice.id,
      invoice.amount_paid,
      invoice.currency,
      invoice.status,
      invoice.hosted_invoice_url,
      invoice.invoice_pdf,
      invoice.period_start,
      invoice.period_end
    ]
  );

  logger.info('Invoice paid', { companyId, invoiceId: invoice.id, amount: invoice.amount_paid });
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice) {
  const result = await db.query(
    `SELECT s.company_id, fc.owner_email, fc.name as company_name
     FROM subscriptions s
     JOIN fm_company fc ON s.company_id = fc.id
     WHERE s.stripe_customer_id = $1`,
    [invoice.customer]
  );

  if (result.rows.length === 0) return;

  const { company_id, owner_email, company_name } = result.rows[0];

  // past_due_since is only set on the FIRST failure in a dunning cycle —
  // Stripe's own Smart Retries (account-level Dashboard setting, not
  // configurable from this codebase) will re-fire invoice.payment_failed on
  // each subsequent retry attempt over the retry window; COALESCE keeps the
  // grace-period clock anchored to the original failure, not restarted by
  // every retry. requireActiveSubscription.js reads this timestamp to allow
  // continued access for 7 days (Ron's decision 2026-07-30) before actually
  // blocking — status alone used to block on the very first failed charge,
  // with no grace period at all.
  await db.query(
    `UPDATE fm_company
     SET status = 'past_due',
         past_due_since = COALESCE(past_due_since, NOW()),
         updated_at = NOW()
     WHERE id = $1`,
    [company_id]
  );

  // Log event
  await db.query(
    `INSERT INTO company_events (company_id, type, actor_type, metadata)
     VALUES ($1, 'payment_failed', 'system', $2)`,
    [company_id, JSON.stringify({ invoiceId: invoice.id })]
  );

  // Send notification email
  if (owner_email) {
    try {
      await sendEmail({
        to: owner_email,
        subject: 'Payment Failed - 24-7 Dispatch',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #EF4444, #DC2626); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Payment Failed</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <p style="color: #475569; line-height: 1.6;">
                Hi,
              </p>
              <p style="color: #475569; line-height: 1.6;">
                We were unable to process your payment for <strong>${company_name}</strong>.
              </p>
              <p style="color: #475569; line-height: 1.6;">
                Your account stays active for 7 days while we retry the charge — please update your payment method before then to avoid any interruption.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${getFrontendUrl()}/settings" style="
                  display: inline-block;
                  background: #3B82F6;
                  color: white;
                  padding: 14px 32px;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                ">Update Payment Method</a>
              </div>
            </div>
          </div>
        `
      });
    } catch (error) {
      logger.error('Failed to send payment failure email', { error: error.message });
    }
  }

  logger.warn('Invoice payment failed', { companyId: company_id, invoiceId: invoice.id });
}

export default router;
