import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

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
          <p className="login-subtitle">{t('fmAdminPortal')}</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">{t('emailAddress')}</label>
            <input
              type="email"
              className="form-input"
              placeholder={t('enterYourEmail')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">{t('password')}</label>
              <Link to="/forgot-password" style={{ fontSize: '13px', color: 'var(--color-primary)' }}>
                {t('forgotPassword')}
              </Link>
            </div>
            <input
              type="password"
              className="form-input"
              placeholder={t('enterYourPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner" style={{ width: 20, height: 20, marginBottom: 0 }} />
                {t('signingIn')}
              </>
            ) : (
              t('signIn')
            )}
          </button>
        </form>

        <p style={{
          marginTop: 20,
          textAlign: 'center',
          fontSize: 14,
          color: 'var(--color-text-secondary)'
        }}>
          {t('dontHaveAccount')}{' '}
          <Link to="/signup" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
            {t('startFreeTrial')}
          </Link>
        </p>

        <p style={{
          marginTop: 12,
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--color-text-muted)'
        }}>
          {t('afterHoursEmergencyDispatch')}
        </p>
      </div>
    </div>
  );
}
