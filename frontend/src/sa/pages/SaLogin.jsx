import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSaAuth } from '../SaAuthContext';

// Shield Icon
const ShieldIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

export function SaLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useSaAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/sa/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sa-login">
      <div className="sa-login-card">
        {/* Logo */}
        <div className="sa-login-logo">
          <div className="sa-login-logo-icon">
            <ShieldIcon />
          </div>
          <div className="sa-login-title">After Hour Dispatch</div>
          <div className="sa-login-subtitle">Super Admin Portal</div>
        </div>

        {/* Error */}
        {error && <div className="sa-error">{error}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              Email Address
            </label>
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
                className="sa-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder="admin@company.com"
                style={{ paddingLeft: '44px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              Password
            </label>
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
                className="sa-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                style={{ paddingLeft: '44px' }}
              />
            </div>
          </div>

          <button
            className="sa-btn sa-btn-danger"
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '48px',
              fontSize: '15px',
              fontWeight: 600,
              marginTop: '8px'
            }}
          >
            {loading ? (
              <>
                <span className="sa-loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', marginBottom: 0 }}></span>
                Signing in...
              </>
            ) : (
              'Sign in to Super Admin'
            )}
          </button>
        </form>

        {/* Footer note */}
        <p className="sa-login-note">
          Restricted access for platform operators only.
          <br />
          MFA verification required after sign in.
        </p>
      </div>
    </div>
  );
}
