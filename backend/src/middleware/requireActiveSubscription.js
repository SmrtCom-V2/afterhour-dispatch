/**
 * Subscription gate — blocks core product access when a company's
 * subscription has lapsed. Separate from requireEntitlement.js, which
 * gates individual premium features; this gates the product itself.
 *
 * fm_company.status is maintained by stripeWebhook.js:
 *   trial | active  -> allowed
 *   past_due -> allowed for a 7-day grace period from past_due_since
 *               (Ron's decision 2026-07-30 — Stripe's own Smart Retries,
 *               an account-level Dashboard setting, keeps attempting the
 *               charge during this window), THEN blocked
 *   suspended | cancelled -> always blocked
 */

import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

const ALLOWED_STATUSES = ['trial', 'active'];
const PAST_DUE_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

export async function requireActiveSubscription(req, res, next) {
  try {
    const companyId = req.user?.fm_company_id;

    if (!companyId) {
      return res.status(401).json({ error: 'Not authenticated', code: 'AUTH_REQUIRED' });
    }

    const result = await db.query(
      'SELECT status, past_due_since FROM fm_company WHERE id = $1',
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const { status, past_due_since: pastDueSince } = result.rows[0];

    if (ALLOWED_STATUSES.includes(status)) {
      return next();
    }

    if (status === 'past_due' && pastDueSince) {
      const graceExpiresAt = new Date(pastDueSince).getTime() + PAST_DUE_GRACE_PERIOD_MS;
      if (Date.now() < graceExpiresAt) {
        return next();
      }
    }

    logger.info('Blocked request: subscription not active', {
      companyId,
      status,
      pastDueSince,
      path: req.originalUrl,
    });

    return res.status(402).json({
      error: 'Subscription inactive',
      code: 'SUBSCRIPTION_INACTIVE',
      status,
      billing_url: '/settings',
    });
  } catch (error) {
    logger.error('Subscription check failed', { error: error.message });
    res.status(500).json({ error: 'Subscription check failed' });
  }
}
