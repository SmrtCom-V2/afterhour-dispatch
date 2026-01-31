/**
 * Entitlements Context
 * Provides entitlement state and helpers to the React app
 *
 * Part of A-Z Delivery Spec: Super Admin Entitlements + Customer Plan & Add-Ons
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../utils/api';

const EntitlementsContext = createContext(null);

export function EntitlementsProvider({ children }) {
  const { user } = useAuth();
  const [entitlements, setEntitlements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState(null);

  const fetchEntitlements = useCallback(async () => {
    if (!user) {
      setEntitlements(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await api.getEntitlements();
      setEntitlements(data.features || {});
      setVersion(data.entitlement_version || 0);
    } catch (err) {
      console.error('Failed to fetch entitlements:', err);
      setError(err.message);
      // Don't clear entitlements on error - keep stale data
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  /**
   * Check if a feature is enabled
   * @param {string} featureId - Feature ID (e.g., 'AO_SLA_TIMERS')
   * @returns {boolean}
   */
  const hasFeature = useCallback((featureId) => {
    return !!entitlements?.[featureId]?.enabled;
  }, [entitlements]);

  /**
   * Get the source of a feature (BASE, PLAN, ADDON, OVERRIDE)
   * @param {string} featureId - Feature ID
   * @returns {string|null}
   */
  const getFeatureSource = useCallback((featureId) => {
    return entitlements?.[featureId]?.source || null;
  }, [entitlements]);

  /**
   * Get feature details
   * @param {string} featureId - Feature ID
   * @returns {Object|null}
   */
  const getFeature = useCallback((featureId) => {
    return entitlements?.[featureId] || null;
  }, [entitlements]);

  /**
   * Check if feature is from plan (not a separate addon)
   * @param {string} featureId - Feature ID
   * @returns {boolean}
   */
  const isFromPlan = useCallback((featureId) => {
    const source = entitlements?.[featureId]?.source;
    return source === 'PLAN' || source === 'BASE';
  }, [entitlements]);

  /**
   * Refresh entitlements from server
   */
  const refresh = useCallback(() => {
    setLoading(true);
    return fetchEntitlements();
  }, [fetchEntitlements]);

  /**
   * Get all enabled features
   * @returns {string[]}
   */
  const getEnabledFeatures = useCallback(() => {
    if (!entitlements) return [];
    return Object.keys(entitlements).filter(key => entitlements[key]?.enabled);
  }, [entitlements]);

  /**
   * Get all addon features (regardless of enabled status)
   * @returns {Object[]}
   */
  const getAddonFeatures = useCallback(() => {
    if (!entitlements) return [];
    return Object.entries(entitlements)
      .filter(([_, value]) => value.source === 'ADDON' || value.source === 'OVERRIDE' || !value.enabled)
      .map(([id, value]) => ({ id, ...value }));
  }, [entitlements]);

  return (
    <EntitlementsContext.Provider value={{
      entitlements,
      loading,
      error,
      version,
      hasFeature,
      getFeatureSource,
      getFeature,
      isFromPlan,
      refresh,
      getEnabledFeatures,
      getAddonFeatures
    }}>
      {children}
    </EntitlementsContext.Provider>
  );
}

/**
 * Hook to access entitlements context
 */
export function useEntitlements() {
  const context = useContext(EntitlementsContext);
  if (!context) {
    throw new Error('useEntitlements must be used within EntitlementsProvider');
  }
  return context;
}

/**
 * Component to conditionally render based on feature entitlement
 *
 * Usage:
 *   <FeatureGate feature="AO_SLA_TIMERS">
 *     <SlaTimersComponent />
 *   </FeatureGate>
 *
 *   <FeatureGate feature="AO_ANALYTICS_BACKLOG_TRENDS" fallback={<UpgradePrompt />}>
 *     <AnalyticsDashboard />
 *   </FeatureGate>
 */
export function FeatureGate({ feature, children, fallback = null, showLoading = false }) {
  const { hasFeature, loading } = useEntitlements();

  if (loading && showLoading) {
    return <div className="feature-gate-loading">Loading...</div>;
  }

  if (loading) {
    return null;
  }

  if (!hasFeature(feature)) {
    return fallback;
  }

  return children;
}

/**
 * Component for upgrade prompts when feature is not available
 */
export function FeatureUpgradePrompt({ feature, title, description }) {
  const { getFeature } = useEntitlements();
  const featureInfo = getFeature(feature);

  return (
    <div className="feature-upgrade-prompt">
      <div className="upgrade-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      <h3>{title || featureInfo?.name || 'Premium Feature'}</h3>
      <p>{description || featureInfo?.description || 'This feature is not available on your current plan.'}</p>
      {featureInfo?.reason_disabled && (
        <p className="dependency-note">{featureInfo.reason_disabled}</p>
      )}
      <a href="/settings/plan-addons" className="btn btn-primary">
        View Plans & Add-ons
      </a>
    </div>
  );
}

export default { EntitlementsProvider, useEntitlements, FeatureGate, FeatureUpgradePrompt };
