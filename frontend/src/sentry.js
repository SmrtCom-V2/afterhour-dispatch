/**
 * Error tracking (Sentry). Optional — no-ops if VITE_SENTRY_DSN is unset,
 * mirrors the backend's src/utils/sentry.js pattern.
 */
import * as Sentry from '@sentry/react';

export const sentryEnabled = Boolean(import.meta.env.VITE_SENTRY_DSN);

export function initSentry() {
  if (!sentryEnabled) return;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 0,
  });
}

export { Sentry };
