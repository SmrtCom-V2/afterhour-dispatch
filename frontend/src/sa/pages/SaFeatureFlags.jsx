import { useEffect, useState, useCallback } from 'react';
import { saApi } from '../api';

const CATEGORY_LABELS = {
  core: 'Core Features',
  calls: 'Call Management',
  reports: 'Reports',
  integrations: 'Integrations',
  analytics: 'Analytics',
  customization: 'Customization',
  notifications: 'Notifications',
  access: 'Access Control',
};

const CATEGORY_COLORS = {
  core: '#3b82f6',
  calls: '#8b5cf6',
  reports: '#f59e0b',
  integrations: '#10b981',
  analytics: '#ec4899',
  customization: '#6366f1',
  notifications: '#f97316',
  access: '#14b8a6',
};

export function SaFeatureFlags() {
  const [flags, setFlags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [companyOverrides, setCompanyOverrides] = useState([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);

  const loadFlags = useCallback(async () => {
    setError('');
    try {
      const data = await saApi.getFeatureFlags();
      setFlags(data.flags || []);
      setCategories(data.categories || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const handleToggleFlag = async (flag) => {
    setUpdating(flag.key);
    try {
      await saApi.updateFeatureFlag(flag.key, !flag.enabled);
      await loadFlags();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleViewOverrides = async (flag) => {
    setSelectedFlag(flag);
    setLoadingOverrides(true);
    try {
      const data = await saApi.getFeatureFlagCompanies(flag.key);
      setCompanyOverrides(data.companies || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingOverrides(false);
    }
  };

  const handleCloseOverrides = () => {
    setSelectedFlag(null);
    setCompanyOverrides([]);
  };

  const handleRemoveOverride = async (companyId) => {
    if (!selectedFlag) return;
    try {
      await saApi.removeCompanyFeatureFlag(selectedFlag.key, companyId);
      const data = await saApi.getFeatureFlagCompanies(selectedFlag.key);
      setCompanyOverrides(data.companies || []);
      await loadFlags();
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredFlags = selectedCategory
    ? flags.filter(f => f.category === selectedCategory)
    : flags;

  const totalEnabled = flags.filter(f => f.enabled).length;

  if (loading) {
    return (
      <div className="sa-page">
        <div className="sa-loading">
          <div className="sa-loading-spinner" />
          <p>Loading feature flags...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <p className="sa-eyebrow">Super Admin</p>
          <h1>Feature Flags</h1>
          <p className="sa-muted">Control feature availability globally and per-company.</p>
        </div>
        <div className="sa-header-actions">
          <span className="sa-muted" style={{ marginRight: 16 }}>
            {totalEnabled} of {flags.length} enabled
          </span>
        </div>
      </div>

      {error && <div className="sa-error">{error}</div>}

      {/* Category Summary */}
      <div className="sa-stats-grid-4" style={{ marginBottom: 24 }}>
        {categories.map((cat) => (
          <div
            key={cat.name}
            className={`sa-stat-card sa-clickable ${selectedCategory === cat.name ? 'sa-selected' : ''}`}
            onClick={() => setSelectedCategory(selectedCategory === cat.name ? '' : cat.name)}
            style={{
              borderLeft: `4px solid ${CATEGORY_COLORS[cat.name] || '#6b7280'}`,
              cursor: 'pointer',
            }}
          >
            <div className="sa-stat-label">{CATEGORY_LABELS[cat.name] || cat.name}</div>
            <div className="sa-stat-value">{cat.enabled}/{cat.total}</div>
            <div className="sa-muted" style={{ fontSize: 12 }}>enabled</div>
          </div>
        ))}
      </div>

      {/* Filter Indicator */}
      {selectedCategory && (
        <div className="sa-filter-indicator" style={{ marginBottom: 16 }}>
          <span>
            Showing: <strong>{CATEGORY_LABELS[selectedCategory] || selectedCategory}</strong>
          </span>
          <button
            className="sa-btn sa-btn-sm"
            onClick={() => setSelectedCategory('')}
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Flags Table */}
      <div className="sa-panel">
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Category</th>
                <th>Status</th>
                <th>Overrides</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFlags.length === 0 ? (
                <tr>
                  <td colSpan={5} className="sa-loading">No feature flags found.</td>
                </tr>
              ) : (
                filteredFlags.map((flag) => (
                  <tr key={flag.key}>
                    <td>
                      <div>
                        <strong>{flag.name}</strong>
                        <div className="sa-muted" style={{ fontSize: 12 }}>{flag.description}</div>
                        <code className="sa-flag-key">{flag.key}</code>
                      </div>
                    </td>
                    <td>
                      <span
                        className="sa-category-badge"
                        style={{
                          backgroundColor: (CATEGORY_COLORS[flag.category] || '#6b7280') + '20',
                          color: CATEGORY_COLORS[flag.category] || '#6b7280',
                        }}
                      >
                        {CATEGORY_LABELS[flag.category] || flag.category}
                      </span>
                    </td>
                    <td>
                      <div className="sa-flag-toggle-container">
                        <button
                          className={`sa-flag-toggle ${flag.enabled ? 'enabled' : ''}`}
                          onClick={() => handleToggleFlag(flag)}
                          disabled={updating === flag.key}
                        >
                          <span className="sa-flag-toggle-slider" />
                        </button>
                        <span className={`sa-flag-status ${flag.enabled ? 'enabled' : 'disabled'}`}>
                          {flag.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </td>
                    <td>
                      {flag.override_count > 0 ? (
                        <button
                          className="sa-btn sa-btn-sm sa-btn-link"
                          onClick={() => handleViewOverrides(flag)}
                        >
                          {flag.override_count} {flag.override_count === 1 ? 'override' : 'overrides'}
                        </button>
                      ) : (
                        <span className="sa-muted">None</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="sa-btn sa-btn-sm"
                        onClick={() => handleViewOverrides(flag)}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Company Overrides Modal */}
      {selectedFlag && (
        <div className="sa-modal-overlay" onClick={handleCloseOverrides}>
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h2>Company Overrides: {selectedFlag.name}</h2>
              <button className="sa-modal-close" onClick={handleCloseOverrides}>&times;</button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-flag-global-status">
                <span>Global Status:</span>
                <span className={`sa-flag-status ${selectedFlag.enabled ? 'enabled' : 'disabled'}`}>
                  {selectedFlag.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              {loadingOverrides ? (
                <div className="sa-loading">Loading overrides...</div>
              ) : companyOverrides.length === 0 ? (
                <p className="sa-muted" style={{ padding: 16, textAlign: 'center' }}>
                  No company-specific overrides. All companies use the global setting.
                </p>
              ) : (
                <div className="sa-table-wrap">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Override</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyOverrides.map((co) => (
                        <tr key={co.company_id}>
                          <td>
                            <strong>{co.company_name}</strong>
                            <div className="sa-muted" style={{ fontSize: 12 }}>{co.company_status}</div>
                          </td>
                          <td>
                            <span className={`sa-flag-status ${co.enabled ? 'enabled' : 'disabled'}`}>
                              {co.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="sa-btn sa-btn-sm sa-btn-danger"
                              onClick={() => handleRemoveOverride(co.company_id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="sa-modal-info" style={{ marginTop: 16 }}>
                <p className="sa-muted">
                  Tip: To add company-specific overrides, go to the company detail page and manage feature flags there.
                </p>
              </div>
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn" onClick={handleCloseOverrides}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
