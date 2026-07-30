/**
 * Company Self-Registration Routes
 * Public endpoint for new companies to sign up
 * Now includes Stripe card collection for trial-to-paid conversion
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db/index.js';
import { generateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

// Lazy-load Stripe
let stripe = null;
async function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    const Stripe = (await import('stripe')).default;
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

const router = Router();

/**
 * POST /api/register
 * Register a new company and admin user
 */
router.post('/', async (req, res) => {
  const client = await db.getClient();

  try {
    const {
      companyName,
      email,
      password,
      phone,
      adminName,
      oncallPhone,
      emailVerified,
      termsAccepted
    } = req.body;

    // Validation
    if (!companyName || !email || !password || !phone) {
      return res.status(400).json({
        error: 'Company name, email, password, and phone are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters'
      });
    }

    // Terms acceptance must be recorded server-side, not just gated by a
    // disabled button on the frontend — a direct API call must not be able
    // to skip it. See consent_log usage below and gdpr.js for the same
    // table's pattern.
    if (termsAccepted !== true) {
      return res.status(400).json({
        error: 'You must accept the Terms of Service to create an account'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    await client.query('BEGIN');

    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM fm_admin WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'An account with this email already exists'
      });
    }

    // Check if company name already exists
    const existingCompany = await client.query(
      'SELECT id FROM fm_company WHERE LOWER(name) = LOWER($1)',
      [companyName]
    );

    if (existingCompany.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'A company with this name already exists'
      });
    }

    // Check if phone number already exists
    const existingPhone = await client.query(
      'SELECT id FROM fm_company WHERE phone_number = $1',
      [phone]
    );

    if (existingPhone.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'This phone number is already registered to another company'
      });
    }

    // Calculate trial period (14 days)
    const trialStart = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    // Create company with trial status
    const companyResult = await client.query(
      `INSERT INTO fm_company (
        name,
        phone_number,
        fm_oncall_phone,
        fm_oncall_name,
        status,
        trial_start_at,
        trial_end_at,
        owner_email,
        seats_limit,
        seats_used
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, name, status, trial_start_at, trial_end_at`,
      [
        companyName,
        phone,
        oncallPhone || phone,
        adminName || 'On-Call',
        'trial',
        trialStart,
        trialEnd,
        email.toLowerCase(),
        5, // Default seat limit for trial
        1  // Starting with 1 user (the admin)
      ]
    );

    const company = companyResult.rows[0];

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const userResult = await client.query(
      `INSERT INTO fm_admin (
        fm_company_id,
        email,
        password_hash,
        name,
        is_admin,
        email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, name, email_verified`,
      [
        company.id,
        email.toLowerCase(),
        passwordHash,
        adminName || email.split('@')[0],
        true, // First user is admin
        emailVerified === true // Set email_verified if provided
      ]
    );

    const user = userResult.rows[0];

    // Log company creation event
    await client.query(
      `INSERT INTO company_events (company_id, type, actor_type, actor_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        company.id,
        'company_registered',
        'user',
        user.id,
        JSON.stringify({
          registration_source: 'self_signup',
          trial_days: 14
        })
      ]
    );

    // Record Terms of Service acceptance with a timestamp, in the same
    // consent_log table gdpr.js already uses for marketing/analytics/
    // data_sharing consent — this was previously just a disabled-button
    // check on the frontend with no server-side record at all.
    await client.query(
      `INSERT INTO consent_log (user_id, consent_type, consented, ip_address, user_agent)
       VALUES ($1, 'terms_of_service', TRUE, $2, $3)`,
      [
        user.id,
        req.ip || req.headers['x-forwarded-for'] || null,
        req.headers['user-agent'] || null,
      ]
    );

    await client.query('COMMIT');

    // Generate auth token — new fm_admin rows default token_version to 1
    // (see db/migrations/add_token_version.sql), no extra query needed.
    const token = generateToken(user.id, user.email, { tokenVersion: 1 });

    logger.info('New company registered', {
      companyId: company.id,
      companyName: company.name,
      userId: user.id,
      email: user.email
    });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: company.id,
        companyName: company.name,
        is_admin: true,
      },
      company: {
        id: company.id,
        name: company.name,
        status: company.status,
        trialStartAt: company.trial_start_at,
        trialEndAt: company.trial_end_at
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Registration error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/register/check-email
 * Check if email is available
 */
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await db.query(
      'SELECT id FROM fm_admin WHERE email = $1',
      [email.toLowerCase()]
    );

    res.json({ available: result.rows.length === 0 });
  } catch (error) {
    logger.error('Email check error', { error: error.message });
    res.status(500).json({ error: 'Check failed' });
  }
});

/**
 * POST /api/register/check-company
 * Check if company name is available
 */
router.post('/check-company', async (req, res) => {
  try {
    const { companyName } = req.body;

    if (!companyName) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const result = await db.query(
      'SELECT id FROM fm_company WHERE LOWER(name) = LOWER($1)',
      [companyName]
    );

    res.json({ available: result.rows.length === 0 });
  } catch (error) {
    logger.error('Company check error', { error: error.message });
    res.status(500).json({ error: 'Check failed' });
  }
});

/**
 * POST /api/register/create-setup-intent
 * Create Stripe SetupIntent for card collection during signup
 * Called BEFORE the actual registration to get the client secret
 */
router.post('/create-setup-intent', async (req, res) => {
  try {
    const stripeInstance = await getStripe();

    if (!stripeInstance) {
      // Stripe not configured - allow signup without card
      return res.json({
        clientSecret: null,
        stripeConfigured: false,
        message: 'Payment system not configured - proceeding without card'
      });
    }

    const { email, companyName } = req.body;

    // Create a Stripe customer first
    const customer = await stripeInstance.customers.create({
      email: email?.toLowerCase(),
      metadata: {
        companyName,
        signupDate: new Date().toISOString()
      }
    });

    // Create SetupIntent to save card for future use
    const setupIntent = await stripeInstance.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      metadata: {
        companyName,
        email: email?.toLowerCase()
      }
    });

    logger.info('SetupIntent created for signup', {
      customerId: customer.id,
      email
    });

    res.json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
      stripeConfigured: true
    });

  } catch (error) {
    logger.error('Create setup intent error', { error: error.message });
    res.status(500).json({ error: 'Failed to initialize payment setup' });
  }
});

/**
 * POST /api/register/with-card
 * Register with pre-collected card (after SetupIntent confirmed)
 */
router.post('/with-card', async (req, res) => {
  const client = await db.getClient();

  try {
    const {
      companyName,
      email,
      password,
      phone,
      adminName,
      oncallPhone,
      stripeCustomerId,
      paymentMethodId,
      selectedPlan
    } = req.body;

    // Validation
    if (!companyName || !email || !password || !phone) {
      return res.status(400).json({
        error: 'Company name, email, password, and phone are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    await client.query('BEGIN');

    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM fm_admin WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'An account with this email already exists'
      });
    }

    // Check if company name already exists
    const existingCompany = await client.query(
      'SELECT id FROM fm_company WHERE LOWER(name) = LOWER($1)',
      [companyName]
    );

    if (existingCompany.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'A company with this name already exists'
      });
    }

    // Calculate trial period (14 days)
    const trialStart = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    // Create company
    const companyResult = await client.query(
      `INSERT INTO fm_company (
        name,
        phone_number,
        fm_oncall_phone,
        fm_oncall_name,
        status,
        trial_start_at,
        trial_end_at,
        owner_email,
        seats_limit,
        seats_used
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, name, status, trial_start_at, trial_end_at`,
      [
        companyName,
        phone,
        oncallPhone || phone,
        adminName || 'On-Call',
        'trial',
        trialStart,
        trialEnd,
        email.toLowerCase(),
        5,
        1
      ]
    );

    const company = companyResult.rows[0];

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const userResult = await client.query(
      `INSERT INTO fm_admin (
        fm_company_id,
        email,
        password_hash,
        name,
        is_admin
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, name`,
      [
        company.id,
        email.toLowerCase(),
        passwordHash,
        adminName || email.split('@')[0],
        true
      ]
    );

    const user = userResult.rows[0];

    // If Stripe customer was created, link it to subscription record
    if (stripeCustomerId) {
      await client.query(
        `INSERT INTO subscriptions (company_id, stripe_customer_id, status)
         VALUES ($1, $2, 'trialing')
         ON CONFLICT (company_id) DO UPDATE SET
           stripe_customer_id = $2,
           status = 'trialing'`,
        [company.id, stripeCustomerId]
      );

      // Update Stripe customer with company ID
      const stripeInstance = await getStripe();
      if (stripeInstance && paymentMethodId) {
        try {
          // Set as default payment method
          await stripeInstance.customers.update(stripeCustomerId, {
            invoice_settings: {
              default_payment_method: paymentMethodId
            },
            metadata: {
              companyId: company.id,
              companyName: company.name,
              selectedPlan: selectedPlan || 'professional'
            }
          });

          logger.info('Card attached to customer', {
            customerId: stripeCustomerId,
            companyId: company.id
          });
        } catch (stripeError) {
          logger.warn('Failed to update Stripe customer', { error: stripeError.message });
        }
      }
    }

    // Log company creation event
    await client.query(
      `INSERT INTO company_events (company_id, type, actor_type, actor_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        company.id,
        'company_registered',
        'user',
        user.id,
        JSON.stringify({
          registration_source: 'self_signup_with_card',
          trial_days: 14,
          has_payment_method: !!paymentMethodId,
          selected_plan: selectedPlan
        })
      ]
    );

    await client.query('COMMIT');

    // Generate auth token — new fm_admin rows default token_version to 1
    // (see db/migrations/add_token_version.sql), no extra query needed.
    const token = generateToken(user.id, user.email, { tokenVersion: 1 });

    logger.info('New company registered with card', {
      companyId: company.id,
      companyName: company.name,
      userId: user.id,
      hasPaymentMethod: !!paymentMethodId
    });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: company.id,
        companyName: company.name,
        is_admin: true,
      },
      company: {
        id: company.id,
        name: company.name,
        status: company.status,
        trialStartAt: company.trial_start_at,
        trialEndAt: company.trial_end_at,
        hasPaymentMethod: !!paymentMethodId
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Registration with card error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  } finally {
    client.release();
  }
});

export default router;
