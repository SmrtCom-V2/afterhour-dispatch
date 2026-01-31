/**
 * Settings - Plan & Add-ons Page
 * Customer-facing page to view current plan, features, and available add-ons
 *
 * Part of A-Z Delivery Spec: Super Admin Entitlements + Customer Plan & Add-Ons
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useEntitlements } from '../context/EntitlementsContext';
import { Layout } from '../components/Layout';

export default function SettingsPlanAddons() {
  const { refresh: refreshEntitlements } = useEntitlements();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requesting, setRequesting] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getSettingsBilling();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRequestAddon = async (featureId) => {
    setRequesting(featureId);
    try {
      await api.requestAddon(featureId);
      alert('Your request has been submitted. Our team will contact you shortly.');
      await fetchData();
      await refreshEntitlements();
    } catch (err) {
      alert('Failed to submit request: ' + err.message);
    } finally {
      setRequesting(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="settings-plan-addons">
          <div className="loading">Loading plan information...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="settings-plan-addons">
          <div className="error-box">
            <h3>Error loading plan information</h3>
            <p>{error}</p>
            <button onClick={fetchData} className="btn btn-primary">Retry</button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="settings-plan-addons">
        <div className="page-header">
          <div className="breadcrumb">
            <Link to="/settings">Settings</Link>
            <span>/</span>
            <span>Plan & Add-ons</span>
          </div>
          <h1>Plan & Add-ons</h1>
          <p className="subtitle">
            Manage your subscription and unlock additional features
          </p>
        </div>

        {/* Current Plan Section */}
        <section className="section current-plan-section">
          <h2>Your Current Plan</h2>
          {data.current_plan ? (
            <div className="current-plan-card">
              <div className="plan-header">
                <span className="plan-name">{data.current_plan.name}</span>
                <span className="plan-badge">Active</span>
              </div>
              <p className="plan-description">{data.current_plan.description}</p>
              <Link to="/settings" className="btn btn-secondary">
                Manage Subscription
              </Link>
            </div>
          ) : (
            <div className="no-plan-card">
              <p>No active plan. Contact us to get started.</p>
              <a href="mailto:sales@example.com" className="btn btn-primary">
                Contact Sales
              </a>
            </div>
          )}
        </section>

        {/* Included Features Section */}
        <section className="section included-features-section">
          <h2>Features Included in Your Plan</h2>
          {data.included_features.length > 0 ? (
            <div className="features-grid">
              {data.included_features.map(feature => (
                <div key={feature.id} className="feature-card included">
                  <div className="feature-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20,6 9,17 4,12" />
                    </svg>
                  </div>
                  <div className="feature-content">
                    <h4>{feature.name}</h4>
                    <p>{feature.description}</p>
                  </div>
                  <span className="feature-badge">
                    {feature.source === 'BASE' ? 'Base Feature' : 'Included'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No features included yet.</p>
          )}
        </section>

        {/* Active Add-ons Section */}
        {data.active_addons.length > 0 && (
          <section className="section active-addons-section">
            <h2>Your Active Add-ons</h2>
            <div className="addons-grid">
              {data.active_addons.map(addon => (
                <div key={addon.id} className="addon-card active">
                  <div className="addon-header">
                    <h4>{addon.name}</h4>
                    <span className="addon-badge active">Active</span>
                  </div>
                  <p>{addon.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Available Add-ons Marketplace */}
        <section className="section available-addons-section">
          <h2>Available Add-ons</h2>
          <p className="section-description">
            Enhance your plan with these additional features
          </p>

          {data.available_addons.length > 0 ? (
            <div className="addons-grid marketplace">
              {data.available_addons.map(addon => (
                <div key={addon.id} className={`addon-card available ${!addon.dependencies_met ? 'deps-warning' : ''}`}>
                  <div className="addon-header">
                    <h4>{addon.name}</h4>
                  </div>
                  <p>{addon.description}</p>

                  {addon.missing_dependencies?.length > 0 && (
                    <div className="deps-note">
                      <span className="deps-icon">⚠️</span>
                      <span>Requires: {addon.missing_dependencies.join(', ')}</span>
                    </div>
                  )}

                  <button
                    onClick={() => handleRequestAddon(addon.id)}
                    disabled={requesting === addon.id || !addon.dependencies_met}
                    className="btn btn-primary addon-cta"
                  >
                    {requesting === addon.id ? 'Requesting...' : 'Request Add-on'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="all-included">
              <div className="all-included-icon">🎉</div>
              <h3>You have access to all available features!</h3>
              <p>Your plan includes all add-ons. Enjoy the full power of our platform.</p>
            </div>
          )}
        </section>

        {/* Upgrade Plans Section */}
        <section className="section upgrade-section">
          <h2>Upgrade Your Plan</h2>
          <p className="section-description">
            Get more features and higher limits with a plan upgrade
          </p>

          <div className="plans-grid">
            {data.available_plans.map(plan => (
              <div
                key={plan.id}
                className={`plan-card ${plan.is_current ? 'current' : ''}`}
              >
                <div className="plan-name">{plan.name}</div>
                <p className="plan-description">{plan.description}</p>
                {plan.monthly_price_cents && (
                  <div className="plan-price">
                    €{(plan.monthly_price_cents / 100).toFixed(0)}
                    <span>/month</span>
                  </div>
                )}
                {plan.is_current ? (
                  <span className="current-badge">Current Plan</span>
                ) : (
                  <a href="mailto:sales@example.com" className="btn btn-secondary">
                    Contact Sales
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Styles */}
        <style>{`
          .settings-plan-addons {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
          }

          .page-header {
            margin-bottom: 2rem;
          }
          .breadcrumb {
            font-size: 0.875rem;
            color: var(--color-text-secondary);
            margin-bottom: 0.5rem;
          }
          .breadcrumb a {
            color: var(--color-primary);
          }
          .breadcrumb span {
            margin: 0 0.5rem;
          }
          .page-header h1 {
            margin: 0 0 0.5rem 0;
            font-size: 1.75rem;
          }
          .subtitle {
            color: var(--color-text-secondary);
            margin: 0;
          }

          .section {
            margin-bottom: 3rem;
          }
          .section h2 {
            margin: 0 0 1rem 0;
            font-size: 1.25rem;
            border-bottom: 1px solid var(--color-border);
            padding-bottom: 0.5rem;
          }
          .section-description {
            color: var(--color-text-secondary);
            margin-bottom: 1.5rem;
          }

          .current-plan-card, .no-plan-card {
            background: var(--color-bg-secondary);
            border: 2px solid var(--color-primary);
            border-radius: 12px;
            padding: 1.5rem;
            max-width: 400px;
          }
          .plan-header {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 0.5rem;
          }
          .plan-name {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--color-primary);
          }
          .plan-badge {
            background: var(--color-success);
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
          }
          .plan-description {
            color: var(--color-text-secondary);
            margin-bottom: 1rem;
          }

          .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1rem;
          }
          .feature-card {
            display: flex;
            gap: 1rem;
            padding: 1rem;
            background: var(--color-bg-secondary);
            border-radius: 8px;
            border: 1px solid var(--color-border);
          }
          .feature-card.included {
            border-left: 3px solid var(--color-success);
          }
          .feature-icon {
            flex-shrink: 0;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(34, 197, 94, 0.1);
            border-radius: 8px;
            color: var(--color-success);
          }
          .feature-content {
            flex: 1;
          }
          .feature-content h4 {
            margin: 0 0 0.25rem 0;
            font-size: 0.95rem;
          }
          .feature-content p {
            margin: 0;
            font-size: 0.8rem;
            color: var(--color-text-secondary);
          }
          .feature-badge {
            font-size: 0.7rem;
            background: var(--color-bg);
            color: var(--color-text-secondary);
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            white-space: nowrap;
            align-self: flex-start;
          }

          .addons-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1.5rem;
          }
          .addon-card {
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: 12px;
            padding: 1.5rem;
          }
          .addon-card.active {
            border-color: var(--color-success);
            border-left: 4px solid var(--color-success);
          }
          .addon-card.deps-warning {
            opacity: 0.7;
          }
          .addon-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 0.5rem;
          }
          .addon-header h4 {
            margin: 0;
            font-size: 1.1rem;
          }
          .addon-badge {
            font-size: 0.7rem;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
          }
          .addon-badge.active {
            background: rgba(34, 197, 94, 0.1);
            color: var(--color-success);
          }
          .addon-card p {
            color: var(--color-text-secondary);
            font-size: 0.9rem;
            margin-bottom: 1rem;
          }
          .deps-note {
            background: rgba(255, 193, 7, 0.1);
            border: 1px solid rgba(255, 193, 7, 0.3);
            border-radius: 6px;
            padding: 0.5rem 0.75rem;
            margin-bottom: 1rem;
            font-size: 0.8rem;
            color: var(--color-warning);
          }
          .deps-icon {
            margin-right: 0.5rem;
          }
          .addon-cta {
            width: 100%;
          }

          .all-included {
            text-align: center;
            padding: 3rem;
            background: var(--color-bg-secondary);
            border-radius: 12px;
          }
          .all-included-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
          }
          .all-included h3 {
            margin: 0 0 0.5rem 0;
          }
          .all-included p {
            color: var(--color-text-secondary);
            margin: 0;
          }

          .plans-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 1.5rem;
          }
          .plan-card {
            background: var(--color-bg-secondary);
            border: 2px solid var(--color-border);
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
          }
          .plan-card.current {
            border-color: var(--color-primary);
            background: rgba(59, 130, 246, 0.05);
          }
          .plan-card .plan-name {
            font-size: 1.25rem;
            margin-bottom: 0.5rem;
            display: block;
          }
          .plan-card .plan-description {
            font-size: 0.875rem;
            margin-bottom: 1rem;
          }
          .plan-price {
            font-size: 2rem;
            font-weight: 700;
            color: var(--color-text);
            margin-bottom: 1rem;
          }
          .plan-price span {
            font-size: 0.875rem;
            font-weight: 400;
            color: var(--color-text-secondary);
          }
          .current-badge {
            display: inline-block;
            background: var(--color-primary);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            font-size: 0.875rem;
            font-weight: 600;
          }

          .empty-state {
            color: var(--color-text-secondary);
            text-align: center;
            padding: 2rem;
          }

          .loading, .error-box {
            text-align: center;
            padding: 3rem;
          }
          .error-box h3 {
            color: var(--color-danger);
            margin-bottom: 0.5rem;
          }
        `}</style>
      </div>
    </Layout>
  );
}
