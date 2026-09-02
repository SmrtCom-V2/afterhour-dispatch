import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './CookieConsent.css';

const COOKIE_CONSENT_KEY = 'cookie_consent';
const COOKIE_PREFERENCES_KEY = 'cookie_preferences';

// Token-authed operational pages, opened from an SMS/email link by someone
// acting on a live incident — not marketing pages with "visitors". A cookie
// banner over the 3am decision cockpit is noise at best, a click-blocking
// overlay at worst.
const SUPPRESSED_PATH_PREFIXES = ['/cockpit/', '/report/'];

export function CookieConsent() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true, // Always required
    analytics: false,
    functional: false,
  });

  useEffect(() => {
    if (SUPPRESSED_PATH_PREFIXES.some((p) => window.location.pathname.startsWith(p))) {
      return undefined;
    }
    // Check if user has already consented
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay to not show immediately on page load
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    } else {
      // Load saved preferences
      try {
        const saved = JSON.parse(localStorage.getItem(COOKIE_PREFERENCES_KEY) || '{}');
        setPreferences(prev => ({ ...prev, ...saved }));
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Listen for openCookieSettings event from Settings page
  useEffect(() => {
    const handleOpenSettings = () => {
      // Load current preferences
      try {
        const saved = JSON.parse(localStorage.getItem(COOKIE_PREFERENCES_KEY) || '{}');
        setPreferences(prev => ({ ...prev, ...saved }));
      } catch (e) {
        // Ignore parse errors
      }
      setShowSettings(true);
      setVisible(true);
    };

    window.addEventListener('openCookieSettings', handleOpenSettings);
    return () => window.removeEventListener('openCookieSettings', handleOpenSettings);
  }, []);

  const saveConsent = (prefs) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, new Date().toISOString());
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(prefs));
    setPreferences(prefs);
    setVisible(false);
    setShowSettings(false);

    // Dispatch event so other components can react
    window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: prefs }));
  };

  const handleAcceptAll = () => {
    saveConsent({
      essential: true,
      analytics: true,
      functional: true,
    });
  };

  const handleRejectAll = () => {
    saveConsent({
      essential: true,
      analytics: false,
      functional: false,
    });
  };

  const handleSavePreferences = () => {
    saveConsent(preferences);
  };

  if (!visible) return null;

  return (
    <div className="cookie-consent-overlay">
      <div className={`cookie-consent ${showSettings ? 'expanded' : ''}`}>
        {!showSettings ? (
          <>
            <div className="cookie-consent-content">
              <div className="cookie-consent-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="8" cy="9" r="1" fill="currentColor" />
                  <circle cx="15" cy="8" r="1" fill="currentColor" />
                  <circle cx="10" cy="14" r="1" fill="currentColor" />
                  <circle cx="16" cy="13" r="1" fill="currentColor" />
                  <circle cx="13" cy="17" r="1" fill="currentColor" />
                </svg>
              </div>
              <div className="cookie-consent-text">
                <h3>{t('cookieTitle')}</h3>
                <p>{t('cookieBody')}</p>
              </div>
            </div>
            <div className="cookie-consent-actions">
              <button className="cookie-btn cookie-btn-secondary" onClick={handleRejectAll}>
                {t('cookieRejectAll')}
              </button>
              <button className="cookie-btn cookie-btn-secondary" onClick={() => setShowSettings(true)}>
                {t('cookieCustomize')}
              </button>
              <button className="cookie-btn cookie-btn-primary" onClick={handleAcceptAll}>
                {t('cookieAcceptAll')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="cookie-consent-header">
              <h3>{t('cookiePreferences')}</h3>
              <button className="cookie-close-btn" onClick={() => setShowSettings(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="cookie-settings">
              <div className="cookie-category">
                <div className="cookie-category-header">
                  <div className="cookie-category-info">
                    <h4>{t('cookieEssentialTitle')}</h4>
                    <p>{t('cookieEssentialDesc')}</p>
                  </div>
                  <label className="cookie-toggle disabled">
                    <input type="checkbox" checked disabled />
                    <span className="cookie-toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="cookie-category">
                <div className="cookie-category-header">
                  <div className="cookie-category-info">
                    <h4>{t('cookieAnalyticsTitle')}</h4>
                    <p>{t('cookieAnalyticsDesc')}</p>
                  </div>
                  <label className="cookie-toggle">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                    />
                    <span className="cookie-toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="cookie-category">
                <div className="cookie-category-header">
                  <div className="cookie-category-info">
                    <h4>{t('cookieFunctionalTitle')}</h4>
                    <p>{t('cookieFunctionalDesc')}</p>
                  </div>
                  <label className="cookie-toggle">
                    <input
                      type="checkbox"
                      checked={preferences.functional}
                      onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                    />
                    <span className="cookie-toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
            <div className="cookie-consent-actions">
              <button className="cookie-btn cookie-btn-secondary" onClick={handleRejectAll}>
                {t('cookieRejectAll')}
              </button>
              <button className="cookie-btn cookie-btn-primary" onClick={handleSavePreferences}>
                {t('cookieSavePreferences')}
              </button>
            </div>
          </>
        )}

        <div className="cookie-consent-footer">
          <a href="/privacy" target="_blank" rel="noopener noreferrer">{t('cookiePrivacyPolicy')}</a>
          <span className="cookie-footer-divider">|</span>
          <a href="/impressum" target="_blank" rel="noopener noreferrer">Impressum</a>
        </div>
      </div>
    </div>
  );
}

// Utility function to check cookie consent
export function getCookiePreferences() {
  try {
    return JSON.parse(localStorage.getItem(COOKIE_PREFERENCES_KEY) || '{}');
  } catch {
    return { essential: true, analytics: false, functional: false };
  }
}

export function hasConsentedTo(category) {
  const prefs = getCookiePreferences();
  return prefs[category] === true;
}

// Function to open cookie settings (can be called from Settings page)
export function openCookieSettings() {
  localStorage.removeItem(COOKIE_CONSENT_KEY);
  window.location.reload();
}
