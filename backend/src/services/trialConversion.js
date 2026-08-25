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
import { getFrontendUrl } from '../utils/frontendUrl.js';

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
      fc.language_preference,
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
      const priceId = await getPriceIdForPlan(selectedPlan);

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
 * Get Stripe Price ID for a plan, sourced from the same packages table
 * that live checkout (/api/billing/plans) reads from — single source of truth.
 */
async function getPriceIdForPlan(plan) {
  const planId = `PLAN_${String(plan || '').toUpperCase()}`;
  const result = await db.query(
    `SELECT stripe_price_id FROM packages WHERE id = $1 AND is_active = TRUE`,
    [planId]
  );
  if (result.rows[0]?.stripe_price_id) {
    return result.rows[0].stripe_price_id;
  }
  const fallback = await db.query(
    `SELECT stripe_price_id FROM packages WHERE id = 'PLAN_PROFESSIONAL' AND is_active = TRUE`
  );
  return fallback.rows[0]?.stripe_price_id || null;
}

/**
 * Send trial expired email (no card on file)
 */
async function sendTrialExpiredNoCardEmail(company) {
  if (!company.owner_email) return;

  const frontendUrl = getFrontendUrl();
  const isEn = company.language_preference === 'en';

  const copy = isEn
    ? {
        subject: 'Your SmrtHour Trial Has Ended',
        heading: 'Trial Ended',
        greeting: 'Hi,',
        body: `Your 14-day free trial of <strong>SmrtHour</strong> for <strong>${company.company_name}</strong> has ended.`,
        cta_lead: 'To continue using our service and keep all your data, please subscribe now.',
        cta: 'Subscribe Now',
        footer: 'Your data will be preserved for 30 days. After that, it may be deleted.'
      }
    : {
        subject: 'Ihre SmrtHour-Testphase ist beendet',
        heading: 'Testphase beendet',
        greeting: 'Hallo,',
        body: `Ihre 14-tägige kostenlose Testphase von <strong>SmrtHour</strong> für <strong>${company.company_name}</strong> ist beendet.`,
        cta_lead: 'Um unseren Service weiter zu nutzen und Ihre Daten zu behalten, schließen Sie jetzt ein Abonnement ab.',
        cta: 'Jetzt abonnieren',
        footer: 'Ihre Daten bleiben 30 Tage lang gespeichert. Danach können sie gelöscht werden.'
      };

  try {
    await sendEmail({
      to: company.owner_email,
      subject: copy.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #F59E0B, #D97706); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">${copy.heading}</h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <p style="color: #475569; line-height: 1.6;">
              ${copy.greeting}
            </p>
            <p style="color: #475569; line-height: 1.6;">
              ${copy.body}
            </p>
            <p style="color: #475569; line-height: 1.6;">
              ${copy.cta_lead}
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
              ">${copy.cta}</a>
            </div>
            <p style="color: #94A3B8; font-size: 13px; margin-top: 30px;">
              ${copy.footer}
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

  const frontendUrl = getFrontendUrl();
  const isEn = company.language_preference === 'en';
  const planNames = {
    micro: 'Micro',
    starter: 'Starter',
    professional: 'Professional',
    compliance: 'Compliance'
  };
  const planName = planNames[plan] || 'Professional';

  const copy = isEn
    ? {
        subject: 'Welcome to SmrtHour! Your subscription is now active',
        heading: 'Welcome to SmrtHour!',
        greeting: 'Hi,',
        body: `Great news! Your <strong>${planName}</strong> subscription for <strong>${company.company_name}</strong> is now active.`,
        invoice: 'Your first invoice has been charged to the card on file. You can view your invoices and manage your subscription in the Settings page.',
        cta: 'Go to Dashboard',
        thanks: 'Thank you for choosing SmrtHour!'
      }
    : {
        subject: 'Willkommen bei SmrtHour! Ihr Abonnement ist jetzt aktiv',
        heading: 'Willkommen bei SmrtHour!',
        greeting: 'Hallo,',
        body: `Gute Nachrichten! Ihr <strong>${planName}</strong>-Abonnement für <strong>${company.company_name}</strong> ist jetzt aktiv.`,
        invoice: 'Ihre erste Rechnung wurde der hinterlegten Karte belastet. Sie können Ihre Rechnungen einsehen und Ihr Abonnement in den Einstellungen verwalten.',
        cta: 'Zum Dashboard',
        thanks: 'Vielen Dank, dass Sie sich für SmrtHour entschieden haben!'
      };

  try {
    await sendEmail({
      to: company.owner_email,
      subject: copy.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">${copy.heading}</h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <p style="color: #475569; line-height: 1.6;">
              ${copy.greeting}
            </p>
            <p style="color: #475569; line-height: 1.6;">
              ${copy.body}
            </p>
            <p style="color: #475569; line-height: 1.6;">
              ${copy.invoice}
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
              ">${copy.cta}</a>
            </div>
            <p style="color: #475569; line-height: 1.6;">
              ${copy.thanks}
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

  const frontendUrl = getFrontendUrl();

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
      fc.language_preference,
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

  const frontendUrl = getFrontendUrl();
  const isEn = company.language_preference === 'en';

  const copy = isEn
    ? {
        dayWord: daysRemaining === 1 ? 'day' : 'days',
        subject: `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left in your SmrtHour trial`,
        greeting: 'Hi,',
        body: (dayWord) => `Your free trial of <strong>SmrtHour</strong> for <strong>${company.company_name}</strong> ends in <strong>${daysRemaining} ${dayWord}</strong>.`,
        hasCardNote: '✓ Your card is on file. Your subscription will start automatically when your trial ends.',
        noCardNote: '⚠️ No payment method on file. Add a card to continue using SmrtHour after your trial.',
        ctaHasCard: 'View Subscription',
        ctaNoCard: 'Add Payment Method'
      }
    : {
        dayWord: daysRemaining === 1 ? 'Tag' : 'Tage',
        subject: `Noch ${daysRemaining} ${daysRemaining === 1 ? 'Tag' : 'Tage'} in Ihrer SmrtHour-Testphase`,
        greeting: 'Hallo,',
        body: (dayWord) => `Ihre kostenlose Testphase von <strong>SmrtHour</strong> für <strong>${company.company_name}</strong> endet in <strong>${daysRemaining} ${dayWord}</strong>.`,
        hasCardNote: '✓ Ihre Karte ist hinterlegt. Ihr Abonnement startet automatisch, sobald die Testphase endet.',
        noCardNote: '⚠️ Keine Zahlungsmethode hinterlegt. Fügen Sie eine Karte hinzu, um SmrtHour nach der Testphase weiter zu nutzen.',
        ctaHasCard: 'Abonnement ansehen',
        ctaNoCard: 'Zahlungsmethode hinzufügen'
      };

  const dayWordCap = copy.dayWord.charAt(0).toUpperCase() + copy.dayWord.slice(1);
  const heading = isEn ? `${daysRemaining} ${dayWordCap} Left` : `Noch ${daysRemaining} ${dayWordCap}`;

  try {
    await sendEmail({
      to: company.owner_email,
      subject: copy.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3B82F6, #2563EB); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">${heading}</h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <p style="color: #475569; line-height: 1.6;">
              ${copy.greeting}
            </p>
            <p style="color: #475569; line-height: 1.6;">
              ${copy.body(copy.dayWord)}
            </p>
            ${hasCard ? `
              <p style="color: #475569; line-height: 1.6; background: #F0FDF4; padding: 12px; border-radius: 6px; border-left: 4px solid #10B981;">
                ${copy.hasCardNote}
              </p>
            ` : `
              <p style="color: #475569; line-height: 1.6; background: #FEF3C7; padding: 12px; border-radius: 6px; border-left: 4px solid #F59E0B;">
                ${copy.noCardNote}
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
              ">${hasCard ? copy.ctaHasCard : copy.ctaNoCard}</a>
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
