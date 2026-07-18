/**
 * Subscription gate — blocks core product access when a company's
 * subscription has lapsed. Separate from requireEntitlement.js, which
 * gates individual premium features; this gates the product itself.
 *
 * fm_company.status is maintained by stripeWebhook.js:
 *   trial | active  -> allowed
 *   past_due | suspended | cancelled -> blocked
 */

import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

const ALLOWED_STATUSES = ['trial', 'active'];

export async function requireActiveSubscription(req, res, next) {
  try {
    const companyId = req.user?.fm_company_id;

    if (!companyId) {
      return res.status(401).json({ error: 'Not authenticated', code: 'AUTH_REQUIRED' });
    }

    const result = await db.query(
      'SELECT status FROM fm_company WHERE id = $1',
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const status = result.rows[0].status;

    if (!ALLOWED_STATUSES.includes(status)) {
      logger.info('Blocked request: subscription not active', {
        companyId,
        status,
        path: req.originalUrl,
      });

      return res.status(402).json({
        error: 'Subscription inactive',
        code: 'SUBSCRIPTION_INACTIVE',
        status,
        billing_url: '/settings',
      });
    }

    next();
  } catch (error) {
    logger.error('Subscription check failed', { error: error.message });
    res.status(500).json({ error: 'Subscription check failed' });
  }
}
