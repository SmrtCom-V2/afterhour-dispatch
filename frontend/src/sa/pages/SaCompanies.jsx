import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { saApi } from '../api';

// Icons
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FilterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const ExportIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CreditCardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="4" width="22" height="16" rx="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
  </svg>
);

const STATUS_OPTIONS = ['trial', 'active', 'past_due', 'suspended', 'cancelled'];

const STATUS_CONFIG = {
  trial: { label: 'Trial', className: 'sa-status-trial' },
  active: { label: 'Active', className: 'sa-status-active' },
  past_due: { label: 'Past Due', className: 'sa-status-past_due' },
  suspended: { label: 'Suspended', className: 'sa-status-suspended' },
  cancelled: { label: 'Cancelled', className: 'sa-status-cancelled' },
};

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateShort(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short'
  });
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = date - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function SaCompanies() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    plan_id: '',
    signup_start: '',
    signup_end: '',
    trial_ends_in: '',
    no_activity_days: '',
    payment_failed: searchParams.get('filter') === 'failed',
    over_limit: false,
  });

  const [pagination, setPagination] = useState({
    limit: 25,
    offset: 0,
  });

  const queryParams = useMemo(() => ({
    search: filters.search,
    status: filters.status,
    plan_id: filters.plan_id,
    signup_start: filters.signup_start,
    signup_end: filters.signup_end,
    trial_ends_in: filters.trial_ends_in,
    no_activity_days: filters.no_activity_days,
    payment_failed: filters.payment_failed ? 'true' : '',
    over_limit: filters.over_limit ? 'true' : '',
    limit: pagination.limit,
    offset: pagination.offset,
  }), [filters, pagination]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await saApi.getCompanies(queryParams);
        setCompanies(data.companies || []);
        setTotal(data.total || 0);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [queryParams]);

  const handleRefresh = () => {
    setPagination({ ...pagination, offset: 0 });
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      plan_id: '',
      signup_start: '',
      signup_end: '',
      trial_ends_in: '',
      no_activity_days: '',
      payment_failed: false,
      over_limit: false,
    });
    setPagination({ ...pagination, offset: 0 });
    setSearchParams({});
  };

  const hasActiveFilters = filters.status || filters.plan_id || filters.signup_start ||
    filters.signup_end || filters.trial_ends_in || filters.no_activity_days ||
    filters.payment_failed || filters.over_limit;

  const pageCount = Math.max(1, Math.ceil(total / pagination.limit));
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="sa-page">
      {/* Page Header */}
      <div className="sa-page-header">
        <div className="sa-page-header-content">
          <p className="sa-eyebrow">Super Admin</p>
          <h1 className="sa-page-title">Companies</h1>
          <p className="sa-page-subtitle">
            {total} companies total · Search, filter, and manage all FM clients
          </p>
        </div>
        <div className="sa-header-actions">
          <button className="sa-btn sa-btn-secondary" onClick={handleRefresh}>
            <RefreshIcon />
            Refresh
          </button>
          <button className="sa-btn sa-btn-secondary">
            <ExportIcon />
            Export
          </button>
          <button className="sa-btn sa-btn-primary" onClick={() => navigate('/sa/companies/new')}>
            <PlusIcon />
            Add Company
          </button>
        </div>
      </div>

      {error && <div className="sa-error">{error}</div>}

      {/* Search and Filter Bar */}
      <div className="sa-card">
        <div className="sa-card-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <div className="sa-search-wrapper" style={{ flex: '1', minWidth: '240px', maxWidth: '400px' }}>
              <SearchIcon />
              <input
                className="sa-search-input"
                value={filters.search}
                placeholder="Search by name, email, or ID..."
                onChange={(e) => {
                  setFilters({ ...filters, search: e.target.value });
                  setPagination({ ...pagination, offset: 0 });
                }}
              />
            </div>

            {/* Status Filter */}
            <select
              className="sa-input"
              style={{ width: '160px' }}
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value });
                setPagination({ ...pagination, offset: 0 });
              }}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {STATUS_CONFIG[status]?.label || status}
                </option>
              ))}
            </select>

            {/* Toggle Advanced Filters */}
            <button
              className={`sa-btn ${showFilters ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <FilterIcon />
              {hasActiveFilters ? 'Filters Active' : 'More Filters'}
            </button>

            {hasActiveFilters && (
              <button className="sa-btn sa-btn-ghost" onClick={clearFilters}>
                Clear Filters
              </button>
            )}
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
              <div className="sa-filter-bar">
                <label className="sa-filter">
                  <span className="sa-filter-label">Signup After</span>
                  <input
                    className="sa-input"
                    type="date"
                    value={filters.signup_start}
                    onChange={(e) => {
                      setFilters({ ...filters, signup_start: e.target.value });
                      setPagination({ ...pagination, offset: 0 });
                    }}
                  />
                </label>

                <label className="sa-filter">
                  <span className="sa-filter-label">Signup Before</span>
                  <input
                    className="sa-input"
                    type="date"
                    value={filters.signup_end}
                    onChange={(e) => {
                      setFilters({ ...filters, signup_end: e.target.value });
                      setPagination({ ...pagination, offset: 0 });
                    }}
                  />
                </label>

                <label className="sa-filter">
                  <span className="sa-filter-label">Trial Ends In (days)</span>
                  <input
                    className="sa-input"
                    type="number"
                    placeholder="e.g. 7"
                    value={filters.trial_ends_in}
                    onChange={(e) => {
                      setFilters({ ...filters, trial_ends_in: e.target.value });
                      setPagination({ ...pagination, offset: 0 });
                    }}
                  />
                </label>

                <label className="sa-filter">
                  <span className="sa-filter-label">No Activity (days)</span>
                  <input
                    className="sa-input"
                    type="number"
                    placeholder="e.g. 3"
                    value={filters.no_activity_days}
                    onChange={(e) => {
                      setFilters({ ...filters, no_activity_days: e.target.value });
                      setPagination({ ...pagination, offset: 0 });
                    }}
                  />
                </label>

                <label className="sa-filter sa-filter-checkbox">
                  <input
                    type="checkbox"
                    checked={filters.payment_failed}
                    onChange={(e) => {
                      setFilters({ ...filters, payment_failed: e.target.checked });
                      setPagination({ ...pagination, offset: 0 });
                    }}
                  />
                  <span>Payment Failed</span>
                </label>

                <label className="sa-filter sa-filter-checkbox">
                  <input
                    type="checkbox"
                    checked={filters.over_limit}
                    onChange={(e) => {
                      setFilters({ ...filters, over_limit: e.target.checked });
                      setPagination({ ...pagination, offset: 0 });
                    }}
                  />
                  <span>Over Usage Limit</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Companies Table */}
      <div className="sa-card">
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Subscription</th>
                <th>Usage</th>
                <th>Owner</th>
                <th>Last Activity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="sa-loading" style={{ padding: '40px 20px' }}>
                      <div className="sa-loading-spinner"></div>
                      <p>Loading companies...</p>
                    </div>
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="sa-empty" style={{ padding: '60px 20px' }}>
                      <div className="sa-empty-icon"><BuildingIcon /></div>
                      <div className="sa-empty-title">No companies found</div>
                      <div className="sa-empty-text">
                        {hasActiveFilters
                          ? 'Try adjusting your filters'
                          : 'No companies have been created yet'}
                      </div>
                      {hasActiveFilters && (
                        <button
                          className="sa-btn sa-btn-secondary"
                          style={{ marginTop: '16px' }}
                          onClick={clearFilters}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                companies.map((company) => {
                  const trialDaysLeft = company.status === 'trial' ? getDaysUntil(company.trial_end_at) : null;

                  return (
                    <tr
                      key={company.id}
                      className="clickable"
                      onClick={() => navigate(`/sa/companies/${company.id}`)}
                    >
                      {/* Company */}
                      <td>
                        <div className="sa-table-cell-main">{company.name}</div>
                        <div className="sa-table-cell-sub" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                          {company.id}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`sa-status ${STATUS_CONFIG[company.status]?.className || ''}`}>
                          <span className={`sa-status-dot ${company.status}`}></span>
                          {STATUS_CONFIG[company.status]?.label || company.status}
                        </span>
                        {trialDaysLeft !== null && trialDaysLeft <= 7 && (
                          <div style={{ marginTop: '4px', fontSize: '11px', color: trialDaysLeft <= 3 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                            {trialDaysLeft <= 0 ? 'Expired' : `${trialDaysLeft}d left`}
                          </div>
                        )}
                      </td>

                      {/* Plan */}
                      <td>
                        <div style={{ fontWeight: 500 }}>{company.plan_name || 'No Plan'}</div>
                        {company.status !== 'trial' && company.current_period_end_at && (
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            Renews {formatDateShort(company.current_period_end_at)}
                          </div>
                        )}
                      </td>

                      {/* Subscription Dates */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}>
                            <span style={{ opacity: 0.6 }}>Signup:</span>
                            {formatDateShort(company.created_at)}
                          </div>
                          {company.status === 'trial' && company.trial_end_at && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-warning)' }}>
                              <ClockIcon />
                              Trial ends {formatDateShort(company.trial_end_at)}
                            </div>
                          )}
                          {company.paid_start_at && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)' }}>
                              <CreditCardIcon />
                              Paid since {formatDateShort(company.paid_start_at)}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Usage */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <UserIcon />
                            <span>{company.seats_used ?? 0}/{company.seats_limit ?? '∞'} seats</span>
                          </div>
                          {company.usage_primary_metric && (
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                              {company.usage_primary_metric}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Owner */}
                      <td>
                        {company.owner_email ? (
                          <div>
                            <div style={{ fontWeight: 500, fontSize: '13px' }}>{company.owner_name || '-'}</div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                              {company.owner_email}
                            </div>
                          </div>
                        ) : (
                          <span className="sa-muted">No owner</span>
                        )}
                      </td>

                      {/* Last Activity */}
                      <td>
                        {company.last_activity_at ? (
                          <div>
                            <div>{formatDateShort(company.last_activity_at)}</div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                              {getDaysUntil(company.last_activity_at) === 0 ? 'Today' :
                                getDaysUntil(company.last_activity_at) === -1 ? 'Yesterday' :
                                  `${Math.abs(getDaysUntil(company.last_activity_at))}d ago`}
                            </div>
                          </div>
                        ) : (
                          <span className="sa-muted">Never</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="sa-actions">
                          <Link
                            to={`/sa/companies/${company.id}`}
                            className="sa-action-btn primary"
                          >
                            <EyeIcon />
                            View
                          </Link>
                          {company.status === 'trial' && (
                            <button
                              className="sa-action-btn"
                              onClick={() => navigate(`/sa/companies/${company.id}?action=extend-trial`)}
                            >
                              <ClockIcon />
                              Extend
                            </button>
                          )}
                          {company.status === 'active' && (
                            <button
                              className="sa-action-btn"
                              onClick={() => navigate(`/sa/companies/${company.id}?action=change-plan`)}
                            >
                              <CreditCardIcon />
                              Plan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && companies.length > 0 && (
          <div className="sa-pagination">
            <button
              className="sa-btn sa-btn-secondary sa-btn-sm"
              disabled={currentPage === 1}
              onClick={() => setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) })}
            >
              <ChevronLeftIcon />
              Previous
            </button>
            <span className="sa-pagination-info">
              Page {currentPage} of {pageCount} · Showing {companies.length} of {total} companies
            </span>
            <button
              className="sa-btn sa-btn-secondary sa-btn-sm"
              disabled={currentPage >= pageCount}
              onClick={() => setPagination({ ...pagination, offset: pagination.offset + pagination.limit })}
            >
              Next
              <ChevronRightIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
