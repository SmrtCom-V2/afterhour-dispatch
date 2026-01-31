import { useEffect, useState, useCallback } from 'react';
import { saApi } from '../api';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB');
}

function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb > 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(2)} MB`;
}

function getStatusColor(status) {
  switch (status) {
    case 'healthy':
    case 'connected':
    case 'ok':
      return '#22c55e';
    case 'degraded':
    case 'warning':
      return '#eab308';
    case 'error':
    case 'disconnected':
      return '#ef4444';
    default:
      return '#6b7280';
  }
}

function getLatencyColor(ms) {
  if (ms === null) return '#6b7280';
  if (ms < 50) return '#22c55e';
  if (ms < 200) return '#eab308';
  return '#ef4444';
}

export function SaSystemHealth() {
  const [data, setData] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [healthRes, dbRes, activityRes] = await Promise.all([
        saApi.getSystemHealth(),
        saApi.request('/system-health/database').catch(() => null),
        saApi.request('/system-health/activity?limit=20').catch(() => ({ activity: [] })),
      ]);
      setData(healthRes);
      setDbStats(dbRes);
      setActivity(activityRes.activity || []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const handleRefresh = () => {
    setLoading(true);
    loadData();
  };

  if (loading && !data) {
    return (
      <div className="sa-page">
        <div className="sa-loading">
          <div className="sa-loading-spinner" />
          <p>Loading system health...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <p className="sa-eyebrow">Super Admin</p>
          <h1>System Health</h1>
          <p className="sa-muted">
            Real-time monitoring of system status, queues, and database health.
            {lastRefresh && (
              <span style={{ marginLeft: 8 }}>
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="sa-header-actions">
          <label className="sa-auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-refresh</span>
          </label>
          <button className="sa-btn sa-btn-secondary" onClick={handleRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="sa-error">{error}</div>}

      {/* Overall Status Banner */}
      <div
        className="sa-health-banner"
        style={{
          backgroundColor: getStatusColor(data?.status?.overall) + '15',
          borderColor: getStatusColor(data?.status?.overall),
        }}
      >
        <div className="sa-health-status">
          <div
            className="sa-health-dot"
            style={{ backgroundColor: getStatusColor(data?.status?.overall) }}
          />
          <span style={{ color: getStatusColor(data?.status?.overall), fontWeight: 600 }}>
            System {data?.status?.overall === 'healthy' ? 'Healthy' : 'Degraded'}
          </span>
        </div>
        <div className="sa-health-meta">
          <span>API: {data?.status?.api}</span>
          <span>Database: {data?.status?.database}</span>
          <span>DB Latency: <span style={{ color: getLatencyColor(data?.latency?.db_ms) }}>{data?.latency?.db_ms}ms</span></span>
          <span>API Latency: <span style={{ color: getLatencyColor(data?.latency?.api_ms) }}>{data?.latency?.api_ms}ms</span></span>
        </div>
      </div>

      {/* Queue Stats */}
      <h3 className="sa-section-title">Queue Status</h3>
      <div className="sa-stats-grid-4">
        <div className="sa-stat-card">
          <div className="sa-stat-label">Pending Calls</div>
          <div className="sa-stat-value" style={{ color: data?.queues?.calls?.pending > 10 ? '#ef4444' : 'inherit' }}>
            {data?.queues?.calls?.pending || 0}
          </div>
          <div className="sa-muted">In progress: {data?.queues?.calls?.in_progress || 0}</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-label">Calls (Last Hour)</div>
          <div className="sa-stat-value">{data?.queues?.calls?.completed_last_hour || 0}</div>
          <div className="sa-muted">Failed (24h): <span style={{ color: data?.queues?.calls?.failed_last_24h > 0 ? '#ef4444' : 'inherit' }}>{data?.queues?.calls?.failed_last_24h || 0}</span></div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-label">New Incidents</div>
          <div className="sa-stat-value" style={{ color: data?.queues?.incidents?.new > 5 ? '#eab308' : 'inherit' }}>
            {data?.queues?.incidents?.new || 0}
          </div>
          <div className="sa-muted">In progress: {data?.queues?.incidents?.in_progress || 0}</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-label">Incidents (Last Hour)</div>
          <div className="sa-stat-value">{data?.queues?.incidents?.created_last_hour || 0}</div>
          <div className="sa-muted">Resolved (24h): {data?.queues?.incidents?.resolved_last_24h || 0}</div>
        </div>
      </div>

      {/* Error and Activity Stats */}
      <h3 className="sa-section-title">Errors &amp; Activity</h3>
      <div className="sa-stats-grid">
        <div className="sa-stat-card">
          <div className="sa-stat-label">Errors (24h)</div>
          <div className="sa-stat-value" style={{ color: data?.errors?.count_24h > 0 ? '#ef4444' : '#22c55e' }}>
            {data?.errors?.count_24h || 0}
          </div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-label">Active Companies (15m)</div>
          <div className="sa-stat-value">{data?.activity?.active_companies || 0}</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-label">Last Incident</div>
          <div className="sa-stat-value" style={{ fontSize: '1rem' }}>
            {data?.timestamps?.last_incident_at
              ? formatDate(data.timestamps.last_incident_at)
              : 'None'}
          </div>
        </div>
      </div>

      {/* Database Stats */}
      <div className="sa-dashboard-grid">
        <div className="sa-panel">
          <div className="sa-panel-header">
            <h3>Database Statistics</h3>
          </div>
          {dbStats ? (
            <>
              <div className="sa-db-size">
                <span className="sa-db-size-label">Total Size:</span>
                <span className="sa-db-size-value">{formatBytes(dbStats.size_bytes)}</span>
              </div>
              <div className="sa-table-wrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Table</th>
                      <th style={{ textAlign: 'right' }}>Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbStats.tables?.map((table) => (
                      <tr key={table.name}>
                        <td><code>{table.name}</code></td>
                        <td style={{ textAlign: 'right' }}>{table.rows.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="sa-muted">Unable to load database stats.</p>
          )}
        </div>

        <div className="sa-panel">
          <div className="sa-panel-header">
            <h3>Record Counts</h3>
          </div>
          <div className="sa-record-counts">
            <div className="sa-record-item">
              <span className="sa-record-label">Companies</span>
              <span className="sa-record-value">{data?.database?.companies || 0}</span>
            </div>
            <div className="sa-record-item">
              <span className="sa-record-label">Users</span>
              <span className="sa-record-value">{data?.database?.users || 0}</span>
            </div>
            <div className="sa-record-item">
              <span className="sa-record-label">Incidents</span>
              <span className="sa-record-value">{data?.database?.incidents || 0}</span>
            </div>
            <div className="sa-record-item">
              <span className="sa-record-label">Calls</span>
              <span className="sa-record-value">{data?.database?.calls || 0}</span>
            </div>
            <div className="sa-record-item">
              <span className="sa-record-label">Buildings</span>
              <span className="sa-record-value">{data?.database?.buildings || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="sa-panel">
        <div className="sa-panel-header">
          <h3>Recent Activity</h3>
        </div>
        {activity.length > 0 ? (
          <div className="sa-activity-list">
            {activity.map((item, idx) => (
              <div key={idx} className="sa-activity-item">
                <div
                  className="sa-activity-icon"
                  style={{
                    backgroundColor:
                      item.type === 'incident' ? '#ef444420' :
                      item.type === 'login' ? '#3b82f620' :
                      '#6b728020',
                    color:
                      item.type === 'incident' ? '#ef4444' :
                      item.type === 'login' ? '#3b82f6' :
                      '#6b7280',
                  }}
                >
                  {item.type === 'incident' ? '!' : item.type === 'login' ? 'U' : 'A'}
                </div>
                <div className="sa-activity-content">
                  <div className="sa-activity-title">
                    {item.type === 'incident' && `Incident ${item.status} (${item.priority || 'normal'})`}
                    {item.type === 'login' && `User login: ${item.email}`}
                    {item.type === 'audit' && `${item.action}: ${item.target_type}`}
                  </div>
                  <div className="sa-activity-meta">
                    {item.company_name && <span>{item.company_name}</span>}
                    <span>{formatDate(item.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="sa-muted" style={{ padding: 16 }}>No recent activity.</p>
        )}
      </div>
    </div>
  );
}
