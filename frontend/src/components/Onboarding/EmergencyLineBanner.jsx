/**
 * Persistent red banner shown on the dashboard when the emergency line
 * isn't set up. Unlike the onboarding checklist (a soft nudge that can be
 * dismissed), this cannot be hidden — without a live number, tenants
 * literally cannot reach After Hour.
 * Spec: AFTERHOUR_PHONE_NUMBER_PROVISIONING_SPEC.md §10.1
 */

import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../../context/OnboardingContext';
import { useLanguage } from '../../context/LanguageContext';

const AlertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export function EmergencyLineBanner() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { blockingStep, loading } = useOnboarding();

  if (loading || !blockingStep || blockingStep.id !== 'setup_emergency_line') return null;

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 18px',
        marginBottom: 20,
        borderRadius: 10,
        background: 'var(--color-danger-bg, #FEF2F2)',
        border: '1px solid var(--color-danger)',
        color: 'var(--color-danger)',
      }}
    >
      <AlertIcon />
      <div style={{ flex: 1, fontSize: 14, color: 'var(--color-text)' }}>
        <strong>{t('emergencyLineNotSetUp') || "Your emergency line isn't set up yet."}</strong>{' '}
        {t('emergencyLineNotSetUpDesc') || 'Tenants cannot reach After Hour until you finish this.'}
      </div>
      <button className="btn btn-danger btn-sm" onClick={() => navigate('/settings/telephony')}>
        {t('finishSetup') || 'Finish setup'}
      </button>
    </div>
  );
}

export default EmergencyLineBanner;
