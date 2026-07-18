/**
 * Ops alerting — calls the operator's phone when something that would
 * otherwise fail silently at 3am breaks. Not a replacement for real
 * error monitoring (Sentry etc.), just the minimum needed so a crash
 * doesn't go unnoticed until a customer complains.
 *
 * Voice call, not SMS: this Twilio number is voice-only (no SMS
 * capability on the account as of July 2026 — see project notes).
 * Reuses notifyHuman's existing call-content mechanism rather than
 * duplicating it.
 *
 * Rate-limited per alert key so a crash loop places one call, not
 * hundreds.
 */

import { notifyHuman } from '../services/notificationChannel.js';
import { logger } from '../utils/logger.js';

const COOLDOWN_MS = 30 * 60 * 1000; // one alert per key per 30 min
const lastSentAt = new Map();

export async function sendOpsAlert(key, message) {
  const opsPhone = process.env.OPS_ALERT_PHONE;

  logger.error(`OPS ALERT [${key}]: ${message}`);

  if (!opsPhone) {
    logger.warn('OPS_ALERT_PHONE not configured — alert only logged, not sent');
    return;
  }

  const last = lastSentAt.get(key);
  if (last && Date.now() - last < COOLDOWN_MS) {
    return; // already alerted recently for this key, don't spam
  }

  try {
    const result = await notifyHuman({
      recipient: { phone: opsPhone },
      purpose: 'wakeup', // reuses the existing content/webhook plumbing; not a real wakeup incident
      content: {
        title: 'System Alert',
        body: `System alert: ${message}`.slice(0, 500),
      },
      channels: ['voice_call'], // SMS not available on this Twilio number
      correlation: {},
    });

    if (result.delivered) {
      lastSentAt.set(key, Date.now());
    } else {
      logger.error('Ops alert call failed to deliver', { key });
    }
  } catch (error) {
    logger.error('Failed to send ops alert call', { error: error.message, key });
  }
}
