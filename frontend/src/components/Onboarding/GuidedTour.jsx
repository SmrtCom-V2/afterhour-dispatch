/**
 * Guided Tour Component
 * Highlights UI elements and provides step-by-step guidance
 */

import { useEffect, useState, useRef } from 'react';
import { useOnboarding } from '../../context/OnboardingContext';
import { useLanguage } from '../../context/LanguageContext';

const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export function GuidedTour() {
  const {
    showTour,
    currentTourStep,
    tourStep,
    tourSteps,
    nextTourStep,
    prevTourStep,
    skipTour,
  } = useOnboarding();
  const { t } = useLanguage();

  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [highlightRect, setHighlightRect] = useState(null);
  const tooltipRef = useRef(null);

  // Position the tooltip and highlight
  useEffect(() => {
    if (!showTour || !currentTourStep) return;

    const positionElements = () => {
      const target = document.querySelector(currentTourStep.target);

      if (!target) {
        // Element not found, skip to next or use default position
        setHighlightRect(null);
        setTooltipPosition({ top: 100, left: 100 });
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = 8;

      // Set highlight rectangle
      setHighlightRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });

      // Calculate tooltip position based on placement
      const tooltipWidth = 320;
      const tooltipHeight = 180;
      let top, left;

      switch (currentTourStep.placement) {
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + 20;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - 20;
          break;
        case 'bottom':
          top = rect.bottom + 20;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'top':
          top = rect.top - tooltipHeight - 20;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        default:
          top = rect.bottom + 20;
          left = rect.left;
      }

      // Keep tooltip in viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left < 20) left = 20;
      if (left + tooltipWidth > viewportWidth - 20) left = viewportWidth - tooltipWidth - 20;
      if (top < 20) top = 20;
      if (top + tooltipHeight > viewportHeight - 20) top = viewportHeight - tooltipHeight - 20;

      setTooltipPosition({ top, left });
    };

    positionElements();

    // Reposition on resize
    window.addEventListener('resize', positionElements);
    return () => window.removeEventListener('resize', positionElements);
  }, [showTour, currentTourStep, tourStep]);

  if (!showTour || !currentTourStep) return null;

  return (
    <>
      {/* Overlay with cutout */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          pointerEvents: 'none',
        }}
      >
        {/* Dark overlay */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        >
          <defs>
            <mask id="tour-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {highlightRect && (
                <rect
                  x={highlightRect.left}
                  y={highlightRect.top}
                  width={highlightRect.width}
                  height={highlightRect.height}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.6)"
            mask="url(#tour-mask)"
          />
        </svg>

        {/* Highlight border */}
        {highlightRect && (
          <div
            style={{
              position: 'absolute',
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
              border: '2px solid var(--color-primary)',
              borderRadius: 8,
              boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3)',
              pointerEvents: 'none',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          width: 320,
          background: 'var(--color-bg)',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                background: 'var(--color-primary)',
                color: 'white',
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {tourStep + 1}
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--color-text-muted)',
              }}
            >
              {(t('tourStepOf') || 'Step {0} of {1}')
                .replace('{0}', tourStep + 1)
                .replace('{1}', tourSteps.length)}
            </span>
          </div>
          <button
            onClick={skipTour}
            style={{
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
            }}
            title={t('tourSkip')}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--color-text)',
              marginBottom: 8,
            }}
          >
            {currentTourStep.title}
          </h3>
          <p
            style={{
              fontSize: 14,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {currentTourStep.content}
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={prevTourStep}
            disabled={tourStep === 0}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: tourStep === 0 ? 0.5 : 1,
            }}
          >
            <ArrowLeftIcon />
            {t('tourPrevious')}
          </button>

          <button
            onClick={nextTourStep}
            className="btn btn-primary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {tourStep === tourSteps.length - 1 ? t('tourFinish') : t('tourNext')}
            {tourStep < tourSteps.length - 1 && <ArrowRightIcon />}
          </button>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.1);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

export default GuidedTour;
