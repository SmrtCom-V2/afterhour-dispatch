import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saApi } from '../api';

// Icons
const DollarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const ChartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const CreditCardIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="4" width="22" height="16" rx="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
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

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
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

// Revenue Chart Component
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

export function SaBilling() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Overview data
  const [overview, setOverview] = useState(null);

  // Subscriptions data
  const [subscriptions, setSubscriptions] = useState([]);
  const [subscriptionSearch, setSubscriptionSearch] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('all');

  // Failures data
  const [failures, setFailures] = useState([]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setError('');
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const res = await saApi.getBillingOverview();
        setOverview(res);
      } else if (activeTab === 'subscriptions') {
        const res = await saApi.getBillingSubscriptions({
          status: subscriptionStatus !== 'all' ? subscriptionStatus : undefined,
          search: subscriptionSearch || undefined,
        });
        setSubscriptions(res.subscriptions || []);
      } else if (activeTab === 'failures') {
        const res = await saApi.getBillingFailures();
        setFailures(res.failures || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadData();
  };

  const stats = overview?.stats || {};
  const revenueByPlan = overview?.revenue_by_plan || [];
  const revenueTrend = overview?.revenue_trend || [];

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div className="sa-page-header-content">
          <p className="sa-eyebrow">Super Admin</p>
          <h1 className="sa-page-title">Billing & Revenue</h1>
          <p className="sa-page-subtitle">Subscription management and revenue analytics</p>
        </div>
      </div>

      {error && <div className="sa-error">{error}</div>}

      {/* Tabs */}
      <div className="sa-tabs">
        <button
          className={`sa-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <ChartIcon /> Overview
        </button>
        <button
          className={`sa-tab ${activeTab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscriptions')}
        >
          <CreditCardIcon /> Subscriptions
        </button>
        <button
          className={`sa-tab ${activeTab === 'failures' ? 'active' : ''}`}
          onClick={() => setActiveTab('failures')}
        >
          <AlertIcon /> Payment Failures
          {failures.length > 0 && (
            <span className="sa-nav-badge">{failures.length}</span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="sa-loading">
          <div className="sa-loading-spinner"></div>
          <p>Loading billing data...</p>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* KPI Stats */}
              <div className="sa-stats-grid sa-stats-grid-4">
                <div className="sa-stat-card info">
                  <div className="sa-stat-header">
                    <div className="sa-stat-icon info">
                      <DollarIcon />
                    </div>
                  </div>
                  <div className="sa-stat-value">{formatCurrency(stats.current_mrr)}</div>
                  <div className="sa-stat-label">Monthly Recurring Revenue</div>
                  <div className="sa-stat-trend up">
                    <TrendUpIcon />
                    Active
                  </div>
                </div>

                <div className="sa-stat-card success">
                  <div className="sa-stat-header">
                    <div className="sa-stat-icon success">
                      <ChartIcon />
                    </div>
                  </div>
                  <div className="sa-stat-value">{formatCurrency(stats.arr)}</div>
                  <div className="sa-stat-label">Annual Recurring Revenue</div>
                  <div className="sa-stat-trend up">
                    <TrendUpIcon />
                    Projected
                  </div>
                </div>

                <div className="sa-stat-card primary">
                  <div className="sa-stat-header">
                    <div className="sa-stat-icon primary">
                      <CreditCardIcon />
                    </div>
                  </div>
                  <div className="sa-stat-value">{stats.active_subscriptions ?? 0}</div>
                  <div className="sa-stat-label">Active Subscriptions</div>
                  <div className="sa-stat-trend up">
                    <TrendUpIcon />
                    Paying customers
                  </div>
                </div>

                <div className="sa-stat-card danger">
                  <div className="sa-stat-header">
                    <div className="sa-stat-icon danger">
                      <AlertIcon />
                    </div>
                  </div>
                  <div className="sa-stat-value">{stats.past_due_count ?? 0}</div>
                  <div className="sa-stat-label">Past Due</div>
                  <div className="sa-stat-trend neutral">
                    {stats.cancelled_30d ?? 0} cancelled (30d)
                  </div>
                </div>
              </div>

              {/* Revenue Chart */}
              <div className="sa-card" style={{ marginTop: 24 }}>
                <div className="sa-card-header">
                  <div>
                    <h3 className="sa-card-title">Revenue Trend (12 Months)</h3>
                    <p className="sa-card-subtitle">New MRR added per month</p>
                  </div>
                </div>
                <RevenueChart data={revenueTrend} />
              </div>

              {/* Revenue by Plan */}
              <div className="sa-card" style={{ marginTop: 24 }}>
                <div className="sa-card-header">
                  <div>
                    <h3 className="sa-card-title">Revenue by Plan</h3>
                    <p className="sa-card-subtitle">Breakdown of MRR by subscription tier</p>
                  </div>
                </div>
                <div className="sa-table-container">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th>Subscribers</th>
                        <th>Monthly Revenue</th>
                        <th>% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueByPlan.length === 0 ? (
                        <tr>
                          <td colSpan={4}>
                            <div className="sa-empty" style={{ padding: '40px 20px' }}>
                              <div className="sa-empty-icon"><ChartIcon /></div>
                              <div className="sa-empty-title">No plan data</div>
                              <div className="sa-empty-text">No active subscriptions yet</div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        revenueByPlan.map((plan, index) => {
                          const percentage = stats.current_mrr > 0
                            ? ((parseFloat(plan.monthly_revenue) / stats.current_mrr) * 100).toFixed(1)
                            : 0;
                          return (
                            <tr key={index}>
                              <td>
                                <div className="sa-table-cell-main">{plan.plan_name}</div>
                              </td>
                              <td>{plan.subscriber_count}</td>
                              <td>{formatCurrency(plan.monthly_revenue)}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{
                                    width: 60,
                                    height: 6,
                                    background: 'var(--color-bg-hover)',
                                    borderRadius: 3,
                                    overflow: 'hidden',
                                  }}>
                                    <div style={{
                                      width: `${percentage}%`,
                                      height: '100%',
                                      background: 'var(--color-primary)',
                                    }} />
                                  </div>
                                  <span>{percentage}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Subscriptions Tab */}
          {activeTab === 'subscriptions' && (
            <>
              {/* Filters */}
              <div className="sa-filters">
                <div className="sa-search-wrapper" style={{ flex: 1, maxWidth: 400 }}>
                  <SearchIcon className="sa-search-icon" />
                  <input
                    type="text"
                    className="sa-search-input"
                    placeholder="Search by company name or email..."
                    value={subscriptionSearch}
                    onChange={(e) => setSubscriptionSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <div className="sa-filter">
                  <label className="sa-filter-label">Status</label>
                  <select
                    className="sa-input"
                    value={subscriptionStatus}
                    onChange={(e) => {
                      setSubscriptionStatus(e.target.value);
                      setTimeout(loadData, 0);
                    }}
                    style={{ width: 160 }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="past_due">Past Due</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <button className="sa-btn sa-btn-primary" onClick={handleSearch}>
                  Search
                </button>
              </div>

              {/* Subscriptions Table */}
              <div className="sa-card">
                <div className="sa-table-container">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Plan</th>
                        <th>MRR</th>
                        <th>Status</th>
                        <th>Started</th>
                        <th>Next Billing</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            <div className="sa-empty" style={{ padding: '40px 20px' }}>
                              <div className="sa-empty-icon"><CreditCardIcon /></div>
                              <div className="sa-empty-title">No subscriptions found</div>
                              <div className="sa-empty-text">Try adjusting your filters</div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        subscriptions.map((sub) => (
                          <tr
                            key={sub.id}
                            className="clickable"
                            onClick={() => navigate(`/sa/companies/${sub.id}`)}
                          >
                            <td>
                              <div className="sa-table-cell-main">{sub.name}</div>
                              <div className="sa-table-cell-sub">{sub.owner_email}</div>
                            </td>
                            <td>{sub.plan_name || '-'}</td>
                            <td>{formatCurrency(sub.price_monthly)}</td>
                            <td>
                              <span className={`sa-status sa-status-${sub.status}`}>
                                {sub.status}
                              </span>
                            </td>
                            <td>{formatDate(sub.paid_start_at)}</td>
                            <td>{formatDate(sub.current_period_end_at)}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <div className="sa-actions">
                                <button
                                  className="sa-action-btn"
                                  onClick={() => navigate(`/sa/companies/${sub.id}?tab=billing`)}
                                >
                                  View
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
            </>
          )}

          {/* Failures Tab */}
          {activeTab === 'failures' && (
            <div className="sa-card">
              <div className="sa-card-header">
                <div>
                  <h3 className="sa-card-title">Payment Failures</h3>
                  <p className="sa-card-subtitle">Companies with past due payments requiring attention</p>
                </div>
              </div>
              <div className="sa-table-container">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Plan</th>
                      <th>Amount</th>
                      <th>Days Overdue</th>
                      <th>Owner</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failures.length === 0 ? (
                      <tr>
                        <td colSpan={6}>
                          <div className="sa-empty" style={{ padding: '40px 20px' }}>
                            <div className="sa-empty-icon"><CreditCardIcon /></div>
                            <div className="sa-empty-title">No payment failures</div>
                            <div className="sa-empty-text">All payments are processing correctly</div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      failures.map((f) => (
                        <tr
                          key={f.id}
                          className="clickable"
                          onClick={() => navigate(`/sa/companies/${f.id}`)}
                        >
                          <td>
                            <div className="sa-table-cell-main">{f.name}</div>
                            <div className="sa-table-cell-sub">{f.id}</div>
                          </td>
                          <td>{f.plan_name || '-'}</td>
                          <td>{formatCurrency(f.price_monthly)}</td>
                          <td>
                            <span style={{
                              color: f.days_overdue > 14 ? 'var(--color-danger)' :
                                     f.days_overdue > 7 ? 'var(--color-warning)' :
                                     'var(--color-text)',
                              fontWeight: 600,
                            }}>
                              {f.days_overdue ?? '-'} days
                            </span>
                          </td>
                          <td>{f.owner_email || '-'}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="sa-actions">
                              <button
                                className="sa-action-btn"
                                onClick={() => navigate(`/sa/companies/${f.id}?tab=billing`)}
                              >
                                Review
                              </button>
                              <button
                                className="sa-action-btn primary"
                                onClick={() => navigate(`/sa/companies/${f.id}?action=contact`)}
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
          )}
        </>
      )}
    </div>
  );
}
