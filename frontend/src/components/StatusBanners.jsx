/**
 * Status Banners Component
 * Shows trial countdown and email verification reminders
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../utils/api';

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * Trial Countdown Banner
 */
export function TrialBanner() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [billingStatus, setBillingStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const loadBillingStatus = async () => {
      try {
        const data = await api.getBillingStatus();
        setBillingStatus(data);
      } catch (err) {
        console.error('Failed to load billing status:', err);
      }
    };

    loadBillingStatus();
  }, []);

  // Check if dismissed this session
  useEffect(() => {
    const sessionDismissed = sessionStorage.getItem('trial_banner_dismissed');
    if (sessionDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('trial_banner_dismissed', 'true');
  };

  // Don't show if:
  // - Still loading
  // - Dismissed
  // - Not on trial
  // - Already subscribed
  if (!billingStatus || dismissed) return null;
  if (billingStatus.company?.status !== 'trial') return null;
  if (billingStatus.subscription?.status === 'active') return null;

  const daysRemaining = billingStatus.company?.trialDaysRemaining || 0;
  const isUrgent = daysRemaining <= 3;
  const isExpired = daysRemaining <= 0;

  return (
    <div
      style={{
        background: isExpired
          ? 'linear-gradient(90deg, #ef4444, #dc2626)'
          : isUrgent
          ? 'linear-gradient(90deg, #f59e0b, #d97706)'
          : 'linear-gradient(90deg, var(--color-primary), var(--color-info))',
        color: 'white',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        fontSize: '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <ClockIcon />
        <span>
          {isExpired ? (
            <strong>{t('trialExpired')}</strong>
          ) : (
            <>
              <strong>{daysRemaining}</strong> {daysRemaining !== 1 ? t('daysLeftTrial') : t('dayLeftTrial')}
            </>
          )}
          {' '}
          {isExpired
            ? t('subscribeNowToContinue')
            : t('upgradeToKeepData')}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => navigate('/settings')}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '6px',
            padding: '6px 14px',
            color: 'white',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
        >
          {isExpired ? t('subscribeNow') : t('upgrade')}
        </button>

        {!isExpired && (
          <button
            onClick={handleDismiss}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title={t('dismiss')}
          >
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Email Verification Banner
 */
export function EmailVerificationBanner() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Check if dismissed
  useEffect(() => {
    const sessionDismissed = sessionStorage.getItem('email_banner_dismissed');
    if (sessionDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('email_banner_dismissed', 'true');
  };

  const handleResend = async () => {
    setSending(true);
    try {
      await api.sendVerificationEmail();
      setSent(true);
    } catch (err) {
      console.error('Failed to send verification email:', err);
    } finally {
      setSending(false);
    }
  };

  // Don't show if:
  // - No user
  // - Already verified
  // - Dismissed
  if (!user || user.email_verified || dismissed) return null;

  return (
    <div
      style={{
        background: 'var(--color-warning-bg)',
        borderBottom: '1px solid var(--color-warning)',
        color: 'var(--color-text)',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        fontSize: '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <MailIcon style={{ color: 'var(--color-warning)' }} />
        <span>
          {t('verifyEmailAddress')} ({user.email}) {t('toReceiveNotifications')}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {sent ? (
          <span style={{ color: 'var(--color-success)', fontWeight: 500, fontSize: '13px' }}>
            {t('verificationEmailSent')}
          </span>
        ) : (
          <button
            onClick={handleResend}
            disabled={sending}
            style={{
              background: 'var(--color-warning)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              color: 'white',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? t('sending') : t('resendEmail')}
          </button>
        )}

        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          title={t('dismiss')}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

/**
 * Combined Status Banners
 */
export function StatusBanners() {
  return (
    <>
      <TrialBanner />
      <EmailVerificationBanner />
    </>
  );
}

export default StatusBanners;
