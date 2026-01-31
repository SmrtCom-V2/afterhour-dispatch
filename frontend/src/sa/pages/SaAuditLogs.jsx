import { useEffect, useState } from 'react';
import { saApi } from '../api';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB');
}

export function SaAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    company_id: '',
    actor_admin_id: '',
    action_type: '',
  });

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await saApi.getAuditLogs(filters);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleFilter = () => {
    loadLogs();
  };

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <p className="sa-eyebrow">Super Admin</p>
          <h1>Audit Logs</h1>
          <p className="sa-muted">Every privileged action is recorded with before/after snapshots.</p>
        </div>
      </div>

      <div className="sa-panel">
        <div className="sa-filter-bar">
          <label className="sa-filter">
            Company ID
            <input
              className="sa-input"
              value={filters.company_id}
              onChange={(event) => setFilters({ ...filters, company_id: event.target.value })}
            />
          </label>
          <label className="sa-filter">
            Admin ID
            <input
              className="sa-input"
              value={filters.actor_admin_id}
              onChange={(event) => setFilters({ ...filters, actor_admin_id: event.target.value })}
            />
          </label>
          <label className="sa-filter">
            Action Type
            <input
              className="sa-input"
              value={filters.action_type}
              onChange={(event) => setFilters({ ...filters, action_type: event.target.value })}
            />
          </label>
          <button className="btn btn-secondary" onClick={handleFilter}>Apply</button>
        </div>

        {error && <div className="sa-error">{error}</div>}

        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Company</th>
                <th>Actor</th>
                <th>IP</th>
                <th>User Agent</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="sa-loading">Loading...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="sa-loading">No audit events found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.created_at)}</td>
                    <td>{log.action_type}</td>
                    <td>{log.company_id || '-'}</td>
                    <td>{log.actor_email || log.actor_admin_id}</td>
                    <td>{log.ip || '-'}</td>
                    <td>{log.user_agent || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="sa-muted">Total events: {total}</div>
      </div>
    </div>
  );
}
