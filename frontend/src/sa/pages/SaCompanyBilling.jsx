/**
 * Super Admin Company Billing & Entitlements Page
 *
 * Part of A-Z Delivery Spec: Super Admin Entitlements + Customer Plan & Add-Ons
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { saApi } from '../api';

// Source badge colors
const SOURCE_BADGES = {
  BASE: { label: 'Base Feature', className: 'badge-base' },
  PLAN: { label: 'Included by Plan', className: 'badge-plan' },
  ADDON: { label: 'Purchased Add-on', className: 'badge-addon' },
  OVERRIDE: { label: 'Manual Override', className: 'badge-override' }
};

export default function SaCompanyBilling() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Modal states
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [pendingChange, setPendingChange] = useState(null);

  // Audit log
  const [auditLog, setAuditLog] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await saApi.getCompanyBillingEntitlements(companyId);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const fetchAuditLog = useCallback(async () => {
    setAuditLoading(true);
    try {
      const result = await saApi.getCompanyEntitlementAudit(companyId, { limit: 20 });
      setAuditLog(result.events || []);
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    } finally {
      setAuditLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
    fetchAuditLog();
  }, [fetchData, fetchAuditLog]);

  // Handle plan change
  const handlePlanSelect = (packageId) => {
    if (packageId === data.current_package?.id) return;

    const newPkg = data.packages.find(p => p.id === packageId);
    setPendingChange({
      type: 'plan',
      from: data.current_package,
      to: newPkg
    });
    setShowPlanModal(true);
  };

  const confirmPlanChange = async () => {
    if (!pendingChange || pendingChange.type !== 'plan') return;

    setSaving(true);
    try {
      await saApi.changeCompanyPackage(companyId, pendingChange.to.id);
      setShowPlanModal(false);
      setPendingChange(null);
      await fetchData();
      await fetchAuditLog();
    } catch (err) {
      alert('Failed to change plan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Handle addon toggle
  const handleAddonToggle = (feature, enable) => {
    // Check if from plan - can't toggle
    if (data.entitlements[feature.id]?.source === 'PLAN' && !enable) {
      alert('Cannot disable a feature included by plan. Change the plan instead.');
      return;
    }

    // Check dependencies
    if (enable && !feature.dependencies_met) {
      setPendingChange({
        type: 'addon_with_deps',
        feature,
        enable,
        missingDeps: feature.missing_dependencies
      });
      setShowAddonModal(true);
      return;
    }

    setPendingChange({
      type: 'addon',
      feature,
      enable
    });
    setShowAddonModal(true);
  };

  const confirmAddonToggle = async () => {
    if (!pendingChange) return;

    setSaving(true);
    try {
      if (pendingChange.type === 'addon_with_deps' && pendingChange.enable) {
        // Enable dependencies first, then the feature
        const featuresToEnable = [...pendingChange.missingDeps, pendingChange.feature.id];
        await saApi.bulkToggleCompanyAddons(companyId, featuresToEnable, true);
      } else {
        await saApi.toggleCompanyAddon(companyId, pendingChange.feature.id, pendingChange.enable);
      }

      setShowAddonModal(false);
      setPendingChange(null);
      await fetchData();
      await fetchAuditLog();
    } catch (err) {
      alert('Failed to toggle addon: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="sa-page">
        <div className="sa-loading">Loading billing data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sa-page">
        <div className="sa-error">
          <h3>Error loading billing data</h3>
          <p>{error}</p>
          <button onClick={fetchData} className="btn btn-primary">Retry</button>
        </div>
      </div>
    );
  }

  const baseFeatures = data.features.filter(f => f.is_base);
  const addonFeatures = data.features.filter(f => f.is_addon);

  return (
    <div className="sa-page sa-company-billing">
      {/* Header */}
      <div className="sa-page-header">
        <div className="sa-breadcrumb">
          <Link to="/sa/companies">Companies</Link>
          <span>/</span>
          <Link to={`/sa/companies/${companyId}`}>{data.company?.name}</Link>
          <span>/</span>
          <span>Billing & Entitlements</span>
        </div>
        <h1>Billing & Entitlements</h1>
        <p className="sa-subtitle">
          {data.company?.name} • {data.company?.status} •
          Last updated: {new Date(data.company?.updated_at).toLocaleString()}
        </p>
      </div>

      {/* Current Plan Section */}
      <section className="sa-section">
        <h2>Current Plan</h2>
        <div className="sa-plan-selector">
          <div className="sa-current-plan-card">
            <div className="plan-badge">{data.current_package?.name || 'No Plan'}</div>
            <p>{data.current_package?.description}</p>
            {data.current_package?.monthly_price_cents && (
              <div className="plan-price">
                €{(data.current_package.monthly_price_cents / 100).toFixed(2)}/month
              </div>
            )}
          </div>

          <div className="sa-plan-options">
            <label>Change Plan:</label>
            <select
              value={data.current_package?.id || ''}
              onChange={(e) => handlePlanSelect(e.target.value)}
              disabled={saving}
            >
              {data.packages.map(pkg => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} - {pkg.description}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Base Features Section */}
      <section className="sa-section">
        <h2>Base Features (Always Included)</h2>
        <div className="sa-features-list base-features">
          {baseFeatures.map(feature => (
            <div key={feature.id} className="sa-feature-item enabled">
              <span className="feature-check">✓</span>
              <div className="feature-info">
                <strong>{feature.name}</strong>
                <p>{feature.description}</p>
              </div>
              <span className="badge badge-base">Base</span>
            </div>
          ))}
        </div>
      </section>

      {/* Add-ons Section */}
      <section className="sa-section">
        <h2>Add-ons</h2>
        <table className="sa-table addons-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Status</th>
              <th>Source</th>
              <th>Dependencies</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {addonFeatures.map(feature => {
              const entitlement = data.entitlements[feature.id];
              const isEnabled = feature.enabled;
              const source = entitlement?.source;
              const isFromPlan = source === 'PLAN';

              return (
                <tr key={feature.id} className={!feature.dependencies_met && !isEnabled ? 'deps-warning' : ''}>
                  <td>
                    <strong>{feature.name}</strong>
                    <p className="feature-desc">{feature.description}</p>
                  </td>
                  <td>
                    <span className={`status-badge ${isEnabled ? 'status-on' : 'status-off'}`}>
                      {isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    {source && SOURCE_BADGES[source] && (
                      <span className={`badge ${SOURCE_BADGES[source].className}`}>
                        {SOURCE_BADGES[source].label}
                      </span>
                    )}
                  </td>
                  <td>
                    {feature.depends_on?.length > 0 && (
                      <div className="deps-info">
                        <span className="deps-label">Requires:</span>
                        <span className={feature.dependencies_met ? 'deps-met' : 'deps-not-met'}>
                          {feature.depends_on.join(', ')}
                        </span>
                        {!feature.dependencies_met && (
                          <span className="deps-warning-icon" title="Dependencies not met">⚠️</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {isFromPlan ? (
                      <span className="action-disabled" title="Included by plan - change plan to modify">
                        Included
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddonToggle(feature, !isEnabled)}
                        disabled={saving}
                        className={`btn btn-sm ${isEnabled ? 'btn-danger' : 'btn-success'}`}
                      >
                        {isEnabled ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Audit Log Section */}
      <section className="sa-section">
        <h2>Entitlement Audit Log</h2>
        {auditLoading ? (
          <div className="sa-loading-sm">Loading audit log...</div>
        ) : auditLog.length === 0 ? (
          <p className="sa-empty">No entitlement changes recorded yet.</p>
        ) : (
          <table className="sa-table audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map(event => (
                <tr key={event.id}>
                  <td>{new Date(event.created_at).toLocaleString()}</td>
                  <td>
                    <span className={`event-type event-${event.event_type}`}>
                      {formatEventType(event.event_type)}
                    </span>
                  </td>
                  <td>{event.actor_type} {event.actor_id ? `(${event.actor_id.substring(0, 8)}...)` : ''}</td>
                  <td>
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={() => alert(JSON.stringify(event.payload_json, null, 2))}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Plan Change Confirmation Modal */}
      {showPlanModal && pendingChange && (
        <div className="modal-overlay" onClick={() => !saving && setShowPlanModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Confirm Plan Change</h3>
            <div className="modal-body">
              <div className="change-summary">
                <div className="change-from">
                  <label>Current Plan:</label>
                  <strong>{pendingChange.from?.name || 'None'}</strong>
                </div>
                <div className="change-arrow">→</div>
                <div className="change-to">
                  <label>New Plan:</label>
                  <strong>{pendingChange.to?.name}</strong>
                </div>
              </div>
              <p className="change-note">
                This will change the included features for this company.
                Any manually enabled add-ons will remain active.
              </p>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowPlanModal(false)}
                disabled={saving}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmPlanChange}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? 'Saving...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Addon Toggle Confirmation Modal */}
      {showAddonModal && pendingChange && (
        <div className="modal-overlay" onClick={() => !saving && setShowAddonModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>
              {pendingChange.type === 'addon_with_deps'
                ? 'Dependencies Required'
                : `${pendingChange.enable ? 'Enable' : 'Disable'} Add-on`}
            </h3>
            <div className="modal-body">
              {pendingChange.type === 'addon_with_deps' ? (
                <>
                  <p>
                    <strong>{pendingChange.feature.name}</strong> requires the following features to be enabled first:
                  </p>
                  <ul className="deps-list">
                    {pendingChange.missingDeps.map(depId => (
                      <li key={depId}>{depId}</li>
                    ))}
                  </ul>
                  <p>Click "Enable All" to enable all prerequisites along with this feature.</p>
                </>
              ) : (
                <p>
                  Are you sure you want to {pendingChange.enable ? 'enable' : 'disable'}{' '}
                  <strong>{pendingChange.feature.name}</strong>?
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowAddonModal(false)}
                disabled={saving}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddonToggle}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving
                  ? 'Saving...'
                  : pendingChange.type === 'addon_with_deps'
                    ? 'Enable All'
                    : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        .sa-company-billing .sa-breadcrumb {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin-bottom: 0.5rem;
        }
        .sa-company-billing .sa-breadcrumb a {
          color: var(--color-primary);
        }
        .sa-company-billing .sa-breadcrumb span {
          margin: 0 0.5rem;
        }

        .sa-plan-selector {
          display: flex;
          gap: 2rem;
          align-items: flex-start;
        }
        .sa-current-plan-card {
          background: var(--color-bg-secondary);
          border: 2px solid var(--color-primary);
          border-radius: 8px;
          padding: 1.5rem;
          min-width: 250px;
        }
        .sa-current-plan-card .plan-badge {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-primary);
          margin-bottom: 0.5rem;
        }
        .sa-current-plan-card .plan-price {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 1rem;
        }
        .sa-plan-options {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .sa-plan-options select {
          min-width: 300px;
          padding: 0.5rem;
        }

        .sa-features-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .sa-feature-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          background: var(--color-bg-secondary);
          border-radius: 6px;
        }
        .sa-feature-item.enabled .feature-check {
          color: var(--color-success);
        }
        .sa-feature-item .feature-info {
          flex: 1;
        }
        .sa-feature-item .feature-info p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .addons-table .feature-desc {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin: 0.25rem 0 0 0;
        }
        .addons-table tr.deps-warning {
          background: rgba(255, 193, 7, 0.1);
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .status-on {
          background: rgba(34, 197, 94, 0.1);
          color: var(--color-success);
        }
        .status-off {
          background: rgba(156, 163, 175, 0.1);
          color: var(--color-text-secondary);
        }

        .badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
        }
        .badge-base { background: #e0e7ff; color: #4338ca; }
        .badge-plan { background: #dbeafe; color: #1d4ed8; }
        .badge-addon { background: #d1fae5; color: #059669; }
        .badge-override { background: #fef3c7; color: #d97706; }

        .deps-info {
          font-size: 0.75rem;
        }
        .deps-label {
          color: var(--color-text-secondary);
          margin-right: 0.25rem;
        }
        .deps-met { color: var(--color-success); }
        .deps-not-met { color: var(--color-warning); }
        .deps-warning-icon { margin-left: 0.25rem; }

        .action-disabled {
          color: var(--color-text-secondary);
          font-size: 0.875rem;
        }

        .event-type {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
        }
        .event-plan_changed { background: #dbeafe; color: #1d4ed8; }
        .event-addon_enabled { background: #d1fae5; color: #059669; }
        .event-addon_disabled { background: #fee2e2; color: #dc2626; }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal {
          background: var(--color-bg);
          border-radius: 8px;
          padding: 1.5rem;
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal h3 {
          margin: 0 0 1rem 0;
        }
        .modal-body {
          margin-bottom: 1.5rem;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }

        .change-summary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          margin-bottom: 1rem;
        }
        .change-from, .change-to {
          text-align: center;
        }
        .change-from label, .change-to label {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin-bottom: 0.25rem;
        }
        .change-arrow {
          font-size: 1.5rem;
          color: var(--color-text-secondary);
        }
        .change-note {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .deps-list {
          background: var(--color-bg-secondary);
          padding: 1rem;
          border-radius: 6px;
          margin: 1rem 0;
        }
        .deps-list li {
          font-family: monospace;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

function formatEventType(type) {
  const labels = {
    plan_changed: 'Plan Changed',
    addon_enabled: 'Add-on Enabled',
    addon_disabled: 'Add-on Disabled',
    addon_purchased: 'Add-on Purchased',
    addon_expired: 'Add-on Expired',
    bulk_sync: 'Bulk Sync',
    dependency_auto_enabled: 'Dependency Auto-Enabled'
  };
  return labels[type] || type;
}
