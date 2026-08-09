import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

import { API_URL } from '../utils/apiConfig';

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError(t('pleaseEnterEmail'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/password-reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
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
              {t('checkYourEmail')}
            </h2>
            <p style={{
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              marginBottom: '24px'
            }}>
              {t('ifAccountExists').replace('{0}', email)}
            </p>
            <p style={{
              color: 'var(--color-text-muted)',
              fontSize: '13px',
              marginBottom: '24px'
            }}>
              {t('didntReceiveEmail')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                }}
                style={{ width: '100%' }}
              >
                {t('tryAnotherEmail')}
              </button>
              <Link
                to="/login"
                className="btn btn-primary"
                style={{ width: '100%', textAlign: 'center' }}
              >
                {t('backToSignIn')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </div>
          <h1 className="login-title">After Hour Dispatch</h1>
          <p className="login-subtitle">{t('resetYourPassword')}</p>
        </div>

        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: '14px',
          textAlign: 'center',
          marginBottom: '24px',
          lineHeight: 1.6
        }}>
          {t('enterEmailForReset')}
        </p>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('emailAddress')}</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)'
              }}>
                <MailIcon />
              </span>
              <input
                type="email"
                className="form-input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                style={{ paddingLeft: '44px' }}
                autoFocus
                autoComplete="email"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner" style={{ width: 20, height: 20, marginBottom: 0 }} />
                {t('sending')}
              </>
            ) : (
              t('sendResetLink')
            )}
          </button>
        </form>

        <Link
          to="/login"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '24px',
            color: 'var(--color-text-secondary)',
            fontSize: '14px'
          }}
        >
          <ArrowLeftIcon />
          {t('backToSignIn')}
        </Link>
      </div>
    </div>
  );
}
