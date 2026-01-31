import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { saApi } from '../api';

// Icons
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CreditCardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="4" width="22" height="16" rx="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const ActivityIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="10" y1="15" x2="10" y2="9" />
    <line x1="14" y1="15" x2="14" y2="9" />
  </svg>
);

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polygon points="10 8 16 12 10 16 10 8" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

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
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = date - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function SaCompanyDetail() {
  const { companyId } = useParams();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState(searchParams.get('tab') || 'overview');
  const [users, setUsers] = useState([]);
  const [notes, setNotes] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [impersonation, setImpersonation] = useState(null);

  const loadCompany = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await saApi.getCompany(companyId);
      setData(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompany();
  }, [companyId]);

  const loadUsers = async () => {
    try {
      const res = await saApi.getCompanyUsers(companyId);
      setUsers(res.users || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadNotes = async () => {
    try {
      const res = await saApi.getCompanyNotes(companyId);
      setNotes(res.notes || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await saApi.getAuditLogs({ company_id: companyId });
      setAuditLogs(res.logs || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'notes') loadNotes();
    if (tab === 'audit') loadAuditLogs();
  }, [tab, companyId]);

  const handleExtendTrial = async () => {
    const days = window.prompt('Extend trial by how many days? (e.g. 7, 14, 30):');
    if (!days || isNaN(days)) return;
    setActionLoading(true);
    try {
      await saApi.extendTrial(companyId, { days: parseInt(days, 10) });
      await loadCompany();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    const reason = window.prompt('Reason for suspension:');
    if (!reason) return;
    setActionLoading(true);
    try {
      await saApi.suspendCompany(companyId, { reason });
      await loadCompany();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    const reason = window.prompt('Reason for reactivation:');
    if (!reason) return;
    setActionLoading(true);
    try {
      await saApi.reactivateCompany(companyId, { reason });
      await loadCompany();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async () => {
    const note = window.prompt('Add internal note:');
    if (!note) return;
    setActionLoading(true);
    try {
      const headers = impersonation ? { 'X-Impersonated-Admin-Id': impersonation.adminId } : undefined;
      await saApi.request(`/companies/${companyId}/notes`, { method: 'POST', body: JSON.stringify({ note }), headers });
      await loadNotes();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartImpersonation = async (admin) => {
    if (!window.confirm(`Start impersonation for ${admin.email}? (view-only access)`)) return;
    try {
      const res = await saApi.startImpersonation(companyId, admin.id);
      setImpersonation({ adminId: res.admin.id, email: res.admin.email });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStopImpersonation = async () => {
    if (!impersonation) return;
    try {
      await saApi.stopImpersonation(companyId, impersonation.adminId);
      setImpersonation(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDisableUser = async (userId) => {
    if (!window.confirm('Are you sure you want to disable this user?')) return;
    setActionLoading(true);
    try {
      await saApi.disableUser(userId);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="sa-loading">
        <div className="sa-loading-spinner"></div>
        <p>Loading company details...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="sa-page">
        <div className="sa-error">Company not found.</div>
        <Link to="/sa/companies" className="sa-btn sa-btn-secondary" style={{ marginTop: '16px' }}>
          <ArrowLeftIcon />
          Back to Companies
        </Link>
      </div>
    );
  }

  const { company, events = [], billing = {}, usage = {} } = data;
  const trialDaysLeft = company.status === 'trial' ? getDaysUntil(company.trial_end_at) : null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <ShieldIcon /> },
    { id: 'billing', label: 'Billing', icon: <CreditCardIcon /> },
    { id: 'usage', label: 'Usage', icon: <ActivityIcon /> },
    { id: 'users', label: 'Users', icon: <UsersIcon /> },
    { id: 'notes', label: 'Notes', icon: <FileTextIcon /> },
    { id: 'audit', label: 'Audit', icon: <FileTextIcon /> },
  ];

  return (
    <div className="sa-page">
      {/* Impersonation Banner */}
      {impersonation && (
        <div className="sa-impersonation-banner">
          <span className="sa-impersonation-text">
            Impersonating: {impersonation.email}
          </span>
          <button className="sa-impersonation-btn" onClick={handleStopImpersonation}>
            Stop Impersonation
          </button>
        </div>
      )}

      {/* Back Link */}
      <Link to="/sa/companies" className="sa-btn sa-btn-ghost sa-btn-sm" style={{ marginBottom: '16px' }}>
        <ArrowLeftIcon />
        Back to Companies
      </Link>

      {/* Page Header */}
      <div className="sa-page-header">
        <div className="sa-page-header-content">
          <p className="sa-eyebrow">Company Detail</p>
          <h1 className="sa-page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {company.name}
            <span className={`sa-status ${STATUS_CONFIG[company.status]?.className || ''}`}>
              <span className={`sa-status-dot ${company.status}`}></span>
              {STATUS_CONFIG[company.status]?.label || company.status}
            </span>
          </h1>
          <p className="sa-page-subtitle" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
            {company.id}
          </p>
        </div>
        <div className="sa-header-actions">
          {company.status === 'trial' && (
            <button
              className="sa-btn sa-btn-secondary"
              onClick={handleExtendTrial}
              disabled={actionLoading}
            >
              <ClockIcon />
              Extend Trial
            </button>
          )}
          {company.status === 'suspended' ? (
            <button
              className="sa-btn sa-btn-primary"
              onClick={handleReactivate}
              disabled={actionLoading}
            >
              <PlayIcon />
              Reactivate
            </button>
          ) : (
            <button
              className="sa-btn sa-btn-secondary"
              onClick={handleSuspend}
              disabled={actionLoading}
            >
              <PauseIcon />
              Suspend
            </button>
          )}
        </div>
      </div>

      {error && <div className="sa-error">{error}</div>}

      {/* Quick Stats */}
      <div className="sa-stats-grid" style={{ marginBottom: '24px' }}>
        <div className="sa-stat-card primary">
          <div className="sa-stat-header">
            <div className="sa-stat-icon primary"><UsersIcon /></div>
          </div>
          <div className="sa-stat-value">{company.seats_used ?? 0}</div>
          <div className="sa-stat-label">
            Active Users / {company.seats_limit ?? '∞'} seats
          </div>
        </div>

        <div className="sa-stat-card info">
          <div className="sa-stat-header">
            <div className="sa-stat-icon info"><ActivityIcon /></div>
          </div>
          <div className="sa-stat-value">{company.last_activity_at ? formatDate(company.last_activity_at) : 'Never'}</div>
          <div className="sa-stat-label">Last Activity</div>
        </div>

        {company.status === 'trial' && (
          <div className={`sa-stat-card ${trialDaysLeft <= 3 ? 'danger' : trialDaysLeft <= 7 ? 'warning' : 'success'}`}>
            <div className="sa-stat-header">
              <div className={`sa-stat-icon ${trialDaysLeft <= 3 ? 'danger' : trialDaysLeft <= 7 ? 'warning' : 'success'}`}>
                <ClockIcon />
              </div>
            </div>
            <div className="sa-stat-value">{trialDaysLeft <= 0 ? 'Expired' : `${trialDaysLeft} days`}</div>
            <div className="sa-stat-label">Trial Remaining</div>
          </div>
        )}

        <div className="sa-stat-card success">
          <div className="sa-stat-header">
            <div className="sa-stat-icon success"><CreditCardIcon /></div>
          </div>
          <div className="sa-stat-value">{billing.plan_name || 'No Plan'}</div>
          <div className="sa-stat-label">
            {billing.current_period_end_at ? `Renews ${formatDate(billing.current_period_end_at)}` : 'No billing'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sa-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`sa-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="sa-dashboard-grid">
          {/* Company Details */}
          <div className="sa-card">
            <div className="sa-card-header">
              <h3 className="sa-card-title">Company Information</h3>
            </div>
            <div className="sa-card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Company Name</div>
                  <div style={{ fontWeight: 600 }}>{company.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Status</div>
                  <span className={`sa-status ${STATUS_CONFIG[company.status]?.className || ''}`}>
                    {STATUS_CONFIG[company.status]?.label || company.status}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Owner</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MailIcon />
                    {company.owner_email || 'No owner'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Signup Date</div>
                  <div>{formatDate(company.created_at)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Trial End</div>
                  <div>{formatDate(company.trial_end_at)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Current Plan</div>
                  <div>{company.plan_id || billing.plan_name || 'No Plan'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="sa-card">
            <div className="sa-card-header">
              <h3 className="sa-card-title">Recent Events</h3>
            </div>
            <div className="sa-card-body">
              {events.length === 0 ? (
                <div className="sa-empty" style={{ padding: '40px 20px' }}>
                  <div className="sa-empty-title">No events yet</div>
                  <div className="sa-empty-text">Activity will appear here</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {events.slice(0, 10).map((event) => (
                    <div
                      key={event.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        background: 'var(--color-bg-hover)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                      }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{event.type}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {formatDateTime(event.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'billing' && (
        <div className="sa-card">
          <div className="sa-card-header">
            <h3 className="sa-card-title">Billing & Subscription</h3>
          </div>
          <div className="sa-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Plan</div>
                <div style={{ fontWeight: 600, fontSize: '18px' }}>{billing.plan_name || 'No Plan'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Billing Status</div>
                <div style={{ fontWeight: 600 }}>{billing.status || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Next Renewal</div>
                <div style={{ fontWeight: 600 }}>{formatDate(billing.current_period_end_at)}</div>
              </div>
            </div>
            <div className="sa-empty" style={{ padding: '40px 20px' }}>
              <div className="sa-empty-title">Billing Provider Integration</div>
              <div className="sa-empty-text">Detailed invoice and payment history coming soon</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'usage' && (
        <div className="sa-card">
          <div className="sa-card-header">
            <h3 className="sa-card-title">Usage Analytics</h3>
          </div>
          <div className="sa-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Last Activity</div>
                <div style={{ fontWeight: 600 }}>{formatDateTime(company.last_activity_at)}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Seats Used</div>
                <div style={{ fontWeight: 600, fontSize: '18px' }}>
                  {company.seats_used ?? 0} / {company.seats_limit ?? '∞'}
                  {company.seats_limit > 0 && company.seats_used > company.seats_limit && (
                    <span style={{ color: 'var(--color-danger)', marginLeft: '8px' }}>Over Limit</span>
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Usage Range</div>
                <div style={{ fontWeight: 600 }}>{usage.range || 'Last 30 days'}</div>
              </div>
            </div>
            <div className="sa-empty" style={{ padding: '40px 20px' }}>
              <div className="sa-empty-title">Usage Metrics</div>
              <div className="sa-empty-text">Detailed usage analytics coming soon</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="sa-card">
          <div className="sa-card-header">
            <h3 className="sa-card-title">Users ({users.length})</h3>
            <button className="sa-btn sa-btn-secondary sa-btn-sm" onClick={loadUsers}>
              <RefreshIcon /> Refresh
            </button>
          </div>
          <div className="sa-table-container">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="sa-empty" style={{ padding: '40px 20px' }}>
                        <div className="sa-empty-title">No users found</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="sa-table-cell-main">{u.name || u.email}</div>
                        <div className="sa-table-cell-sub">{u.email}</div>
                      </td>
                      <td>
                        <span className={`sa-status ${u.role === 'admin' ? 'sa-status-active' : 'sa-status-trial'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>{formatDate(u.created_at)}</td>
                      <td>
                        <div className="sa-actions">
                          <button
                            className="sa-action-btn primary"
                            onClick={() => handleStartImpersonation(u)}
                          >
                            <EyeIcon /> Impersonate
                          </button>
                          <button
                            className="sa-action-btn danger"
                            onClick={() => handleDisableUser(u.id)}
                          >
                            <TrashIcon /> Disable
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

      {tab === 'notes' && (
        <div className="sa-card">
          <div className="sa-card-header">
            <h3 className="sa-card-title">Support Notes ({notes.length})</h3>
            <button className="sa-btn sa-btn-primary sa-btn-sm" onClick={handleAddNote}>
              <PlusIcon /> Add Note
            </button>
          </div>
          <div className="sa-table-container">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Note</th>
                  <th>Author</th>
                  <th>Tags</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {notes.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="sa-empty" style={{ padding: '40px 20px' }}>
                        <div className="sa-empty-title">No notes yet</div>
                        <div className="sa-empty-text">Add a note to track support interactions</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  notes.map((n) => (
                    <tr key={n.id}>
                      <td style={{ maxWidth: '300px' }}>{n.note}</td>
                      <td>{n.admin_email}</td>
                      <td>{n.tags || '-'}</td>
                      <td>{formatDateTime(n.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="sa-card">
          <div className="sa-card-header">
            <h3 className="sa-card-title">Audit Logs</h3>
            <button className="sa-btn sa-btn-secondary sa-btn-sm" onClick={loadAuditLogs}>
              <RefreshIcon /> Refresh
            </button>
          </div>
          <div className="sa-table-container">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="sa-empty" style={{ padding: '40px 20px' }}>
                        <div className="sa-empty-title">No audit logs</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDateTime(log.created_at)}</td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{log.action_type}</span>
                      </td>
                      <td>{log.actor_admin_id || log.actor_email || '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{log.ip || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
