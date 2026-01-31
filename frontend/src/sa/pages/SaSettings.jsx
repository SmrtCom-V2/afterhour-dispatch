import { useEffect, useState } from 'react';
import { saApi } from '../api';

// Icons
const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const PackageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function SaSettings() {
  const [plans, setPlans] = useState([]);
  const [allowlist, setAllowlist] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [addingEmail, setAddingEmail] = useState(false);
  const [activeTab, setActiveTab] = useState('admins');

  // Plan form
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({ name: '', seats: '', price: '' });

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await saApi.getSettings();
      setPlans(res.plans || []);
      setAllowlist(res.allowlist || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAddEmail = async (e) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    setAddingEmail(true);
    setError('');
    try {
      await saApi.addAllowlistEntry(newEmail);
      setNewEmail('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingEmail(false);
    }
  };

  const handleDeleteEmail = async (id, email) => {
    if (!window.confirm(`Remove ${email} from Super Admin access?`)) return;
    try {
      await saApi.deleteAllowlistEntry(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddPlan = async (e) => {
    e.preventDefault();
    if (!planForm.name) {
      setError('Plan name is required');
      return;
    }
    try {
      await saApi.createPlan({
        name: planForm.name,
        limits: { seats: parseInt(planForm.seats) || 5 },
        features: { price: parseInt(planForm.price) || 0 }
      });
      setPlanForm({ name: '', seats: '', price: '' });
      setShowPlanForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="sa-loading">
        <div className="sa-loading-spinner"></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="sa-page">
      {/* Page Header */}
      <div className="sa-page-header">
        <div className="sa-page-header-content">
          <p className="sa-eyebrow">Super Admin</p>
          <h1 className="sa-page-title">Settings</h1>
          <p className="sa-page-subtitle">Manage Super Admin access and subscription plans</p>
        </div>
        <div className="sa-header-actions">
          <button className="sa-btn sa-btn-secondary" onClick={load}>
            <RefreshIcon />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="sa-error">{error}</div>}

      {/* Tabs */}
      <div className="sa-tabs">
        <button
          className={`sa-tab ${activeTab === 'admins' ? 'active' : ''}`}
          onClick={() => setActiveTab('admins')}
        >
          <ShieldIcon style={{ marginRight: '8px' }} />
          Super Admin Users
        </button>
        <button
          className={`sa-tab ${activeTab === 'plans' ? 'active' : ''}`}
          onClick={() => setActiveTab('plans')}
        >
          <PackageIcon style={{ marginRight: '8px' }} />
          Subscription Plans
        </button>
      </div>

      {/* Super Admin Users Tab */}
      {activeTab === 'admins' && (
        <div className="sa-card">
          <div className="sa-card-header">
            <div>
              <h3 className="sa-card-title">Super Admin Allowlist</h3>
              <p className="sa-card-subtitle">
                Only emails on this list can access the Super Admin panel
              </p>
            </div>
            <span className="sa-status sa-status-active">
              {allowlist.length} admin{allowlist.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="sa-card-body">
            {/* Add Email Form */}
            <form onSubmit={handleAddEmail} style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, maxWidth: '400px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    Add New Super Admin
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--color-text-muted)'
                    }}>
                      <MailIcon />
                    </span>
                    <input
                      className="sa-input"
                      type="email"
                      placeholder="admin@company.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      style={{ paddingLeft: '44px' }}
                    />
                  </div>
                </div>
                <button
                  className="sa-btn sa-btn-primary"
                  type="submit"
                  disabled={addingEmail || !newEmail}
                >
                  <PlusIcon />
                  {addingEmail ? 'Adding...' : 'Add Admin'}
                </button>
              </div>
            </form>

            {/* Allowlist Table */}
            <div className="sa-table-container">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Added</th>
                    <th style={{ width: '120px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allowlist.length === 0 ? (
                    <tr>
                      <td colSpan={3}>
                        <div className="sa-empty" style={{ padding: '40px 20px' }}>
                          <div className="sa-empty-icon"><ShieldIcon /></div>
                          <div className="sa-empty-title">No Super Admins</div>
                          <div className="sa-empty-text">Add an email above to grant Super Admin access</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    allowlist.map((admin) => (
                      <tr key={admin.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: 'var(--radius-full)',
                              background: 'linear-gradient(135deg, #DC2626, #991B1B)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '13px'
                            }}>
                              {admin.email.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 500 }}>{admin.email}</div>
                              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                Super Admin
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{formatDate(admin.created_at)}</td>
                        <td>
                          <button
                            className="sa-action-btn danger"
                            onClick={() => handleDeleteEmail(admin.id, admin.email)}
                          >
                            <TrashIcon />
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="sa-card-footer">
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
              Super Admins have full access to all companies, billing, and system settings.
              Only add trusted platform operators.
            </p>
          </div>
        </div>
      )}

      {/* Subscription Plans Tab */}
      {activeTab === 'plans' && (
        <div className="sa-card">
          <div className="sa-card-header">
            <div>
              <h3 className="sa-card-title">Subscription Plans</h3>
              <p className="sa-card-subtitle">
                Define pricing tiers for companies
              </p>
            </div>
            <button
              className="sa-btn sa-btn-primary"
              onClick={() => setShowPlanForm(!showPlanForm)}
            >
              <PlusIcon />
              Add Plan
            </button>
          </div>
          <div className="sa-card-body">
            {/* Add Plan Form */}
            {showPlanForm && (
              <form onSubmit={handleAddPlan} style={{
                marginBottom: '24px',
                padding: '20px',
                background: 'var(--color-bg-hover)',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                      Plan Name *
                    </label>
                    <input
                      className="sa-input"
                      placeholder="e.g. Professional"
                      value={planForm.name}
                      onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                      Seat Limit
                    </label>
                    <input
                      className="sa-input"
                      type="number"
                      placeholder="5"
                      value={planForm.seats}
                      onChange={(e) => setPlanForm({ ...planForm, seats: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                      Monthly Price ($)
                    </label>
                    <input
                      className="sa-input"
                      type="number"
                      placeholder="99"
                      value={planForm.price}
                      onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="sa-btn sa-btn-primary" type="submit">
                    Create Plan
                  </button>
                  <button
                    className="sa-btn sa-btn-secondary"
                    type="button"
                    onClick={() => setShowPlanForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Plans Table */}
            <div className="sa-table-container">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Plan Name</th>
                    <th>Seat Limit</th>
                    <th>Price</th>
                    <th>Created</th>
                    <th style={{ width: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="sa-empty" style={{ padding: '40px 20px' }}>
                          <div className="sa-empty-icon"><PackageIcon /></div>
                          <div className="sa-empty-title">No Plans Defined</div>
                          <div className="sa-empty-text">Create subscription plans for companies</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    plans.map((plan) => (
                      <tr key={plan.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{plan.name}</div>
                        </td>
                        <td>{plan.limits?.seats || '∞'} seats</td>
                        <td>
                          {plan.features?.price ? `$${plan.features.price}/mo` : 'Free'}
                        </td>
                        <td>{formatDate(plan.created_at)}</td>
                        <td>
                          <button className="sa-action-btn">
                            <EditIcon />
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
