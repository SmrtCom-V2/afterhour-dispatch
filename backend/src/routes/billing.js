/**
 * Billing Routes
 * Handle Stripe subscription management
 *
 * Required Environment Variables:
 * - STRIPE_SECRET_KEY: Your Stripe secret key
 * - STRIPE_WEBHOOK_SECRET: Webhook signing secret
 * - STRIPE_PRICE_ID_MONTHLY: Price ID for monthly plan
 * - STRIPE_PRICE_ID_YEARLY: Price ID for yearly plan (optional)
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Lazy-load Stripe to avoid errors if not configured
let stripe = null;
async function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    const Stripe = (await import('stripe')).default;
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

/**
 * Ensure billing tables exist
 */
async function ensureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID NOT NULL REFERENCES fm_company(id) ON DELETE CASCADE,
      stripe_customer_id VARCHAR(255),
      stripe_subscription_id VARCHAR(255),
      stripe_price_id VARCHAR(255),
      status VARCHAR(50) DEFAULT 'inactive',
      current_period_start TIMESTAMP WITH TIME ZONE,
      current_period_end TIMESTAMP WITH TIME ZONE,
      cancel_at_period_end BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(company_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID NOT NULL REFERENCES fm_company(id) ON DELETE CASCADE,
      stripe_invoice_id VARCHAR(255) UNIQUE,
      amount_paid INTEGER,
      currency VARCHAR(10),
      status VARCHAR(50),
      invoice_url VARCHAR(500),
      pdf_url VARCHAR(500),
      period_start TIMESTAMP WITH TIME ZONE,
      period_end TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

/**
 * Check if Stripe is configured
 */
function checkStripeConfig(req, res, next) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({
      error: 'Payment system not configured',
      message: 'Stripe integration is not set up yet'
    });
  }
  next();
}

/**
 * GET /api/billing/status
 * Get billing status for current company
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    await ensureTables();

    const companyId = req.user.fm_company_id;

    // Get company info
    const companyResult = await db.query(
      `SELECT fc.*, s.stripe_customer_id, s.stripe_subscription_id, s.status as subscription_status,
              s.current_period_end, s.cancel_at_period_end
       FROM fm_company fc
       LEFT JOIN subscriptions s ON fc.id = s.company_id
       WHERE fc.id = $1`,
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = companyResult.rows[0];

    // Get recent invoices
    const invoicesResult = await db.query(
      `SELECT * FROM invoices WHERE company_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [companyId]
    );

    // Calculate trial info
    const now = new Date();
    const trialEnd = company.trial_end_at ? new Date(company.trial_end_at) : null;
    const trialDaysRemaining = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))) : 0;

    res.json({
      company: {
        id: company.id,
        name: company.name,
        status: company.status,
        trialStartAt: company.trial_start_at,
        trialEndAt: company.trial_end_at,
        trialDaysRemaining,
        paidStartAt: company.paid_start_at
      },
      subscription: {
        status: company.subscription_status || 'none',
        stripeCustomerId: company.stripe_customer_id,
        currentPeriodEnd: company.current_period_end,
        cancelAtPeriodEnd: company.cancel_at_period_end
      },
      invoices: invoicesResult.rows,
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY
    });

  } catch (error) {
    logger.error('Billing status error', { error: error.message });
    res.status(500).json({ error: 'Failed to get billing status' });
  }
});

/**
 * POST /api/billing/create-checkout
 * Create Stripe checkout session
 */
router.post('/create-checkout', authenticateToken, checkStripeConfig, async (req, res) => {
  try {
    await ensureTables();
    const stripe = await getStripe();

    const companyId = req.user.fm_company_id;
    const { priceId, successUrl, cancelUrl } = req.body;

    // Get or create Stripe customer
    let subscription = await db.query(
      'SELECT * FROM subscriptions WHERE company_id = $1',
      [companyId]
    );

    let stripeCustomerId;

    if (subscription.rows.length === 0 || !subscription.rows[0].stripe_customer_id) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: {
          companyId,
          companyName: req.user.company_name
        }
      });

      stripeCustomerId = customer.id;

      // Store customer ID
      await db.query(
        `INSERT INTO subscriptions (company_id, stripe_customer_id)
         VALUES ($1, $2)
         ON CONFLICT (company_id) DO UPDATE SET stripe_customer_id = $2`,
        [companyId, stripeCustomerId]
      );
    } else {
      stripeCustomerId = subscription.rows[0].stripe_customer_id;
    }

    // Create checkout session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{
        price: priceId || process.env.STRIPE_PRICE_ID_MONTHLY,
        quantity: 1
      }],
      success_url: successUrl || `${frontendUrl}/settings?billing=success`,
      cancel_url: cancelUrl || `${frontendUrl}/settings?billing=cancelled`,
      metadata: {
        companyId
      }
    });

    logger.info('Checkout session created', { companyId, sessionId: session.id });

    res.json({ url: session.url, sessionId: session.id });

  } catch (error) {
    logger.error('Create checkout error', { error: error.message });
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * POST /api/billing/create-portal
 * Create Stripe billing portal session
 */
router.post('/create-portal', authenticateToken, checkStripeConfig, async (req, res) => {
  try {
    const stripe = await getStripe();
    const companyId = req.user.fm_company_id;

    const subscription = await db.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE company_id = $1',
      [companyId]
    );

    if (subscription.rows.length === 0 || !subscription.rows[0].stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.rows[0].stripe_customer_id,
      return_url: `${frontendUrl}/settings`
    });

    res.json({ url: session.url });

  } catch (error) {
    logger.error('Create portal error', { error: error.message });
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

/**
 * GET /api/billing/plans
 * Get available subscription plans from database
 * Supports ?lang=de or ?lang=en query parameter
 */
router.get('/plans', async (req, res) => {
  try {
    const lang = req.query.lang || 'de';

    // Fetch plans from packages table
    const result = await db.query(`
      SELECT id, name, tagline, description, monthly_price_cents, setup_fee_cents,
             limits_json, ideal_for, stripe_price_id, display_order
      FROM packages
      WHERE is_active = TRUE
      ORDER BY display_order
    `);

    const plans = result.rows.map(pkg => ({
      id: pkg.id.toLowerCase().replace('plan_', ''),
      name: pkg.name,
      description: pkg.tagline || pkg.description,
      priceId: pkg.stripe_price_id,
      price: pkg.monthly_price_cents ? Math.round(pkg.monthly_price_cents / 100) : null,
      currency: 'EUR',
      interval: lang === 'de' ? 'Monat' : 'month',
      limits: {
        properties: pkg.limits_json?.max_properties || 0,
        callsPerMonth: pkg.limits_json?.max_incidents_month || 0
      },
      features: pkg.description ? [pkg.description] : [],
      onboarding: pkg.setup_fee_cents > 0
        ? (lang === 'de'
          ? `€${pkg.setup_fee_cents / 100} (entfällt bei Jahresvertrag)`
          : `€${pkg.setup_fee_cents / 100} (waived with annual contract)`)
        : (lang === 'de' ? 'Kostenlos (Self-Service)' : 'Free (Self-Service)'),
      onboardingPrice: pkg.setup_fee_cents ? pkg.setup_fee_cents / 100 : 0,
      popular: pkg.name === 'Professional',
      bestFor: pkg.ideal_for,
      contactSales: pkg.monthly_price_cents === null
    }));

    res.json({
      plans,
      annualDiscount: {
        description: lang === 'de'
          ? '2 Monate gratis bei Jahresvertrag (~17% Rabatt)'
          : '2 months free with annual payment (~17% discount)',
        percentage: 17,
        waivesOnboarding: true
      },
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY
    });
  } catch (error) {
    logger.error('Get billing plans error', { error: error.message });
    res.status(500).json({ error: 'Failed to get billing plans' });
  }
});

export default router;
