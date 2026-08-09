import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

import { API_URL } from '../utils/apiConfig';

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

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

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setTokenError(t('noVerificationToken'));
      setVerifying(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`${API_URL}/password-reset/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Invalid token');
        }

        setTokenValid(true);
        setEmail(data.email);
      } catch (err) {
        setTokenError(err.message);
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password) {
      setError(t('pleaseEnterNewPassword'));
      return;
    }

    if (password.length < 8) {
      setError(t('passwordMust8Chars'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatchReset'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/password-reset/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Reset failed');
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (verifying) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
            <p style={{ color: 'var(--color-text-secondary)' }}>{t('verifyingResetLink')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Invalid token
  if (tokenError) {
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
              {t('invalidResetLink')}
            </h2>
            <p style={{
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              marginBottom: '24px'
            }}>
              {tokenError}
            </p>
            <p style={{
              color: 'var(--color-text-muted)',
              fontSize: '13px',
              marginBottom: '24px'
            }}>
              {t('resetLinksExpire')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Link
                to="/forgot-password"
                className="btn btn-primary"
                style={{ width: '100%', textAlign: 'center' }}
              >
                {t('requestNewLink')}
              </Link>
              <Link
                to="/login"
                className="btn btn-secondary"
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

  // Success state
  if (success) {
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
              {t('passwordResetComplete')}
            </h2>
            <p style={{
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              marginBottom: '24px'
            }}>
              {t('passwordResetSuccess')}
            </p>
            <Link
              to="/login"
              className="btn btn-primary"
              style={{ width: '100%', textAlign: 'center' }}
            >
              {t('signIn')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Reset form
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
          <p className="login-subtitle">{t('setNewPassword')}</p>
        </div>

        {email && (
          <p style={{
            color: 'var(--color-text-secondary)',
            fontSize: '14px',
            textAlign: 'center',
            marginBottom: '24px'
          }}>
            {t('creatingPasswordFor')} <strong>{email}</strong>
          </p>
        )}

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('newPassword')}</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)'
              }}>
                <LockIcon />
              </span>
              <input
                type="password"
                className="form-input"
                placeholder={t('atLeast8Characters')}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                style={{ paddingLeft: '44px' }}
                autoFocus
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('confirmNewPassword')}</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)'
              }}>
                <LockIcon />
              </span>
              <input
                type="password"
                className="form-input"
                placeholder={t('confirmYourPassword')}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                style={{ paddingLeft: '44px' }}
                autoComplete="new-password"
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
                {t('resetting')}
              </>
            ) : (
              t('resetPassword')
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
