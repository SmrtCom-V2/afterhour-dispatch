import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { API_URL } from '../utils/apiConfig';

// Icons
const BuildingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
  </svg>
);

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

// 3-Step Signup with Email Verification
export function Signup() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [codeSent, setCodeSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { t, language } = useLanguage();
  const codeInputRefs = useRef([]);

  // Form data
  const [formData, setFormData] = useState({
    companyName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    adminName: '',
    oncallPhone: '',
    termsAccepted: false
  });

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateStep1 = () => {
    if (!formData.companyName.trim()) {
      setError(t('companyNameRequired') || 'Company name is required');
      return false;
    }
    if (!formData.phone.trim()) {
      setError(t('companyPhoneRequired') || 'Company phone is required');
      return false;
    }
    return true;
  };

  const validateEmail = () => {
    if (!formData.email.trim()) {
      setError(t('emailRequired') || 'Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError(t('invalidEmail') || 'Invalid email format');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.adminName.trim()) {
      setError(t('yourNameRequired') || 'Your name is required');
      return false;
    }
    if (!formData.password) {
      setError(t('passwordRequired') || 'Password is required');
      return false;
    }
    if (formData.password.length < 8) {
      setError(t('passwordMinLength') || 'Password must be at least 8 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError(t('passwordsMustMatch') || 'Passwords must match');
      return false;
    }
    if (!formData.termsAccepted) {
      setError(t('mustAcceptTerms') || 'You must accept the Terms of Service to continue');
      return false;
    }
    return true;
  };

  // Send verification code
  const sendVerificationCode = async () => {
    if (!validateEmail()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/signup-verification/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          companyName: formData.companyName,
          phone: formData.phone
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      setCodeSent(true);
      setResendTimer(60); // 60 second cooldown
      setVerificationCode(['', '', '', '', '', '']);
      // Focus first input
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle code input
  const handleCodeInput = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (value && index === 5 && newCode.every(d => d !== '')) {
      verifyCode(newCode.join(''));
    }
  };

  // Handle paste
  const handleCodePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setVerificationCode(newCode);
      codeInputRefs.current[5]?.focus();
      verifyCode(pastedData);
    }
  };

  // Handle backspace
  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  // Verify code
  const verifyCode = async (code) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/signup-verification/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          code: code || verificationCode.join('')
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      // Code verified - move to step 3
      setStep(3);
      setError('');
    } catch (err) {
      setError(err.message);
      setVerificationCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Resend code
  const resendCode = async () => {
    if (resendTimer > 0) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/signup-verification/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend code');
      }

      setResendTimer(60);
      setVerificationCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
      setError('');
    } else if (step === 3 && validateStep3()) {
      completeRegistration();
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setCodeSent(false);
      setVerificationCode(['', '', '', '', '', '']);
    } else if (step === 3) {
      setStep(2);
    }
    setError('');
  };

  // Complete registration
  const completeRegistration = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.companyName,
          phone: formData.phone,
          email: formData.email,
          password: formData.password,
          adminName: formData.adminName || undefined,
          oncallPhone: formData.oncallPhone || undefined,
          emailVerified: true, // Email already verified in step 2
          termsAccepted: formData.termsAccepted,
          language
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Store token and user
      localStorage.setItem('token', data.token);
      setUser(data.user);

      // Redirect to dashboard
      navigate('/');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Step indicator component
  const StepIndicator = ({ stepNum, label, current }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: current >= stepNum ? 'var(--color-primary)' : 'var(--color-bg-hover)',
        color: current >= stepNum ? 'white' : 'var(--color-text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: '14px'
      }}>
        {current > stepNum ? <CheckIcon /> : stepNum}
      </div>
      <span style={{
        fontSize: '13px',
        fontWeight: current === stepNum ? 600 : 400,
        color: current === stepNum ? 'var(--color-text)' : 'var(--color-text-muted)'
      }}>{label}</span>
    </div>
  );

  const StepDivider = ({ active }) => (
    <div style={{
      width: '30px',
      height: '2px',
      background: active ? 'var(--color-primary)' : 'var(--color-border)',
      alignSelf: 'center'
    }} />
  );

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480 }}>
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </div>
          <h1 className="login-title">After Hour Dispatch</h1>
          <p className="login-subtitle">{t('startYourFreeTrial') || 'Start your free trial'}</p>
        </div>

        {/* Progress Steps */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '6px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          <StepIndicator stepNum={1} label={t('company') || 'Company'} current={step} />
          <StepDivider active={step > 1} />
          <StepIndicator stepNum={2} label={t('verify') || 'Verify'} current={step} />
          <StepDivider active={step > 2} />
          <StepIndicator stepNum={3} label={t('account') || 'Account'} current={step} />
        </div>

        {/* Error */}
        {error && <div className="login-error">{error}</div>}

        {/* Step 1: Company Info */}
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="login-form">
            <div className="form-group">
              <label className="form-label">{t('companyName') || 'Company Name'} *</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)'
                }}>
                  <BuildingIcon />
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder={t('yourFmCompanyName') || 'Your FM company name'}
                  value={formData.companyName}
                  onChange={(e) => updateField('companyName', e.target.value)}
                  style={{ paddingLeft: '44px' }}
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('companyPhoneNumber') || 'Company Phone'} *</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)'
                }}>
                  <PhoneIcon />
                </span>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+49 (0) 123 456789"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  style={{ paddingLeft: '44px' }}
                />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {t('mainCompanyContact') || 'Main company contact number'}
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '16px' }}
            >
              {t('continue') || 'Continue'}
            </button>

            <p style={{
              marginTop: '20px',
              textAlign: 'center',
              fontSize: '14px',
              color: 'var(--color-text-secondary)'
            }}>
              {t('alreadyHaveAccount') || 'Already have an account?'}{' '}
              <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                {t('signIn') || 'Sign in'}
              </Link>
            </p>
          </form>
        )}

        {/* Step 2: Email Verification */}
        {step === 2 && (
          <div className="login-form">
            {!codeSent ? (
              <>
                <div className="form-group">
                  <label className="form-label">{t('emailAddress') || 'Email Address'} *</label>
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
                      placeholder="name@company.com"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      style={{ paddingLeft: '44px' }}
                      autoFocus
                      autoComplete="email"
                    />
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    {t('weWillSendCode') || "We'll send you a verification code"}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleBack}
                    style={{ flex: '0 0 auto' }}
                  >
                    <ArrowLeftIcon />
                    {t('back') || 'Back'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    style={{ flex: 1 }}
                    onClick={sendVerificationCode}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="loading-spinner" style={{ width: 20, height: 20, marginBottom: 0 }} />
                        {t('sending') || 'Sending...'}
                      </>
                    ) : (
                      t('sendCode') || 'Send Code'
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'var(--color-primary-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px'
                  }}>
                    <MailIcon />
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>
                    {t('checkYourEmail') || 'Check your email'}
                  </h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: 0 }}>
                    {t('codeSentTo') || 'Code sent to'} <strong>{formData.email}</strong>
                  </p>
                </div>

                {/* 6-digit code input */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '24px'
                }}>
                  {verificationCode.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => codeInputRefs.current[index] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeInput(index, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(index, e)}
                      onPaste={handleCodePaste}
                      className="form-input"
                      style={{
                        width: '48px',
                        height: '56px',
                        textAlign: 'center',
                        fontSize: '24px',
                        fontWeight: 600,
                        padding: 0
                      }}
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  onClick={() => verifyCode()}
                  disabled={loading || verificationCode.some(d => !d)}
                >
                  {loading ? (
                    <>
                      <span className="loading-spinner" style={{ width: 20, height: 20, marginBottom: 0 }} />
                      {t('verifying') || 'Verifying...'}
                    </>
                  ) : (
                    t('verifyCode') || 'Verify Code'
                  )}
                </button>

                <div style={{
                  marginTop: '20px',
                  textAlign: 'center',
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)'
                }}>
                  {t('didntReceiveCode') || "Didn't receive the code?"}{' '}
                  {resendTimer > 0 ? (
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {t('resendIn') || 'Resend in'} {resendTimer}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={resendCode}
                      disabled={loading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-primary)',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      {t('resendCode') || 'Resend code'}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setCodeSent(false); setError(''); }}
                  style={{ width: '100%', marginTop: '12px' }}
                >
                  {t('changeEmail') || 'Change email'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 3: Account Info */}
        {step === 3 && (
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="login-form">
            <div style={{
              background: 'var(--color-success-bg)',
              border: '1px solid var(--color-success)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'var(--color-success)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckIcon />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-success)' }}>
                  {t('emailVerified') || 'Email verified'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {formData.email}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('yourFullName') || 'Your Full Name'} *</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)'
                }}>
                  <UserIcon />
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Max Mustermann"
                  value={formData.adminName}
                  onChange={(e) => updateField('adminName', e.target.value)}
                  style={{ paddingLeft: '44px' }}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('password') || 'Password'} *</label>
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
                  placeholder={t('atLeast8Characters') || 'At least 8 characters'}
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  style={{ paddingLeft: '44px' }}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('confirmPassword') || 'Confirm Password'} *</label>
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
                  placeholder={t('confirmYourPassword') || 'Confirm your password'}
                  value={formData.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  style={{ paddingLeft: '44px' }}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('onCallPhoneOptional') || 'On-Call Phone (Optional)'}</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)'
                }}>
                  <PhoneIcon />
                </span>
                <input
                  type="tel"
                  className="form-input"
                  placeholder={t('escalationPhoneNumber') || 'Escalation phone number'}
                  value={formData.oncallPhone}
                  onChange={(e) => updateField('oncallPhone', e.target.value)}
                  style={{ paddingLeft: '44px' }}
                />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {t('whereUrgentEscalations') || 'For urgent escalations'}
              </p>
            </div>

            {/* Trial info */}
            <div style={{
              background: 'var(--color-success-bg)',
              border: '1px solid var(--color-success)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginTop: '8px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--color-success)',
                fontWeight: 600,
                fontSize: '14px',
                marginBottom: '4px'
              }}>
                <CheckIcon /> {t('freeTrialDays') || '14-day free trial'}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                {t('noCreditCardRequired') || 'No credit card required'}
              </p>
            </div>

            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              marginTop: '20px',
              cursor: 'pointer',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5
            }}>
              <input
                type="checkbox"
                checked={formData.termsAccepted}
                onChange={(e) => updateField('termsAccepted', e.target.checked)}
                style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0 }}
                required
              />
              <span>
                {t('agreeToTermsCheckbox') || 'I agree to the'}{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer">
                  {t('termsOfService') || 'Terms of Service'}
                </a>{' '}
                {t('and') || 'and'}{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">
                  {t('privacyPolicy') || 'Privacy Policy'}
                </a>
              </span>
            </label>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleBack}
                style={{ flex: '0 0 auto' }}
              >
                <ArrowLeftIcon />
                {t('back') || 'Back'}
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ flex: 1 }}
                disabled={loading || !formData.termsAccepted}
              >
                {loading ? (
                  <>
                    <span className="loading-spinner" style={{ width: 20, height: 20, marginBottom: 0 }} />
                    {t('creatingAccount') || 'Creating account...'}
                  </>
                ) : (
                  t('createAccount') || 'Create Account'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
