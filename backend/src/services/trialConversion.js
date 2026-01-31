/**
 * Trial Conversion Service
 * Handles automatic conversion of trial users to paid subscribers
 *
 * When a trial expires and the customer has a payment method on file,
 * automatically creates a subscription and charges them.
 */

import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { sendEmail } from '../utils/email.js';

// Lazy-load Stripe
let stripe = null;
async function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    const Stripe = (await import('stripe')).default;
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

/**
 * Check for expiring trials and convert to paid subscriptions
 * Should be called daily via cron job
 */
export async function processExpiringTrials() {
  const stripeInstance = await getStripe();

  if (!stripeInstance) {
    logger.info('Stripe not configured, skipping trial conversion');
    return { processed: 0, converted: 0, failed: 0 };
  }

  logger.info('Starting trial conversion check');

  // Find companies whose trial has expired and have a payment method
  // but no active subscription
  const result = await db.query(`
    SELECT
      fc.id as company_id,
      fc.name as company_name,
      fc.owner_email,
      fc.trial_end_at,
      s.stripe_customer_id,
      s.status as subscription_status
    FROM fm_company fc
    LEFT JOIN subscriptions s ON fc.id = s.company_id
    WHERE fc.status = 'trial'
      AND fc.trial_end_at <= NOW()
      AND s.stripe_customer_id IS NOT NULL
      AND (s.status IS NULL OR s.status = 'trialing' OR s.status = 'inactive')
  `);

  const stats = { processed: 0, converted: 0, failed: 0, noPaymentMethod: 0 };

  for (const company of result.rows) {
    stats.processed++;

    try {
      // Check if customer has a default payment method
      const customer = await stripeInstance.customers.retrieve(company.stripe_customer_id);

      if (!customer.invoice_settings?.default_payment_method && !customer.default_source) {
        logger.info('No payment method for trial company', {
          companyId: company.company_id,
          companyName: company.company_name
        });
        stats.noPaymentMethod++;

        // Send reminder email
        await sendTrialExpiredNoCardEmail(company);

        // Mark as expired
        await db.query(
          `UPDATE fm_company SET status = 'expired', updated_at = NOW() WHERE id = $1`,
          [company.company_id]
        );

        continue;
      }

      // Get the selected plan from customer metadata or default to professional
      const selectedPlan = customer.metadata?.selectedPlan || 'professional';
      const priceId = getPriceIdForPlan(selectedPlan);

      if (!priceId) {
        logger.error('No price ID configured for plan', { plan: selectedPlan });
        stats.failed++;
        continue;
      }

      // Create the subscription
      const subscription = await stripeInstance.subscriptions.create({
        customer: company.stripe_customer_id,
        items: [{ price: priceId }],
        default_payment_method: customer.invoice_settings?.default_payment_method,
        metadata: {
          companyId: company.company_id,
          companyName: company.company_name,
          convertedFromTrial: 'true'
        }
      });

      // Update database
      await db.query(
        `UPDATE subscriptions SET
          stripe_subscription_id = $1,
          stripe_price_id = $2,
          status = $3,
          current_period_start = to_timestamp($4),
          current_period_end = to_timestamp($5),
          updated_at = NOW()
         WHERE company_id = $6`,
        [
          subscription.id,
          priceId,
          subscription.status,
          subscription.current_period_start,
          subscription.current_period_end,
          company.company_id
        ]
      );

      await db.query(
        `UPDATE fm_company SET
          status = 'active',
          paid_start_at = NOW(),
          updated_at = NOW()
         WHERE id = $1`,
        [company.company_id]
      );

      // Log event
      await db.query(
        `INSERT INTO company_events (company_id, type, actor_type, metadata)
         VALUES ($1, 'trial_converted', 'system', $2)`,
        [
          company.company_id,
          JSON.stringify({
            subscriptionId: subscription.id,
            plan: selectedPlan,
            priceId
          })
        ]
      );

      // Send welcome to paid email
      await sendTrialConvertedEmail(company, selectedPlan);

      logger.info('Trial converted to paid subscription', {
        companyId: company.company_id,
        companyName: company.company_name,
        subscriptionId: subscription.id
      });

      stats.converted++;

    } catch (error) {
      logger.error('Failed to convert trial', {
        companyId: company.company_id,
        error: error.message
      });
      stats.failed++;

      // If payment failed, mark as expired and notify
      if (error.type === 'StripeCardError') {
        await db.query(
          `UPDATE fm_company SET status = 'payment_failed', updated_at = NOW() WHERE id = $1`,
          [company.company_id]
        );
        await sendPaymentFailedEmail(company, error.message);
      }
    }
  }

  logger.info('Trial conversion completed', stats);
  return stats;
}

/**
 * Get Stripe Price ID for a plan
 */
function getPriceIdForPlan(plan) {
  const priceMap = {
    starter: process.env.STRIPE_PRICE_ID_STARTER,
    professional: process.env.STRIPE_PRICE_ID_PROFESSIONAL || process.env.STRIPE_PRICE_ID_MONTHLY,
    enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE
  };
  return priceMap[plan] || priceMap.professional;
}

/**
 * Send trial expired email (no card on file)
 */
async function sendTrialExpiredNoCardEmail(company) {
  if (!company.owner_email) return;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';

  try {
    await sendEmail({
      to: company.owner_email,
      subject: 'Your 24-7 Dispatch Trial Has Ended',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #F59E0B, #D97706); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Trial Ended</h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <p style="color: #475569; line-height: 1.6;">
              Hi,
            </p>
            <p style="color: #475569; line-height: 1.6;">
              Your 14-day free trial of <strong>24-7 Dispatch</strong> for <strong>${company.company_name}</strong> has ended.
            </p>
            <p style="color: #475569; line-height: 1.6;">
              To continue using our service and keep all your data, please subscribe now.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${frontendUrl}/settings" style="
                display: inline-block;
                background: #3B82F6;
                color: white;
                padding: 14px 32px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
              ">Subscribe Now</a>
            </div>
            <p style="color: #94A3B8; font-size: 13px; margin-top: 30px;">
              Your data will be preserved for 30 days. After that, it may be deleted.
            </p>
          </div>
        </div>
      `
    });
  } catch (error) {
    logger.error('Failed to send trial expired email', { error: error.message });
  }
}

/**
 * Send trial converted to paid email
 */
async function sendTrialConvertedEmail(company, plan) {
  if (!company.owner_email) return;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
  const planNames = {
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise'
  };

  try {
    await sendEmail({
      to: company.owner_email,
      subject: 'Welcome to 24-7 Dispatch! Your subscription is now active',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to 24-7 Dispatch!</h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <p style="color: #475569; line-height: 1.6;">
              Hi,
            </p>
            <p style="color: #475569; line-height: 1.6;">
              Great news! Your <strong>${planNames[plan] || 'Professional'}</strong> subscription for
              <strong>${company.company_name}</strong> is now active.
            </p>
            <p style="color: #475569; line-height: 1.6;">
              Your first invoice has been charged to the card on file. You can view your invoices
              and manage your subscription in the Settings page.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${frontendUrl}/" style="
                display: inline-block;
                background: #3B82F6;
                color: white;
                padding: 14px 32px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
              ">Go to Dashboard</a>
            </div>
            <p style="color: #475569; line-height: 1.6;">
              Thank you for choosing 24-7 Dispatch!
            </p>
          </div>
        </div>
      `
    });
  } catch (error) {
    logger.error('Failed to send trial converted email', { error: error.message });
  }
}

/**
 * Send payment failed email
 */
async function sendPaymentFailedEmail(company, errorMessage) {
  if (!company.owner_email) return;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';

  try {
    await sendEmail({
      to: company.owner_email,
      subject: 'Payment Failed - Action Required',
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
              We tried to charge your card to start your <strong>${company.company_name}</strong> subscription,
              but the payment was declined.
            </p>
            <p style="color: #475569; line-height: 1.6; background: #FEF2F2; padding: 12px; border-radius: 6px;">
              <strong>Reason:</strong> ${errorMessage || 'Card declined'}
            </p>
            <p style="color: #475569; line-height: 1.6;">
              Please update your payment method to continue using 24-7 Dispatch.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${frontendUrl}/settings" style="
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
    logger.error('Failed to send payment failed email', { error: error.message });
  }
}

/**
 * Send trial reminder emails
 * Call this daily to send reminders at 3 days and 1 day before trial ends
 */
export async function sendTrialReminders() {
  const result = await db.query(`
    SELECT
      fc.id as company_id,
      fc.name as company_name,
      fc.owner_email,
      fc.trial_end_at,
      s.stripe_customer_id
    FROM fm_company fc
    LEFT JOIN subscriptions s ON fc.id = s.company_id
    WHERE fc.status = 'trial'
      AND fc.trial_end_at > NOW()
  `);

  const now = new Date();
  let sent = 0;

  for (const company of result.rows) {
    const trialEnd = new Date(company.trial_end_at);
    const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

    // Send reminders at 3 days and 1 day
    if (daysRemaining === 3 || daysRemaining === 1) {
      const hasCard = company.stripe_customer_id != null;
      await sendTrialReminderEmail(company, daysRemaining, hasCard);
      sent++;
    }
  }

  logger.info('Trial reminders sent', { count: sent });
  return sent;
}

/**
 * Send trial reminder email
 */
async function sendTrialReminderEmail(company, daysRemaining, hasCard) {
  if (!company.owner_email) return;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
  const dayWord = daysRemaining === 1 ? 'day' : 'days';

  try {
    await sendEmail({
      to: company.owner_email,
      subject: `${daysRemaining} ${dayWord} left in your 24-7 Dispatch trial`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3B82F6, #2563EB); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">${daysRemaining} ${dayWord.charAt(0).toUpperCase() + dayWord.slice(1)} Left</h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <p style="color: #475569; line-height: 1.6;">
              Hi,
            </p>
            <p style="color: #475569; line-height: 1.6;">
              Your free trial of <strong>24-7 Dispatch</strong> for <strong>${company.company_name}</strong>
              ends in <strong>${daysRemaining} ${dayWord}</strong>.
            </p>
            ${hasCard ? `
              <p style="color: #475569; line-height: 1.6; background: #F0FDF4; padding: 12px; border-radius: 6px; border-left: 4px solid #10B981;">
                ✓ Your card is on file. Your subscription will start automatically when your trial ends.
              </p>
            ` : `
              <p style="color: #475569; line-height: 1.6; background: #FEF3C7; padding: 12px; border-radius: 6px; border-left: 4px solid #F59E0B;">
                ⚠️ No payment method on file. Add a card to continue using 24-7 Dispatch after your trial.
              </p>
            `}
            <div style="text-align: center; margin: 30px 0;">
              <a href="${frontendUrl}/settings" style="
                display: inline-block;
                background: #3B82F6;
                color: white;
                padding: 14px 32px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
              ">${hasCard ? 'View Subscription' : 'Add Payment Method'}</a>
            </div>
          </div>
        </div>
      `
    });
  } catch (error) {
    logger.error('Failed to send trial reminder email', { error: error.message });
  }
}

export default {
  processExpiringTrials,
  sendTrialReminders
};
