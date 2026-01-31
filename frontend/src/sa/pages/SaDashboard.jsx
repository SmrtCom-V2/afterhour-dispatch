import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { saApi } from '../api';

// Icons
const CompaniesIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
  </svg>
);

const TrialIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const DollarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const AlertIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const TrendUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const TrendDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </svg>
);

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CreditCardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="4" width="22" height="16" rx="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const ActivityIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const ChartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const PercentIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonth(monthStr) {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(year, parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short' });
}

// Simple bar chart component
function RevenueChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="sa-chart-empty">
        <ChartIcon />
        <p>No revenue data available</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map(d => parseFloat(d.revenue_added) || 0), 1);

  return (
    <div className="sa-revenue-chart">
      <div className="sa-chart-bars">
        {data.map((item, index) => {
          const height = ((parseFloat(item.revenue_added) || 0) / maxRevenue) * 100;
          return (
            <div key={index} className="sa-chart-bar-container">
              <div className="sa-chart-bar-wrapper">
                <div
                  className="sa-chart-bar"
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${formatCurrency(item.revenue_added)} (${item.new_subscribers} new)`}
                />
              </div>
              <div className="sa-chart-label">{formatMonth(item.month)}</div>
              <div className="sa-chart-value">{formatCurrency(item.revenue_added)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SaDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setError('');
      setLoading(true);
      try {
        const response = await saApi.getDashboard();
        setData(response);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const kpis = data?.kpis || {};
  const attention = data?.attention || {};
  const revenueTrend = data?.revenue_trend || [];

  if (loading) {
    return (
      <div className="sa-loading">
        <div className="sa-loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="sa-page">
      {/* Page Header */}
      <div className="sa-page-header">
        <div className="sa-page-header-content">
          <p className="sa-eyebrow">Super Admin</p>
          <h1 className="sa-page-title">Dashboard</h1>
          <p className="sa-page-subtitle">Business overview and attention queues</p>
        </div>
        <div className="sa-header-actions">
          <Link className="sa-btn sa-btn-primary" to="/sa/companies">
            View All Companies
            <ArrowRightIcon />
          </Link>
        </div>
      </div>

      {error && <div className="sa-error">{error}</div>}

      {/* Revenue KPIs - Top Row */}
      <div className="sa-section-title">Revenue Metrics</div>
      <div className="sa-stats-grid sa-stats-grid-4">
        {/* MRR */}
        <div className="sa-stat-card info">
          <div className="sa-stat-header">
            <div className="sa-stat-icon info">
              <DollarIcon />
            </div>
          </div>
          <div className="sa-stat-value">{formatCurrency(kpis.mrr)}</div>
          <div className="sa-stat-label">Monthly Recurring Revenue</div>
          <div className={`sa-stat-trend ${kpis.mom_growth >= 0 ? 'up' : 'down'}`}>
            {kpis.mom_growth >= 0 ? <TrendUpIcon /> : <TrendDownIcon />}
            {kpis.mom_growth >= 0 ? '+' : ''}{kpis.mom_growth}% MoM
          </div>
        </div>

        {/* ARR */}
        <div className="sa-stat-card success">
          <div className="sa-stat-header">
            <div className="sa-stat-icon success">
              <ChartIcon />
            </div>
          </div>
          <div className="sa-stat-value">{formatCurrency(kpis.arr)}</div>
          <div className="sa-stat-label">Annual Recurring Revenue</div>
          <div className="sa-stat-trend up">
            <TrendUpIcon />
            {kpis.paid_companies ?? 0} paying customers
          </div>
        </div>

        {/* Churn Rate */}
        <div className="sa-stat-card warning">
          <div className="sa-stat-header">
            <div className="sa-stat-icon warning">
              <PercentIcon />
            </div>
          </div>
          <div className="sa-stat-value">{kpis.churn_rate ?? 0}%</div>
          <div className="sa-stat-label">Churn Rate (30d)</div>
          <div className={`sa-stat-trend ${kpis.churn_rate <= 5 ? 'up' : 'down'}`}>
            {kpis.churn_rate <= 5 ? <TrendUpIcon /> : <TrendDownIcon />}
            {kpis.churn_rate <= 5 ? 'Healthy' : 'Needs attention'}
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="sa-stat-card primary">
          <div className="sa-stat-header">
            <div className="sa-stat-icon primary">
              <ActivityIcon />
            </div>
          </div>
          <div className="sa-stat-value">{kpis.conversion_rate ?? 0}%</div>
          <div className="sa-stat-label">Trial Conversion (90d)</div>
          <div className={`sa-stat-trend ${kpis.conversion_rate >= 10 ? 'up' : 'neutral'}`}>
            {kpis.conversion_rate >= 10 ? <TrendUpIcon /> : <ClockIcon />}
            Trial to Paid
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="sa-card" style={{ marginBottom: 24 }}>
        <div className="sa-card-header">
          <div>
            <h3 className="sa-card-title">Revenue Trend (6 Months)</h3>
            <p className="sa-card-subtitle">New MRR added per month</p>
          </div>
        </div>
        <RevenueChart data={revenueTrend} />
      </div>

      {/* Company Stats */}
      <div className="sa-section-title">Company Metrics</div>
      <div className="sa-stats-grid">
        {/* Total Companies */}
        <div className="sa-stat-card primary">
          <div className="sa-stat-header">
            <div className="sa-stat-icon primary">
              <CompaniesIcon />
            </div>
          </div>
          <div className="sa-stat-value">{kpis.total_companies ?? 0}</div>
          <div className="sa-stat-label">Total Companies</div>
          <div className="sa-stat-trend up">
            <TrendUpIcon />
            +{kpis.new_signups_24h ?? 0} today
          </div>
        </div>

        {/* Active Trials */}
        <div className="sa-stat-card warning">
          <div className="sa-stat-header">
            <div className="sa-stat-icon warning">
              <TrialIcon />
            </div>
          </div>
          <div className="sa-stat-value">{kpis.active_trials ?? 0}</div>
          <div className="sa-stat-label">Active Trials</div>
          <div className="sa-stat-trend neutral">
            <ClockIcon />
            {kpis.trials_ending_7d ?? 0} ending in 7 days
          </div>
        </div>

        {/* Paid Companies */}
        <div className="sa-stat-card success">
          <div className="sa-stat-header">
            <div className="sa-stat-icon success">
              <CompaniesIcon />
            </div>
          </div>
          <div className="sa-stat-value">{kpis.paid_companies ?? 0}</div>
          <div className="sa-stat-label">Paid Companies</div>
          <div className="sa-stat-trend up">
            <TrendUpIcon />
            Active subscriptions
          </div>
        </div>

        {/* Payment Issues */}
        <div className="sa-stat-card danger">
          <div className="sa-stat-header">
            <div className="sa-stat-icon danger">
              <AlertIcon />
            </div>
          </div>
          <div className="sa-stat-value">{kpis.payment_issues ?? 0}</div>
          <div className="sa-stat-label">Payment Issues</div>
          {kpis.payment_issues > 0 ? (
            <div className="sa-stat-trend down">
              <TrendDownIcon />
              Needs attention
            </div>
          ) : (
            <div className="sa-stat-trend up">
              <TrendUpIcon />
              All payments healthy
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="sa-quick-actions">
        <Link to="/sa/companies?filter=trial" className="sa-quick-action">
          <div className="sa-quick-action-icon">
            <TrialIcon />
          </div>
          <div className="sa-quick-action-content">
            <div className="sa-quick-action-title">Manage Trials</div>
            <div className="sa-quick-action-desc">Extend, convert, or review trials</div>
          </div>
        </Link>

        <Link to="/sa/billing" className="sa-quick-action">
          <div className="sa-quick-action-icon" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <CreditCardIcon />
          </div>
          <div className="sa-quick-action-content">
            <div className="sa-quick-action-title">Billing Overview</div>
            <div className="sa-quick-action-desc">Revenue, invoices, payments</div>
          </div>
        </Link>

        <Link to="/sa/usage" className="sa-quick-action">
          <div className="sa-quick-action-icon" style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
            <ActivityIcon />
          </div>
          <div className="sa-quick-action-content">
            <div className="sa-quick-action-title">Usage Analytics</div>
            <div className="sa-quick-action-desc">Activity metrics and trends</div>
          </div>
        </Link>

        <Link to="/sa/users" className="sa-quick-action">
          <div className="sa-quick-action-icon" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
            <UserIcon />
          </div>
          <div className="sa-quick-action-content">
            <div className="sa-quick-action-title">SA Users</div>
            <div className="sa-quick-action-desc">Manage super admin access</div>
          </div>
        </Link>
      </div>

      {/* Attention Queues */}
      <div className="sa-dashboard-grid">
        {/* Trials Ending Soon */}
        <div className="sa-attention-card">
          <div className="sa-attention-header">
            <div className="sa-attention-title">
              <ClockIcon />
              Trials Ending Soon
              {(attention.trials_ending?.length || 0) > 0 && (
                <span className="sa-attention-count">{attention.trials_ending.length}</span>
              )}
            </div>
            <Link to="/sa/trials" className="sa-action-btn">
              View All
            </Link>
          </div>
          <div className="sa-attention-body">
            {(attention.trials_ending || []).length === 0 ? (
              <div className="sa-empty" style={{ padding: '40px 20px' }}>
                <div className="sa-empty-icon"><ClockIcon /></div>
                <div className="sa-empty-title">No trials ending soon</div>
                <div className="sa-empty-text">All trials have more than 7 days remaining</div>
              </div>
            ) : (
              attention.trials_ending.map((row) => (
                <div
                  key={row.id}
                  className="sa-attention-item"
                  onClick={() => navigate(`/sa/companies/${row.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="sa-attention-item-icon warning">
                    <ClockIcon />
                  </div>
                  <div className="sa-attention-item-content">
                    <div className="sa-attention-item-title">{row.name}</div>
                    <div className="sa-attention-item-meta">
                      Ends {formatDate(row.trial_end_at)} · {row.owner_email || 'No owner'}
                    </div>
                  </div>
                  <button
                    className="sa-action-btn primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/sa/companies/${row.id}?action=extend-trial`);
                    }}
                  >
                    Extend
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Payment Failures */}
        <div className="sa-attention-card">
          <div className="sa-attention-header">
            <div className="sa-attention-title">
              <CreditCardIcon />
              Payment Failures
              {(attention.payment_failures?.length || 0) > 0 && (
                <span className="sa-attention-count">{attention.payment_failures.length}</span>
              )}
            </div>
            <Link to="/sa/billing?filter=failed" className="sa-action-btn">
              View All
            </Link>
          </div>
          <div className="sa-attention-body">
            {(attention.payment_failures || []).length === 0 ? (
              <div className="sa-empty" style={{ padding: '40px 20px' }}>
                <div className="sa-empty-icon"><CreditCardIcon /></div>
                <div className="sa-empty-title">No payment failures</div>
                <div className="sa-empty-text">All payments are processing correctly</div>
              </div>
            ) : (
              attention.payment_failures.map((row) => (
                <div
                  key={row.id}
                  className="sa-attention-item"
                  onClick={() => navigate(`/sa/companies/${row.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="sa-attention-item-icon danger">
                    <CreditCardIcon />
                  </div>
                  <div className="sa-attention-item-content">
                    <div className="sa-attention-item-title">{row.name}</div>
                    <div className="sa-attention-item-meta">
                      Status: {row.status} · Renewal: {formatDate(row.current_period_end_at)}
                    </div>
                  </div>
                  <button
                    className="sa-action-btn danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/sa/companies/${row.id}?tab=billing`);
                    }}
                  >
                    Review
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Inactive Trials */}
      <div className="sa-card">
        <div className="sa-card-header">
          <div>
            <h3 className="sa-card-title">Inactive Trials (72h)</h3>
            <p className="sa-card-subtitle">Trials with no recent activity - may need outreach</p>
          </div>
          <Link to="/sa/companies?filter=inactive" className="sa-action-btn">
            View All Inactive
          </Link>
        </div>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Last Activity</th>
                <th>Trial Started</th>
                <th>Owner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(attention.inactive_trials || []).length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="sa-empty" style={{ padding: '40px 20px' }}>
                      <div className="sa-empty-icon"><ActivityIcon /></div>
                      <div className="sa-empty-title">No inactive trials</div>
                      <div className="sa-empty-text">All trial users have been active recently</div>
                    </div>
                  </td>
                </tr>
              ) : (
                attention.inactive_trials.map((row) => (
                  <tr key={row.id} className="clickable" onClick={() => navigate(`/sa/companies/${row.id}`)}>
                    <td>
                      <div className="sa-table-cell-main">{row.name}</div>
                      <div className="sa-table-cell-sub">{row.id}</div>
                    </td>
                    <td>{formatDate(row.last_activity_at)}</td>
                    <td>{formatDate(row.trial_start_at)}</td>
                    <td>{row.owner_email || '-'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="sa-actions">
                        <button
                          className="sa-action-btn"
                          onClick={() => navigate(`/sa/companies/${row.id}`)}
                        >
                          View
                        </button>
                        <button
                          className="sa-action-btn primary"
                          onClick={() => navigate(`/sa/companies/${row.id}?action=contact`)}
                        >
                          Contact
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
