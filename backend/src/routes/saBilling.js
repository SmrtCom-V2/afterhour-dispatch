/**
 * Super Admin Billing
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';

const router = Router();

// Get billing overview with stats
router.get('/overview', authenticateSuperAdmin, async (req, res) => {
  // Revenue stats
  const revenueStats = await db.query(
    `SELECT
       COALESCE(SUM(p.monthly_price_cents / 100.0), 0) AS current_mrr,
       COUNT(*) FILTER (WHERE fc.status = 'active') AS active_subscriptions,
       COUNT(*) FILTER (WHERE fc.status = 'past_due') AS past_due_count,
       COUNT(*) FILTER (WHERE fc.status = 'cancelled' AND fc.updated_at >= NOW() - INTERVAL '30 days') AS cancelled_30d
     FROM fm_company fc
     LEFT JOIN packages p ON fc.package_id = p.id
     WHERE fc.paid_start_at IS NOT NULL`
  );

  // Revenue by plan
  const revenueByPlan = await db.query(
    `SELECT
       p.name AS plan_name,
       COUNT(fc.id) AS subscriber_count,
       COALESCE(SUM(p.monthly_price_cents / 100.0), 0) AS monthly_revenue
     FROM fm_company fc
     LEFT JOIN packages p ON fc.package_id = p.id
     WHERE fc.status IN ('active', 'past_due') AND fc.paid_start_at IS NOT NULL
     GROUP BY p.id, p.name
     ORDER BY monthly_revenue DESC`
  );

  // Monthly revenue trend (last 12 months)
  const revenueTrend = await db.query(
    `SELECT
       TO_CHAR(date_trunc('month', fc.paid_start_at), 'YYYY-MM') AS month,
       COUNT(*) AS new_subscribers,
       COALESCE(SUM(p.monthly_price_cents / 100.0), 0) AS revenue_added
     FROM fm_company fc
     LEFT JOIN packages p ON fc.package_id = p.id
     WHERE fc.paid_start_at IS NOT NULL
       AND fc.paid_start_at >= NOW() - INTERVAL '12 months'
     GROUP BY date_trunc('month', fc.paid_start_at)
     ORDER BY month ASC`
  );

  res.json({
    stats: {
      current_mrr: parseFloat(revenueStats.rows[0]?.current_mrr || 0),
      arr: parseFloat(revenueStats.rows[0]?.current_mrr || 0) * 12,
      active_subscriptions: parseInt(revenueStats.rows[0]?.active_subscriptions || 0, 10),
      past_due_count: parseInt(revenueStats.rows[0]?.past_due_count || 0, 10),
      cancelled_30d: parseInt(revenueStats.rows[0]?.cancelled_30d || 0, 10),
    },
    revenue_by_plan: revenueByPlan.rows,
    revenue_trend: revenueTrend.rows,
  });
});

// Get all subscriptions with payment history
router.get('/subscriptions', authenticateSuperAdmin, async (req, res) => {
  const { status, plan, search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let whereConditions = ['fc.paid_start_at IS NOT NULL'];
  const params = [];
  let paramIndex = 1;

  if (status && status !== 'all') {
    whereConditions.push(`fc.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (plan) {
    whereConditions.push(`fc.package_id = $${paramIndex}`);
    params.push(plan);
    paramIndex++;
  }

  if (search) {
    whereConditions.push(`(fc.name ILIKE $${paramIndex} OR fc.owner_email ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT
       fc.id,
       fc.name,
       fc.owner_email,
       fc.status,
       fc.paid_start_at,
       fc.current_period_end_at,
       p.name AS plan_name,
       p.monthly_price_cents AS price_monthly
     FROM fm_company fc
     LEFT JOIN packages p ON fc.package_id = p.id
     ${whereClause}
     ORDER BY fc.paid_start_at DESC NULLS LAST
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  const countResult = await db.query(
    `SELECT COUNT(*) FROM fm_company fc ${whereClause}`,
    params
  );

  res.json({
    subscriptions: result.rows,
    total: parseInt(countResult.rows[0].count, 10),
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  });
});

// Get payment failures (existing endpoint, enhanced)
router.get('/failures', authenticateSuperAdmin, async (req, res) => {
  const result = await db.query(
    `SELECT
        fc.id,
        fc.name,
        fc.status,
        fc.current_period_end_at,
        fc.owner_email,
        p.name as plan_name,
        p.monthly_price_cents AS price_monthly
     FROM fm_company fc
     LEFT JOIN packages p ON fc.package_id = p.id
     WHERE fc.status = 'past_due'
     ORDER BY fc.current_period_end_at DESC NULLS LAST`
  );

  res.json({
    failures: result.rows.map((row) => ({
      ...row,
      days_overdue: row.current_period_end_at
        ? Math.floor((Date.now() - new Date(row.current_period_end_at).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    })),
  });
});

// Get invoices for a specific company
router.get('/company/:companyId/invoices', authenticateSuperAdmin, async (req, res) => {
  const { companyId } = req.params;

  // Get company info
  const company = await db.query(
    `SELECT id, name FROM fm_company WHERE id = $1`,
    [companyId]
  );

  if (company.rows.length === 0) {
    return res.status(404).json({ error: 'Company not found' });
  }

  // In a real implementation, you'd fetch from Stripe API here
  // For now, return mock invoice data based on subscription history
  const subscriptionHistory = await db.query(
    `SELECT
       fc.paid_start_at,
       fc.current_period_end_at,
       p.name AS plan_name,
       p.monthly_price_cents AS price_monthly
     FROM fm_company fc
     LEFT JOIN packages p ON fc.package_id = p.id
     WHERE fc.id = $1`,
    [companyId]
  );

  const invoices = [];
  if (subscriptionHistory.rows[0]?.paid_start_at) {
    const startDate = new Date(subscriptionHistory.rows[0].paid_start_at);
    const now = new Date();
    let currentDate = new Date(startDate);

    while (currentDate <= now) {
      invoices.push({
        id: `inv_${companyId}_${currentDate.getTime()}`,
        date: currentDate.toISOString(),
        amount: subscriptionHistory.rows[0].price_monthly || 0,
        status: 'paid',
        plan: subscriptionHistory.rows[0].plan_name,
        period_start: new Date(currentDate).toISOString(),
        period_end: new Date(currentDate.setMonth(currentDate.getMonth() + 1)).toISOString(),
      });
      currentDate.setMonth(currentDate.getMonth());
    }
  }

  res.json({
    company: company.rows[0],
    invoices: invoices.reverse().slice(0, 12), // Last 12 invoices
  });
});

// Get revenue summary by time period
router.get('/revenue', authenticateSuperAdmin, async (req, res) => {
  const { period = '12m' } = req.query;

  let interval;
  switch (period) {
    case '3m': interval = '3 months'; break;
    case '6m': interval = '6 months'; break;
    case '1y': interval = '12 months'; break;
    case '2y': interval = '24 months'; break;
    default: interval = '12 months';
  }

  const result = await db.query(
    `SELECT
       TO_CHAR(date_trunc('month', fc.paid_start_at), 'YYYY-MM') AS month,
       COUNT(*) AS new_customers,
       COALESCE(SUM(p.monthly_price_cents / 100.0), 0) AS mrr_added
     FROM fm_company fc
     LEFT JOIN packages p ON fc.package_id = p.id
     WHERE fc.paid_start_at IS NOT NULL
       AND fc.paid_start_at >= NOW() - INTERVAL '${interval}'
     GROUP BY date_trunc('month', fc.paid_start_at)
     ORDER BY month ASC`
  );

  // Calculate cumulative MRR
  let cumulativeMrr = 0;
  const revenueData = result.rows.map(row => {
    cumulativeMrr += parseFloat(row.mrr_added);
    return {
      ...row,
      cumulative_mrr: cumulativeMrr,
    };
  });

  res.json({
    period,
    revenue_data: revenueData,
  });
});

export default router;
