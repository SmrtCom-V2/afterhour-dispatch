import { useEffect, useState } from 'react';
import { saApi } from '../api';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB');
}

function getActivationColor(score) {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

function getDaysRemainingColor(days) {
  if (days === null) return '#6b7280';
  if (days <= 3) return '#ef4444';
  if (days <= 7) return '#eab308';
  return '#22c55e';
}

export function SaTrials() {
  const [trials, setTrials] = useState([]);
  const [stats, setStats] = useState({ total: 0, ending_soon: 0, inactive: 0, active: 0 });
  const [filter, setFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Extension modal state
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendTarget, setExtendTarget] = useState(null); // null = bulk, object = single
  const [extendDays, setExtendDays] = useState(14);
  const [extendReason, setExtendReason] = useState('');
  const [extending, setExtending] = useState(false);

  const loadTrials = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await saApi.getTrials(filter);
      setTrials(res.trials || []);
      setStats(res.stats || { total: 0, ending_soon: 0, inactive: 0, active: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrials();
  }, [filter]);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter === filter ? null : newFilter);
    setSelectedIds(new Set());
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(trials.map(t => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const openExtendModal = (trial = null) => {
    setExtendTarget(trial);
    setExtendDays(14);
    setExtendReason('');
    setShowExtendModal(true);
  };

  const closeExtendModal = () => {
    setShowExtendModal(false);
    setExtendTarget(null);
    setExtendDays(14);
    setExtendReason('');
  };

  const handleExtend = async () => {
    if (extendDays < 1 || extendDays > 90) {
      setError('Days must be between 1 and 90');
      return;
    }

    setExtending(true);
    setError('');

    try {
      if (extendTarget) {
        // Single extend
        await saApi.extendTrialDays(extendTarget.id, extendDays, extendReason);
      } else {
        // Bulk extend
        const ids = Array.from(selectedIds);
        await saApi.bulkExtendTrials(ids, extendDays, extendReason);
      }
      closeExtendModal();
      setSelectedIds(new Set());
      await loadTrials();
    } catch (err) {
      setError(err.message);
    } finally {
      setExtending(false);
    }
  };

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <p className="sa-eyebrow">Super Admin</p>
          <h1>Trials</h1>
          <p className="sa-muted">Monitor trial activation, engagement, and extend trials as needed.</p>
        </div>
        {selectedIds.size > 0 && (
          <button className="sa-btn sa-btn-primary" onClick={() => openExtendModal()}>
            Extend {selectedIds.size} Selected
          </button>
        )}
      </div>

      {error && <div className="sa-error">{error}</div>}

      {/* Stats Cards */}
      <div className="sa-stats-grid-4">
        <div
          className={`sa-stat-card ${filter === null ? 'sa-stat-card-active' : ''}`}
          onClick={() => handleFilterChange(null)}
          style={{ cursor: 'pointer' }}
        >
          <div className="sa-stat-label">Total Trials</div>
          <div className="sa-stat-value">{stats.total}</div>
        </div>
        <div
          className={`sa-stat-card ${filter === 'ending_soon' ? 'sa-stat-card-active' : ''}`}
          onClick={() => handleFilterChange('ending_soon')}
          style={{ cursor: 'pointer' }}
        >
          <div className="sa-stat-label">Ending Soon (7d)</div>
          <div className="sa-stat-value" style={{ color: '#ef4444' }}>{stats.ending_soon}</div>
        </div>
        <div
          className={`sa-stat-card ${filter === 'inactive' ? 'sa-stat-card-active' : ''}`}
          onClick={() => handleFilterChange('inactive')}
          style={{ cursor: 'pointer' }}
        >
          <div className="sa-stat-label">Inactive (72h+)</div>
          <div className="sa-stat-value" style={{ color: '#eab308' }}>{stats.inactive}</div>
        </div>
        <div
          className={`sa-stat-card ${filter === 'active' ? 'sa-stat-card-active' : ''}`}
          onClick={() => handleFilterChange('active')}
          style={{ cursor: 'pointer' }}
        >
          <div className="sa-stat-label">Active</div>
          <div className="sa-stat-value" style={{ color: '#22c55e' }}>{stats.active}</div>
        </div>
      </div>

      {/* Trials Table */}
      <div className="sa-panel">
        <div className="sa-panel-header">
          <h3>
            {filter === 'ending_soon' && 'Trials Ending Soon'}
            {filter === 'inactive' && 'Inactive Trials'}
            {filter === 'active' && 'Active Trials'}
            {filter === null && 'All Trials'}
          </h3>
        </div>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === trials.length && trials.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Company</th>
                <th>Owner Email</th>
                <th>Trial Start</th>
                <th>Trial End</th>
                <th>Days Left</th>
                <th>Last Activity</th>
                <th>Activation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="sa-loading">Loading...</td></tr>
              ) : trials.length === 0 ? (
                <tr><td colSpan={9} className="sa-loading">No trials found.</td></tr>
              ) : (
                trials.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => handleSelectOne(t.id)}
                      />
                    </td>
                    <td>
                      <strong>{t.name}</strong>
                      <div className="sa-muted" style={{ fontSize: '0.75rem' }}>
                        {t.pm_count} PMs | {t.building_count} buildings | {t.incident_count} incidents
                      </div>
                    </td>
                    <td>{t.owner_email || '-'}</td>
                    <td>{formatDate(t.trial_start_at)}</td>
                    <td>{formatDate(t.trial_end_at)}</td>
                    <td>
                      <span style={{
                        color: getDaysRemainingColor(t.days_remaining),
                        fontWeight: 600
                      }}>
                        {t.days_remaining !== null ? `${t.days_remaining}d` : '-'}
                      </span>
                    </td>
                    <td>{formatDate(t.last_activity_at)}</td>
                    <td>
                      <div className="sa-activation-bar">
                        <div
                          className="sa-activation-fill"
                          style={{
                            width: `${t.activation_score}%`,
                            backgroundColor: getActivationColor(t.activation_score)
                          }}
                        />
                        <span className="sa-activation-label">{t.activation_score}%</span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="sa-btn sa-btn-sm"
                        onClick={() => openExtendModal(t)}
                      >
                        Extend
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extension Modal */}
      {showExtendModal && (
        <div className="sa-modal-overlay" onClick={closeExtendModal}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h3>
                {extendTarget
                  ? `Extend Trial: ${extendTarget.name}`
                  : `Extend ${selectedIds.size} Trials`
                }
              </h3>
              <button className="sa-modal-close" onClick={closeExtendModal}>&times;</button>
            </div>
            <div className="sa-modal-body">
              {extendTarget && (
                <div className="sa-modal-info">
                  <p>Current trial ends: <strong>{formatDate(extendTarget.trial_end_at)}</strong></p>
                  <p>Days remaining: <strong style={{ color: getDaysRemainingColor(extendTarget.days_remaining) }}>
                    {extendTarget.days_remaining !== null ? `${extendTarget.days_remaining} days` : 'Not set'}
                  </strong></p>
                </div>
              )}

              <div className="sa-form-group">
                <label>Extension Days (1-90)</label>
                <div className="sa-extend-days-input">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={extendDays}
                    onChange={(e) => setExtendDays(parseInt(e.target.value) || 1)}
                    className="sa-input"
                  />
                  <div className="sa-quick-days">
                    {[7, 14, 30].map(d => (
                      <button
                        key={d}
                        type="button"
                        className={`sa-btn sa-btn-sm ${extendDays === d ? 'sa-btn-primary' : ''}`}
                        onClick={() => setExtendDays(d)}
                      >
                        {d} days
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sa-form-group">
                <label>Reason (optional)</label>
                <textarea
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  className="sa-textarea"
                  placeholder="e.g., Requested more time to evaluate, high engagement..."
                  rows={3}
                />
              </div>
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn" onClick={closeExtendModal}>Cancel</button>
              <button
                className="sa-btn sa-btn-primary"
                onClick={handleExtend}
                disabled={extending}
              >
                {extending ? 'Extending...' : `Extend by ${extendDays} days`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
