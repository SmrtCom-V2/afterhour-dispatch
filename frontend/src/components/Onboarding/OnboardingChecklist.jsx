/**
 * Onboarding Checklist Component
 * Shows setup progress on dashboard
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../../context/OnboardingContext';
import { useLanguage } from '../../context/LanguageContext';

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export function OnboardingChecklist() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const {
    steps,
    progress,
    isComplete,
    dismissed,
    dismissChecklist,
    setShowTour,
    loading,
  } = useOnboarding();

  const [expanded, setExpanded] = useState(true);

  // Don't show if loading, dismissed, or complete
  if (loading || dismissed || isComplete) return null;

  // Filter out welcome step for display
  const displaySteps = steps.filter(s => s.id !== 'welcome');
  const completedDisplaySteps = displaySteps.filter(s => s.completed).length;

  const handleStepClick = (step) => {
    if (step.route && !step.completed) {
      navigate(step.route);
    }
  };

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-info-bg))',
          borderBottom: expanded ? '1px solid var(--color-border)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            {progress}%
          </div>
          <div>
            <h3
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--color-text)',
                marginBottom: 2,
              }}
            >
              {t('completeYourSetup')}
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--color-text-secondary)',
                margin: 0,
              }}
            >
              {(t('stepsCompleted') || '{0} of {1} steps completed')
                .replace('{0}', completedDisplaySteps)
                .replace('{1}', displaySteps.length)}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTour(true);
            }}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
            }}
          >
            <PlayIcon />
            {t('tour')}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismissChecklist();
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 6,
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
            }}
            title={t('dismissChecklist')}
          >
            <CloseIcon />
          </button>
          <div style={{ color: 'var(--color-text-muted)' }}>
            {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 3,
          background: 'var(--color-border)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--color-primary)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Steps list */}
      {expanded && (
        <div style={{ padding: '8px 0' }}>
          {displaySteps.map((step, index) => (
            <div
              key={step.id}
              onClick={() => handleStepClick(step)}
              style={{
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                cursor: step.route && !step.completed ? 'pointer' : 'default',
                transition: 'background 0.15s',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                if (step.route && !step.completed) {
                  e.currentTarget.style.background = 'var(--color-bg-hover)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Checkbox */}
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: step.completed
                    ? 'none'
                    : '2px solid var(--color-border)',
                  background: step.completed
                    ? 'var(--color-success)'
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  flexShrink: 0,
                }}
              >
                {step.completed ? (
                  <CheckIcon />
                ) : (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: step.completed
                      ? 'var(--color-text-muted)'
                      : 'var(--color-text)',
                    textDecoration: step.completed ? 'line-through' : 'none',
                    marginBottom: 2,
                  }}
                >
                  {step.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {step.description}
                </div>
              </div>

              {/* Action arrow */}
              {step.route && !step.completed && (
                <div
                  style={{
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ArrowRightIcon />
                </div>
              )}

              {/* Completed badge */}
              {step.completed && (
                <span
                  className="badge badge-success"
                  style={{ fontSize: 11 }}
                >
                  {t('done')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OnboardingChecklist;
