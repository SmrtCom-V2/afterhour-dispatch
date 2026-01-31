import { useEffect, useState } from 'react';
import { saApi } from '../api';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB');
}

function formatDateTime(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString('en-GB');
}

function getStatusColor(status) {
  switch (status) {
    case 'active': return '#22c55e';
    case 'inactive': return '#eab308';
    case 'disabled': return '#ef4444';
    default: return '#6b7280';
  }
}

export function SaUsers() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('last_login');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (query) params.query = query;
      if (statusFilter) params.status = statusFilter;
      if (sortBy) params.sort = sortBy;

      const [usersRes, statsRes] = await Promise.all([
        saApi.getUsers(params),
        saApi.request('/users/stats').catch(() => ({ stats: null })),
      ]);

      setUsers(usersRes.users || []);
      setStats(statsRes.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [query, statusFilter, sortBy]);

  const handleDisable = async (user) => {
    if (!window.confirm(`Disable user ${user.email}?`)) return;
    try {
      await saApi.disableUser(user.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEnable = async (user) => {
    try {
      await saApi.request(`/users/${user.id}/enable`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <p className="sa-eyebrow">Super Admin</p>
          <h1>Users</h1>
          <p className="sa-muted">Manage platform users and track activity.</p>
        </div>
      </div>

      {error && <div className="sa-error">{error}</div>}

      {/* Stats */}
      {stats && (
        <div className="sa-stats-grid-4">
          <div className="sa-stat-card">
            <div className="sa-stat-label">Total Users</div>
            <div className="sa-stat-value">{parseInt(stats.total_users || 0, 10)}</div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-label">Active (24h)</div>
            <div className="sa-stat-value" style={{ color: '#22c55e' }}>{parseInt(stats.active_24h || 0, 10)}</div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-label">Active (30d)</div>
            <div className="sa-stat-value">{parseInt(stats.active_30d || 0, 10)}</div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-label">New (7d)</div>
            <div className="sa-stat-value" style={{ color: '#3b82f6' }}>{parseInt(stats.new_users_7d || 0, 10)}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="sa-export-options" style={{ marginBottom: 20 }}>
        <div className="sa-export-option">
          <label>Search</label>
          <input
            type="text"
            className="sa-input"
            placeholder="Search by name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 250 }}
          />
        </div>
        <div className="sa-export-option">
          <label>Status</label>
          <select
            className="sa-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 150 }}
          >
            <option value="">All Users</option>
            <option value="active">Active (30d)</option>
            <option value="inactive">Inactive</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div className="sa-export-option">
          <label>Sort By</label>
          <select
            className="sa-input"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ width: 150 }}
          >
            <option value="last_login">Last Login</option>
            <option value="created">Created Date</option>
            <option value="name">Name</option>
            <option value="company">Company</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="sa-panel">
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Company</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="sa-loading">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="sa-loading">No users found.</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div>
                        <strong>{u.name || 'Unnamed'}</strong>
                        <div className="sa-muted" style={{ fontSize: '12px' }}>{u.email}</div>
                      </div>
                    </td>
                    <td>
                      <div>
                        {u.company_name || '-'}
                        {u.company_status && (
                          <div className="sa-muted" style={{ fontSize: '11px' }}>{u.company_status}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`sa-note-type-badge ${u.is_admin ? 'admin' : ''}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className="sa-priority-badge"
                        style={{
                          backgroundColor: getStatusColor(u.status) + '20',
                          color: getStatusColor(u.status)
                        }}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px' }}>
                        {formatDateTime(u.last_login_at)}
                      </div>
                    </td>
                    <td>{formatDate(u.created_at)}</td>
                    <td>
                      <div className="sa-actions">
                        {u.disabled ? (
                          <button
                            className="sa-btn sa-btn-sm"
                            onClick={() => handleEnable(u)}
                          >
                            Enable
                          </button>
                        ) : (
                          <button
                            className="sa-btn sa-btn-sm"
                            onClick={() => handleDisable(u)}
                          >
                            Disable
                          </button>
                        )}
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
