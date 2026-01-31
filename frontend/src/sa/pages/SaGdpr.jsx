import { useEffect, useState, useCallback } from 'react';
import { saApi } from '../api';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB');
}

function getStatusColor(status) {
  switch (status) {
    case 'completed': return '#22c55e';
    case 'processing': return '#3b82f6';
    case 'pending': return '#eab308';
    case 'rejected': return '#ef4444';
    default: return '#6b7280';
  }
}

export function SaGdpr() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [exportRequests, setExportRequests] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [retentionSettings, setRetentionSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [statsRes, exportRes, deletionRes, retentionRes] = await Promise.all([
        saApi.getGdprStats().catch(() => null),
        saApi.getGdprExportRequests().catch(() => ({ requests: [] })),
        saApi.getGdprDeletionRequests().catch(() => ({ requests: [] })),
        saApi.getDataRetentionSettings().catch(() => ({ settings: [] })),
      ]);
      setStats(statsRes);
      setExportRequests(exportRes.requests || []);
      setDeletionRequests(deletionRes.requests || []);
      setRetentionSettings(retentionRes.settings || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleProcessExport = async (id) => {
    setProcessing(id);
    try {
      await saApi.processExportRequest(id);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleProcessDeletion = async (id) => {
    if (!window.confirm('Are you sure you want to process this deletion request? This action cannot be undone.')) {
      return;
    }
    setProcessing(id);
    try {
      await saApi.processDeletionRequest(id, true);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectDeletion = async (id) => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;

    setProcessing(id);
    try {
      await saApi.rejectDeletionRequest(id, reason);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleUpdateRetention = async (dataType, retentionDays, autoDelete) => {
    try {
      await saApi.updateDataRetention(dataType, { retention_days: retentionDays, auto_delete: autoDelete });
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="sa-page">
        <div className="sa-loading">
          <div className="sa-loading-spinner" />
          <p>Loading GDPR tools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <p className="sa-eyebrow">Super Admin</p>
          <h1>GDPR & Privacy</h1>
          <p className="sa-muted">Manage data privacy requests, retention policies, and compliance.</p>
        </div>
      </div>

      {error && <div className="sa-error">{error}</div>}

      {/* Tabs */}
      <div className="sa-tabs">
        <button
          className={`sa-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`sa-tab ${activeTab === 'exports' ? 'active' : ''}`}
          onClick={() => setActiveTab('exports')}
        >
          Export Requests
          {stats?.export_requests?.pending > 0 && (
            <span className="sa-tab-badge">{stats.export_requests.pending}</span>
          )}
        </button>
        <button
          className={`sa-tab ${activeTab === 'deletions' ? 'active' : ''}`}
          onClick={() => setActiveTab('deletions')}
        >
          Deletion Requests
          {stats?.deletion_requests?.pending > 0 && (
            <span className="sa-tab-badge">{stats.deletion_requests.pending}</span>
          )}
        </button>
        <button
          className={`sa-tab ${activeTab === 'retention' ? 'active' : ''}`}
          onClick={() => setActiveTab('retention')}
        >
          Data Retention
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          <div className="sa-stats-grid-4">
            <div className="sa-stat-card">
              <div className="sa-stat-label">Export Requests (30d)</div>
              <div className="sa-stat-value">{stats?.export_requests?.total || 0}</div>
              <div className="sa-muted">Pending: {stats?.export_requests?.pending || 0}</div>
            </div>
            <div className="sa-stat-card">
              <div className="sa-stat-label">Deletion Requests (30d)</div>
              <div className="sa-stat-value">{stats?.deletion_requests?.total || 0}</div>
              <div className="sa-muted">Pending: {stats?.deletion_requests?.pending || 0}</div>
            </div>
            <div className="sa-stat-card">
              <div className="sa-stat-label">Marketing Consent</div>
              <div className="sa-stat-value" style={{ color: '#22c55e' }}>
                {stats?.consent_stats?.marketing_consent || 0}
              </div>
              <div className="sa-muted">of {stats?.consent_stats?.total_users || 0} users</div>
            </div>
            <div className="sa-stat-card">
              <div className="sa-stat-label">Analytics Consent</div>
              <div className="sa-stat-value" style={{ color: '#3b82f6' }}>
                {stats?.consent_stats?.analytics_consent || 0}
              </div>
              <div className="sa-muted">of {stats?.consent_stats?.total_users || 0} users</div>
            </div>
          </div>

          <div className="sa-dashboard-grid">
            <div className="sa-panel">
              <div className="sa-panel-header">
                <h3>GDPR Compliance Checklist</h3>
              </div>
              <div className="sa-gdpr-checklist">
                <div className="sa-checklist-item">
                  <span className="sa-check-icon done">✓</span>
                  <span>Data export functionality available</span>
                </div>
                <div className="sa-checklist-item">
                  <span className="sa-check-icon done">✓</span>
                  <span>User consent management enabled</span>
                </div>
                <div className="sa-checklist-item">
                  <span className="sa-check-icon done">✓</span>
                  <span>Data deletion requests supported</span>
                </div>
                <div className="sa-checklist-item">
                  <span className="sa-check-icon done">✓</span>
                  <span>Audit logging enabled</span>
                </div>
                <div className="sa-checklist-item">
                  <span className="sa-check-icon done">✓</span>
                  <span>Data retention policies configured</span>
                </div>
                <div className="sa-checklist-item">
                  <span className="sa-check-icon done">✓</span>
                  <span>User data anonymization available</span>
                </div>
              </div>
            </div>

            <div className="sa-panel">
              <div className="sa-panel-header">
                <h3>Quick Actions</h3>
              </div>
              <div className="sa-gdpr-actions">
                <button className="sa-btn sa-btn-secondary" onClick={() => setActiveTab('exports')}>
                  View Export Requests
                </button>
                <button className="sa-btn sa-btn-secondary" onClick={() => setActiveTab('deletions')}>
                  View Deletion Requests
                </button>
                <button className="sa-btn sa-btn-secondary" onClick={() => setActiveTab('retention')}>
                  Configure Retention
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Export Requests Tab */}
      {activeTab === 'exports' && (
        <div className="sa-panel">
          <div className="sa-panel-header">
            <h3>Data Export Requests</h3>
          </div>
          {exportRequests.length === 0 ? (
            <p className="sa-muted" style={{ padding: 20, textAlign: 'center' }}>
              No export requests found in the last 30 days.
            </p>
          ) : (
            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Completed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exportRequests.map((req) => (
                    <tr key={req.id}>
                      <td>
                        <div>
                          <strong>{req.user_name || 'Unknown'}</strong>
                          <div className="sa-muted" style={{ fontSize: 12 }}>{req.user_email}</div>
                        </div>
                      </td>
                      <td>{req.company_name || '-'}</td>
                      <td>
                        <span
                          className="sa-priority-badge"
                          style={{
                            backgroundColor: getStatusColor(req.status) + '20',
                            color: getStatusColor(req.status),
                          }}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td>{formatDate(req.created_at)}</td>
                      <td>{req.completed_at ? formatDate(req.completed_at) : '-'}</td>
                      <td>
                        {req.status === 'pending' && (
                          <button
                            className="sa-btn sa-btn-sm"
                            onClick={() => handleProcessExport(req.id)}
                            disabled={processing === req.id}
                          >
                            {processing === req.id ? 'Processing...' : 'Process'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Deletion Requests Tab */}
      {activeTab === 'deletions' && (
        <div className="sa-panel">
          <div className="sa-panel-header">
            <h3>Data Deletion Requests</h3>
          </div>
          {deletionRequests.length === 0 ? (
            <p className="sa-muted" style={{ padding: 20, textAlign: 'center' }}>
              No deletion requests found in the last 30 days.
            </p>
          ) : (
            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deletionRequests.map((req) => (
                    <tr key={req.id}>
                      <td>
                        <div>
                          <strong>{req.user_name || 'Unknown'}</strong>
                          <div className="sa-muted" style={{ fontSize: 12 }}>{req.user_email}</div>
                        </div>
                      </td>
                      <td>{req.company_name || '-'}</td>
                      <td>
                        <span
                          className="sa-priority-badge"
                          style={{
                            backgroundColor: getStatusColor(req.status) + '20',
                            color: getStatusColor(req.status),
                          }}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td>{formatDate(req.created_at)}</td>
                      <td>
                        {req.status === 'pending' && (
                          <div className="sa-actions">
                            <button
                              className="sa-btn sa-btn-sm sa-btn-danger"
                              onClick={() => handleProcessDeletion(req.id)}
                              disabled={processing === req.id}
                            >
                              Delete
                            </button>
                            <button
                              className="sa-btn sa-btn-sm"
                              onClick={() => handleRejectDeletion(req.id)}
                              disabled={processing === req.id}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Data Retention Tab */}
      {activeTab === 'retention' && (
        <div className="sa-panel">
          <div className="sa-panel-header">
            <h3>Data Retention Settings</h3>
          </div>
          <div className="sa-retention-info">
            <p className="sa-muted">
              Configure how long different types of data are retained before automatic deletion.
              Changes take effect immediately.
            </p>
          </div>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Data Type</th>
                  <th>Description</th>
                  <th>Retention (days)</th>
                  <th>Auto Delete</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {retentionSettings.map((setting) => (
                  <tr key={setting.data_type}>
                    <td>
                      <strong>{setting.data_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong>
                    </td>
                    <td className="sa-muted">{setting.description || '-'}</td>
                    <td>
                      <input
                        type="number"
                        className="sa-input sa-retention-input"
                        value={setting.retention_days}
                        min={1}
                        max={3650}
                        onChange={(e) => {
                          const newSettings = retentionSettings.map(s =>
                            s.data_type === setting.data_type
                              ? { ...s, retention_days: parseInt(e.target.value, 10) || 365 }
                              : s
                          );
                          setRetentionSettings(newSettings);
                        }}
                      />
                    </td>
                    <td>
                      <label className="sa-toggle-label">
                        <input
                          type="checkbox"
                          checked={setting.auto_delete}
                          onChange={(e) => {
                            const newSettings = retentionSettings.map(s =>
                              s.data_type === setting.data_type
                                ? { ...s, auto_delete: e.target.checked }
                                : s
                            );
                            setRetentionSettings(newSettings);
                          }}
                        />
                        <span>{setting.auto_delete ? 'Enabled' : 'Disabled'}</span>
                      </label>
                    </td>
                    <td>
                      <button
                        className="sa-btn sa-btn-sm"
                        onClick={() => handleUpdateRetention(setting.data_type, setting.retention_days, setting.auto_delete)}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
