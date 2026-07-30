/**
 * Welcome Modal
 * Shown to new users after first signup
 */

import { useOnboarding } from '../../context/OnboardingContext';
import { useLanguage } from '../../context/LanguageContext';

const RocketIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

const ChecklistIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const MapIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
);

export function WelcomeModal() {
  const { showWelcome, completeWelcome } = useOnboarding();
  const { t } = useLanguage();

  if (!showWelcome) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div
        className="modal-pro"
        style={{
          maxWidth: 520,
          animation: 'slideUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-info))',
            padding: '40px 32px 32px',
            textAlign: 'center',
            borderRadius: '12px 12px 0 0',
            color: 'white',
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.2)',
              width: 80,
              height: 80,
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <RocketIcon />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            {t('welcomeModalTitle')}
          </h2>
          <p style={{ opacity: 0.9, fontSize: 15, margin: 0 }}>
            {t('welcomeModalSubtitle')}
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '32px' }}>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 15,
              lineHeight: 1.6,
              marginBottom: 24,
              textAlign: 'center',
            }}
          >
            {t('welcomeModalBody')}
          </p>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '14px 20px',
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
              onClick={() => completeWelcome(true)}
            >
              <MapIcon />
              {t('takeQuickTour')}
            </button>

            <button
              className="btn btn-secondary"
              style={{
                width: '100%',
                padding: '14px 20px',
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
              onClick={() => completeWelcome(false)}
            >
              <ChecklistIcon />
              {t('skipTourShowChecklist')}
            </button>
          </div>

          {/* Features preview */}
          <div
            style={{
              marginTop: 28,
              padding: 20,
              background: 'var(--color-bg-secondary)',
              borderRadius: 10,
            }}
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text)',
                marginBottom: 12,
              }}
            >
              {t('whatYoullSetUp')}
            </p>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                fontSize: 13,
                color: 'var(--color-text-secondary)',
              }}
            >
              {[
                t('welcomeSetupPm'),
                t('welcomeSetupSp'),
                t('welcomeSetupTeam'),
                t('welcomeSetupSchedule'),
              ].map((item, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      flexShrink: 0,
                    }}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomeModal;
