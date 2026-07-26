import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const CheckCircleIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useLanguage();

  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError(t('noVerificationToken'));
      setVerifying(false);
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await fetch(`${API_URL}/email-verification/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Verification failed');
        }

        setSuccess(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setVerifying(false);
      }
    };

    verifyEmail();
  }, [token, t]);

  // Loading state
  if (verifying) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
            <p style={{ color: 'var(--color-text-secondary)' }}>{t('verifyingEmail')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>
              <AlertCircleIcon />
            </div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              color: 'var(--color-text)',
              marginBottom: '12px'
            }}>
              {t('verificationFailed')}
            </h2>
            <p style={{
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              marginBottom: '24px'
            }}>
              {error}
            </p>
            <p style={{
              color: 'var(--color-text-muted)',
              fontSize: '13px',
              marginBottom: '24px'
            }}>
              {t('verificationLinksExpire')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Link
                to="/"
                className="btn btn-primary"
                style={{ width: '100%', textAlign: 'center' }}
              >
                {t('goToDashboard')}
              </Link>
              <Link
                to="/login"
                className="btn btn-secondary"
                style={{ width: '100%', textAlign: 'center' }}
              >
                {t('signIn')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ color: 'var(--color-success)', marginBottom: '16px' }}>
            <CheckCircleIcon />
          </div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--color-text)',
            marginBottom: '12px'
          }}>
            {t('emailVerified')}
          </h2>
          <p style={{
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
            marginBottom: '24px'
          }}>
            {t('emailVerifiedSuccess')}
          </p>
          <Link
            to="/"
            className="btn btn-primary"
            style={{ width: '100%', textAlign: 'center' }}
          >
            {t('goToDashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
