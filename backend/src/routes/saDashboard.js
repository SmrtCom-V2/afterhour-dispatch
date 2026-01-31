/**
 * Super Admin Dashboard
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';

const router = Router();

router.get('/', authenticateSuperAdmin, async (req, res) => {
  const totals = await db.query(
    `SELECT
        COUNT(*) AS total_companies,
        COUNT(*) FILTER (WHERE status = 'active') AS active_companies,
        COUNT(*) FILTER (WHERE status = 'trial') AS active_trials,
        COUNT(*) FILTER (WHERE status = 'past_due') AS payment_issues,
        COUNT(*) FILTER (WHERE paid_start_at IS NOT NULL) AS paid_companies
     FROM fm_company`
  );

  // Calculate MRR from active subscriptions
  const mrrResult = await db.query(
    `SELECT COALESCE(SUM(p.monthly_price_cents / 100.0), 0) AS mrr
     FROM fm_company fc
     LEFT JOIN packages p ON fc.package_id = p.id
     WHERE fc.status IN ('active', 'past_due') AND fc.paid_start_at IS NOT NULL`
  );

  // Calculate ARR
  const arr = parseFloat(mrrResult.rows[0].mrr || 0) * 12;

  // Get new signups in last 24h
  const newSignups = await db.query(
    `SELECT COUNT(*) AS count
     FROM fm_company
     WHERE created_at >= NOW() - INTERVAL '24 hours'`
  );

  // Calculate churn (companies that cancelled in last 30 days)
  const churnResult = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'cancelled' AND updated_at >= NOW() - INTERVAL '30 days') AS churned_30d,
       COUNT(*) FILTER (WHERE paid_start_at IS NOT NULL AND paid_start_at < NOW() - INTERVAL '30 days') AS total_eligible
     FROM fm_company`
  );
  const churned30d = parseInt(churnResult.rows[0].churned_30d || 0, 10);
  const totalEligible = parseInt(churnResult.rows[0].total_eligible || 1, 10);
  const churnRate = totalEligible > 0 ? ((churned30d / totalEligible) * 100).toFixed(1) : 0;

  // Calculate MoM growth
  const lastMonthMrr = await db.query(
    `SELECT COALESCE(SUM(p.monthly_price_cents / 100.0), 0) AS mrr
     FROM fm_company fc
     LEFT JOIN packages p ON fc.package_id = p.id
     WHERE fc.status IN ('active', 'past_due')
       AND fc.paid_start_at IS NOT NULL
       AND fc.paid_start_at < NOW() - INTERVAL '30 days'`
  );
  const currentMrr = parseFloat(mrrResult.rows[0].mrr || 0);
  const prevMrr = parseFloat(lastMonthMrr.rows[0].mrr || 0);
  const momGrowth = prevMrr > 0 ? (((currentMrr - prevMrr) / prevMrr) * 100).toFixed(1) : 0;

  // Revenue trend - last 6 months
  const revenueTrend = await db.query(
    `SELECT
       TO_CHAR(date_trunc('month', fc.paid_start_at), 'YYYY-MM') AS month,
       COUNT(*) AS new_subscribers,
       COALESCE(SUM(p.monthly_price_cents / 100.0), 0) AS revenue_added
     FROM fm_company fc
     LEFT JOIN packages p ON fc.package_id = p.id
     WHERE fc.paid_start_at IS NOT NULL
       AND fc.paid_start_at >= NOW() - INTERVAL '6 months'
     GROUP BY date_trunc('month', fc.paid_start_at)
     ORDER BY month ASC`
  );

  // Trial conversion rate (last 90 days)
  const conversionResult = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE trial_start_at >= NOW() - INTERVAL '90 days') AS total_trials,
       COUNT(*) FILTER (WHERE trial_start_at >= NOW() - INTERVAL '90 days' AND paid_start_at IS NOT NULL) AS converted
     FROM fm_company`
  );
  const totalTrials = parseInt(conversionResult.rows[0].total_trials || 0, 10);
  const converted = parseInt(conversionResult.rows[0].converted || 0, 10);
  const conversionRate = totalTrials > 0 ? ((converted / totalTrials) * 100).toFixed(1) : 0;

  const trialsEnding = await db.query(
    `SELECT id, name, trial_end_at, owner_email
     FROM fm_company
     WHERE status = 'trial' AND trial_end_at IS NOT NULL
       AND trial_end_at <= NOW() + INTERVAL '7 days'
     ORDER BY trial_end_at ASC
     LIMIT 20`
  );

  const paymentFailures = await db.query(
    `SELECT id, name, status, current_period_end_at, owner_email
     FROM fm_company
     WHERE status = 'past_due'
     ORDER BY current_period_end_at DESC NULLS LAST
     LIMIT 50`
  );

  const inactiveTrials = await db.query(
    `SELECT id, name, trial_start_at, last_activity_at, owner_email
     FROM fm_company
     WHERE status = 'trial'
       AND (last_activity_at IS NULL OR last_activity_at <= NOW() - INTERVAL '72 hours')
     ORDER BY trial_start_at DESC NULLS LAST
     LIMIT 50`
  );

  res.json({
    kpis: {
      total_companies: parseInt(totals.rows[0].total_companies, 10),
      active_companies: parseInt(totals.rows[0].active_companies, 10),
      active_trials: parseInt(totals.rows[0].active_trials, 10),
      trials_ending_7d: trialsEnding.rows.length,
      paid_companies: parseInt(totals.rows[0].paid_companies, 10),
      mrr: currentMrr,
      arr: arr,
      churn_rate: parseFloat(churnRate),
      mom_growth: parseFloat(momGrowth),
      conversion_rate: parseFloat(conversionRate),
      new_signups_24h: parseInt(newSignups.rows[0].count, 10),
      payment_issues: parseInt(totals.rows[0].payment_issues, 10),
    },
    revenue_trend: revenueTrend.rows,
    attention: {
      trials_ending: trialsEnding.rows,
      payment_failures: paymentFailures.rows,
      inactive_trials: inactiveTrials.rows,
    },
  });
});

export default router;
