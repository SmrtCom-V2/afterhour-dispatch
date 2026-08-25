/**
 * Error tracking (Sentry). Optional — no-ops if SENTRY_DSN is unset, same
 * pattern as OPS_ALERT_PHONE in opsAlert.js. This is the piece opsAlert.js's
 * header comment says it is NOT a substitute for: it groups and surfaces
 * non-crashing errors (a caught exception that gets logged but doesn't crash
 * the process), which the crash-triggers-a-phone-call alert never sees.
 */
import * as Sentry from '@sentry/node';
import { config } from '../config/index.js';

const enabled = Boolean(process.env.SENTRY_DSN);

export function initSentry() {
  if (!enabled) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: config.nodeEnv,
    tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 0,
  });
}

// Tags the current Sentry scope with the request's correlation ID so a
// Sentry error can be cross-referenced with the structured logs, which
// already key everything off req.id (see requestId.js).
export function captureError(err, req) {
  if (!enabled) return;

  Sentry.withScope((scope) => {
    if (req?.id) scope.setTag('requestId', req.id);
    if (req?.path) scope.setTag('path', req.path);
    if (req?.method) scope.setTag('method', req.method);
    Sentry.captureException(err);
  });
}

export { Sentry, enabled as sentryEnabled };
