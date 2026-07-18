/**
 * NotificationChannel — single seam for waking a human.
 *
 * Every new Night Ops notification (wake-up engine, all-SPs-failed fallback,
 * decision-card cascade) goes through notifyHuman() instead of calling the
 * telephony provider directly. Today it wraps voice_call/sms (the existing
 * Twilio provider). 'push' is a declared, legal channel value with no
 * adapter yet — when the SmrtCom worker app ships with FCM (Firebase config
 * already exists in the voice-gateway backend, currently disabled), a push
 * adapter slots in here with zero changes to callers. See
 * NIGHT_OPS_MASTER_PLAN.md §3.1 / HITL_DISPATCH_ARCHITECTURE.md §3.1.
 *
 * dispatch.js's existing internal SP call/SMS loop is NOT routed through
 * this — that code already works and master plan explicitly says don't
 * refactor it. This seam is for NEW human-notification call sites only.
 */

import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { getTelephonyProvider } from '../providers/telephony/index.js';

/**
 * @param {object} params
 * @param {{name?: string, phone: string, userRef?: string|null}} params.recipient
 * @param {'sp_dispatch'|'fm_escalation'|'decision_card'|'wakeup'} params.purpose
 * @param {{title: string, body: string, actionUrl?: string, dtmfPrompt?: string}} params.content
 * @param {Array<'voice_call'|'sms'|'push'>} params.channels - ordered preference
 * @param {{incidentId?: string, escalationId?: string, attemptId?: string, wakeupStage?: string}} params.correlation
 * @returns {Promise<{delivered: boolean, channelUsed: string|null, providerMessageId: string|null, reason?: string}>}
 */
export async function notifyHuman({ recipient, purpose, content, channels, correlation = {} }) {
  const telephony = getTelephonyProvider();

  for (const channel of channels) {
    try {
      if (channel === 'voice_call') {
        // Twilio's call webhook only posts CallSid/From/To/CallStatus — it
        // does not round-trip arbitrary metadata (same constraint dispatch.js
        // works around for SP calls). So the message content is persisted
        // first and looked up by the webhook via a short-lived token in the
        // URL, same pattern as dispatch.js's per-attemptId webhook.
        const callToken = await registerCallContent({ content, purpose, correlation });
        const webhookUrl = `${process.env.APP_URL || 'http://localhost:3005'}/api/webhooks/notify-call/${callToken}`;
        const result = await telephony.makeCall(recipient.phone, webhookUrl, {});
        if (result.success) {
          await logAttempt({ recipient, purpose, channel, result: 'sent', providerMessageId: result.callId, correlation });
          return { delivered: true, channelUsed: 'voice_call', providerMessageId: result.callId };
        }
        await logAttempt({ recipient, purpose, channel, result: 'failed', correlation });
        continue; // fall through to next channel
      }

      if (channel === 'sms') {
        const smsBody = content.actionUrl ? `${content.body}\n${content.actionUrl}` : content.body;
        const result = await telephony.sendSms(recipient.phone, smsBody);
        if (result.success) {
          await logAttempt({ recipient, purpose, channel, result: 'sent', providerMessageId: result.messageId, correlation });
          return { delivered: true, channelUsed: 'sms', providerMessageId: result.messageId };
        }
        await logAttempt({ recipient, purpose, channel, result: 'failed', correlation });
        continue;
      }

      if (channel === 'push') {
        // No adapter yet — declared for forward-compatibility with the
        // SmrtCom worker app. Falls through to the next channel in the list.
        logger.info('notifyHuman: push channel requested but no adapter available yet', { purpose, correlation });
        await logAttempt({ recipient, purpose, channel, result: 'channel_not_available', correlation });
        continue;
      }

      logger.warn('notifyHuman: unknown channel', { channel });
    } catch (error) {
      logger.error('notifyHuman: channel threw', { channel, purpose, error: error.message });
      await logAttempt({ recipient, purpose, channel, result: 'error', correlation });
    }
  }

  logger.error('notifyHuman: all channels exhausted, nobody notified', { purpose, recipient: recipient.phone, correlation });
  return { delivered: false, channelUsed: null, providerMessageId: null, reason: 'all_channels_failed' };
}

/**
 * Persist call content behind a short-lived token so the Twilio webhook can
 * look up what to say (Twilio's callback doesn't round-trip our metadata).
 * 10-minute expiry — plenty for a call that must be answered within 30s.
 */
async function registerCallContent({ content, purpose, correlation }) {
  const token = randomUUID();
  await db.query(
    `INSERT INTO notify_call_content (token, purpose, title, body, dtmf_prompt, correlation, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '10 minutes')`,
    [token, purpose, content.title || null, content.body, content.dtmfPrompt || null, JSON.stringify(correlation)],
  );
  return token;
}

/**
 * Every notifyHuman attempt is logged for audit — either against
 * wakeup_attempt (if correlation.incidentId + wakeupStage present, the
 * common case) or incident_timeline as a fallback so nothing is silently
 * unlogged.
 */
async function logAttempt({ recipient, purpose, channel, result, providerMessageId = null, correlation }) {
  try {
    if (correlation.incidentId && correlation.wakeupStage) {
      await db.query(
        `INSERT INTO wakeup_attempt (incident_id, person_name, phone, stage, channel, result, provider_message_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          correlation.incidentId,
          recipient.name || null,
          recipient.phone,
          correlation.wakeupStage,
          channel,
          result,
          providerMessageId,
        ],
      );
      return;
    }

    if (correlation.incidentId) {
      await db.query(
        `INSERT INTO incident_timeline (incident_id, event_type, event_data)
         VALUES ($1, 'notification.attempt', $2)`,
        [correlation.incidentId, JSON.stringify({ purpose, channel, result, recipient: recipient.phone })],
      );
    }
  } catch (error) {
    logger.error('notifyHuman: failed to log attempt', { error: error.message });
  }
}

export default { notifyHuman };
