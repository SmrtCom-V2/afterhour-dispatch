/**
 * SP Dispatch Service
 * Handles the SP dispatch loop with SLA timers
 *
 * Flow:
 * 1. Get SPs for building by trade, ordered by priority
 * 2. Call SP #1, wait 2 minutes
 * 3. If no pickup -> SMS, wait 10 minutes
 * 4. If no response -> next SP
 * 5. If all SPs unavailable -> escalate to FM on-call
 *
 * IMPORTANT: Message always includes "NO REPORT = NO PAYMENT"
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { getTelephonyProvider } from '../providers/telephony/index.js';
import { getEmailProvider } from '../providers/email/index.js';
import { config } from '../config/index.js';
import { notifyHuman } from './notificationChannel.js';

const CALL_TIMEOUT_MS = config.app.spCallTimeoutSeconds * 1000; // 2 minutes
const SMS_TIMEOUT_MS = config.app.spSmsTimeoutSeconds * 1000; // 10 minutes

/**
 * Start dispatch for an incident.
 *
 * @param {string|null} preferredSpId - when the Decision Cockpit's "send
 * company" override picked a specific SP (not the system's priority-1
 * suggestion), that SP is moved to the front of the call order. Existing
 * callers (the External Emergency Pickup job, T+10 fail-safe) don't pass
 * this and get the original priority-order behavior unchanged.
 */
export async function startDispatch(incidentId, requiredTrade, preferredSpId = null) {
  logger.info('Starting dispatch', { incidentId, requiredTrade, preferredSpId });

  // Get incident with building info
  const incidentResult = await db.query(
    `SELECT i.*, b.id as building_id, b.name as building_name, b.address as building_address,
            fm.phone_number as fm_phone, fm.fm_oncall_phone, fm.fm_oncall_name
     FROM incident i
     LEFT JOIN building b ON i.building_id = b.id
     LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
     LEFT JOIN fm_company fm ON pm.fm_company_id = fm.id
     WHERE i.id = $1`,
    [incidentId]
  );

  if (incidentResult.rows.length === 0) {
    logger.error('Incident not found for dispatch', { incidentId });
    return { success: false, error: 'Incident not found' };
  }

  const incident = incidentResult.rows[0];

  if (!incident.building_id) {
    logger.warn('No building associated with incident, escalating to FM', { incidentId });
    await escalateToFM(incident);
    return { success: false, error: 'No building associated' };
  }

  // Get available SPs for this building and trade
  const spsResult = await db.query(
    `SELECT sp.*, bsp.priority
     FROM service_provider sp
     JOIN building_service_provider bsp ON sp.id = bsp.service_provider_id
     WHERE bsp.building_id = $1
       AND sp.trade = $2
       AND sp.status = 'active'
     ORDER BY bsp.priority ASC`,
    [incident.building_id, requiredTrade]
  );

  if (spsResult.rows.length === 0) {
    // Try 'general' trade as fallback
    const generalSpsResult = await db.query(
      `SELECT sp.*, bsp.priority
       FROM service_provider sp
       JOIN building_service_provider bsp ON sp.id = bsp.service_provider_id
       WHERE bsp.building_id = $1
         AND sp.trade = 'general'
         AND sp.status = 'active'
       ORDER BY bsp.priority ASC`,
      [incident.building_id]
    );

    if (generalSpsResult.rows.length === 0) {
      logger.warn('No SPs available for building', { incidentId, buildingId: incident.building_id });
      await markNoSpAvailable(incident);
      await escalateToFM(incident);
      return { success: false, error: 'No service providers available' };
    }

    spsResult.rows = generalSpsResult.rows;
  }

  if (preferredSpId) {
    const idx = spsResult.rows.findIndex((sp) => sp.id === preferredSpId);
    if (idx > 0) {
      const [preferred] = spsResult.rows.splice(idx, 1);
      spsResult.rows.unshift(preferred);
    }
  }

  // Update incident status
  await db.query(
    `UPDATE incident SET status = 'sp_dispatched' WHERE id = $1`,
    [incidentId]
  );

  // Start dispatch loop
  await dispatchLoop(incident, spsResult.rows);

  return { success: true };
}

/**
 * Main dispatch loop - tries each SP in order
 */
async function dispatchLoop(incident, serviceProviders) {
  const telephony = getTelephonyProvider();

  for (let i = 0; i < serviceProviders.length; i++) {
    const sp = serviceProviders[i];
    const attemptNumber = i + 1;

    logger.info('Attempting SP dispatch', {
      incidentId: incident.id,
      spId: sp.id,
      attemptNumber,
      spName: sp.company_name,
    });

    // Create dispatch attempt record
    const attemptResult = await db.query(
      `INSERT INTO dispatch_attempt (incident_id, service_provider_id, attempt_number, method, response, timeout_at)
       VALUES ($1, $2, $3, 'call', 'pending', $4)
       RETURNING id`,
      [incident.id, sp.id, attemptNumber, new Date(Date.now() + CALL_TIMEOUT_MS)]
    );
    const attemptId = attemptResult.rows[0].id;

    // Add timeline entry
    await addTimelineEntry(incident.id, 'sp_call_initiated', {
      spId: sp.id,
      spName: sp.company_name,
      attemptNumber,
    });

    // Make call
    const callMessage = buildSpCallMessage(incident, sp);
    const webhookUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/webhooks/sp-call/${attemptId}`;

    const callResult = await telephony.makeCall(sp.phone, webhookUrl, {
      incidentId: incident.id,
      attemptId,
    });

    if (!callResult.success) {
      logger.warn('Call failed, trying SMS', { spId: sp.id, error: callResult.error });
      // Fall through to SMS
    } else {
      // Update attempt with provider ID
      await db.query(
        `UPDATE dispatch_attempt SET provider_message_id = $1 WHERE id = $2`,
        [callResult.callId, attemptId]
      );

      // Wait for call response (2 minutes)
      const callResponse = await waitForResponse(attemptId, CALL_TIMEOUT_MS);

      if (callResponse === 'accepted') {
        await handleSpAccepted(incident, sp, attemptId);
        return;
      }

      if (callResponse === 'declined') {
        logger.info('SP declined', { spId: sp.id });
        await addTimelineEntry(incident.id, 'sp_declined', { spId: sp.id, spName: sp.company_name });
        continue; // Try next SP
      }
    }

    // No answer or call failed - send SMS
    logger.info('Sending SMS to SP', { spId: sp.id });

    const smsMessage = buildSpSmsMessage(incident, sp);

    // Create SMS attempt
    const smsAttemptResult = await db.query(
      `INSERT INTO dispatch_attempt (incident_id, service_provider_id, attempt_number, method, message_content, response, timeout_at)
       VALUES ($1, $2, $3, 'sms', $4, 'pending', $5)
       RETURNING id`,
      [incident.id, sp.id, attemptNumber, smsMessage, new Date(Date.now() + SMS_TIMEOUT_MS)]
    );
    const smsAttemptId = smsAttemptResult.rows[0].id;

    const smsResult = await telephony.sendSms(sp.phone, smsMessage);

    if (smsResult.success) {
      await db.query(
        `UPDATE dispatch_attempt SET provider_message_id = $1 WHERE id = $2`,
        [smsResult.messageId, smsAttemptId]
      );

      await addTimelineEntry(incident.id, 'sp_sms_sent', { spId: sp.id, spName: sp.company_name });

      // Wait for SMS response (10 minutes)
      const smsResponse = await waitForResponse(smsAttemptId, SMS_TIMEOUT_MS);

      if (smsResponse === 'accepted') {
        await handleSpAccepted(incident, sp, smsAttemptId);
        return;
      }

      await addTimelineEntry(incident.id, 'sp_no_response', { spId: sp.id, spName: sp.company_name });
    }

    // This SP didn't respond - continue to next
    logger.info('SP did not respond, trying next', { spId: sp.id, attemptNumber });
  }

  // All SPs tried, none available
  logger.warn('All SPs exhausted', { incidentId: incident.id });
  await markNoSpAvailable(incident);
  await escalateToFM(incident);
}

/**
 * Wait for SP response (polling the database)
 */
async function waitForResponse(attemptId, timeoutMs) {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < timeoutMs) {
    const result = await db.query(
      `SELECT response FROM dispatch_attempt WHERE id = $1`,
      [attemptId]
    );

    if (result.rows.length > 0 && result.rows[0].response !== 'pending') {
      return result.rows[0].response;
    }

    await sleep(pollInterval);
  }

  // Timeout - update to timeout status
  await db.query(
    `UPDATE dispatch_attempt SET response = 'timeout', response_at = NOW() WHERE id = $1`,
    [attemptId]
  );

  return 'timeout';
}

/**
 * Handle SP accepting the job
 */
async function handleSpAccepted(incident, sp, attemptId) {
  logger.info('SP accepted job', { incidentId: incident.id, spId: sp.id });

  await db.transaction(async (client) => {
    // Update incident
    await client.query(
      `UPDATE incident SET status = 'sp_accepted', assigned_sp_id = $1 WHERE id = $2`,
      [sp.id, incident.id]
    );

    // Update attempt
    await client.query(
      `UPDATE dispatch_attempt SET response = 'accepted', response_at = NOW() WHERE id = $1`,
      [attemptId]
    );

    // Create SP report record with one-time token
    const token = uuidv4();
    const deadline = new Date();
    deadline.setHours(9, 0, 0, 0); // 9 AM next day
    if (deadline <= new Date()) {
      deadline.setDate(deadline.getDate() + 1);
    }

    await client.query(
      `INSERT INTO sp_report (incident_id, service_provider_id, token, token_expires_at, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [incident.id, sp.id, token, deadline]
    );

    // Add timeline entry
    await client.query(
      `INSERT INTO incident_timeline (incident_id, event_type, event_data)
       VALUES ($1, 'sp_accepted', $2)`,
      [incident.id, JSON.stringify({ spId: sp.id, spName: sp.company_name })]
    );

    // Send report link to SP
    const reportLink = `${process.env.APP_URL || 'http://localhost:3000'}/report/${token}`;
    const emailProvider = await getEmailProvider();

    await emailProvider.sendSpReportLink(
      sp.email || '', // Fallback to SMS if no email
      sp.company_name,
      `${incident.issue_category} at ${incident.building_address || 'Unknown location'}`,
      reportLink,
      deadline.toISOString()
    );

    // Also send via SMS
    const telephony = getTelephonyProvider();
    await telephony.sendSms(
      sp.phone,
      `Job confirmed. Submit report by 9 AM: ${reportLink}\n\nNO REPORT = NO PAYMENT`
    );
  });
}

/**
 * Mark incident as no SP available
 */
async function markNoSpAvailable(incident) {
  await db.query(
    `UPDATE incident SET status = 'no_sp_available' WHERE id = $1`,
    [incident.id]
  );

  await addTimelineEntry(incident.id, 'no_sp_available', {});
}

/**
 * All SPs exhausted (or none configured) — ring the human back, don't just
 * text. Night Ops §4.4: "ball returns to decider (ring + SMS), never a dead
 * end." Prefers the actual decider who chose "send company" in the cockpit
 * (most recent cockpit_token for this incident) over the generic FM on-call
 * fallback number, since that's the specific person waiting to hear back.
 */
async function escalateToFM(incident) {
  const decider = await db.query(
    `SELECT phone, person_name FROM cockpit_token WHERE incident_id = $1 AND used_at IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [incident.id],
  );

  const recipient =
    decider.rows.length > 0
      ? { phone: decider.rows[0].phone, name: decider.rows[0].person_name }
      : incident.fm_oncall_phone
        ? { phone: incident.fm_oncall_phone, name: incident.fm_oncall_name }
        : null;

  if (!recipient) {
    logger.error('No decider or FM on-call phone available for all-SPs-failed notification', { incidentId: incident.id });
    return;
  }

  const body =
    `Kein Dienstleister verfügbar für: ${incident.issue_category || 'Vorfall'} bei ${incident.building_address || incident.building_name || 'unbekannt'}. ` +
    `Bitte manuell übernehmen. Vorfall ${incident.id}.`;

  await notifyHuman({
    recipient,
    purpose: 'fm_escalation',
    content: { title: 'Kein Dienstleister verfügbar', body },
    channels: ['voice_call', 'sms'],
    correlation: { incidentId: incident.id },
  });

  await db.query(
    `UPDATE incident SET status = 'escalated_to_fm' WHERE id = $1`,
    [incident.id]
  );

  await addTimelineEntry(incident.id, 'escalated_to_fm', {
    fmPhone: incident.fm_oncall_phone,
    fmName: incident.fm_oncall_name,
  });

  logger.info('Escalated to FM on-call', { incidentId: incident.id, fmPhone: incident.fm_oncall_phone });
}

/**
 * Build call message for SP
 */
function buildSpCallMessage(incident, sp) {
  return {
    language: 'en',
    actions: [
      {
        type: 'say',
        language: 'en',
        text: `Hello, this is an automated emergency dispatch call for ${sp.company_name}. ` +
              `There is a ${incident.issue_category?.replace('_', ' ') || 'service'} issue at ${incident.building_address || 'a building'}. ` +
              `Press 1 to accept this job. Press 2 to decline. Remember: no report means no payment.`,
      },
      {
        type: 'gather',
        numDigits: 1,
        timeout: 15,
        prompt: 'Press 1 to accept, press 2 to decline.',
      },
    ],
  };
}

/**
 * Build SMS message for SP
 */
function buildSpSmsMessage(incident, sp) {
  return `URGENT JOB REQUEST

${incident.issue_category?.replace('_', ' ').toUpperCase() || 'SERVICE'} at:
${incident.building_name || 'Building'}
${incident.building_address || ''}

Reply YES to accept.

NO REPORT = NO PAYMENT`;
}

/**
 * Add timeline entry
 */
async function addTimelineEntry(incidentId, eventType, eventData) {
  await db.query(
    `INSERT INTO incident_timeline (incident_id, event_type, event_data)
     VALUES ($1, $2, $3)`,
    [incidentId, eventType, JSON.stringify(eventData)]
  );
}

/**
 * Handle SP response (called from webhook)
 */
export async function handleSpResponse(attemptId, response, dtmfInput = null) {
  let finalResponse;

  if (dtmfInput) {
    finalResponse = dtmfInput === '1' ? 'accepted' : 'declined';
  } else if (response) {
    finalResponse = response.toLowerCase().includes('yes') ? 'accepted' : 'declined';
  } else {
    finalResponse = 'no_answer';
  }

  await db.query(
    `UPDATE dispatch_attempt SET response = $1, response_at = NOW(), dtmf_input = $2 WHERE id = $3`,
    [finalResponse, dtmfInput, attemptId]
  );

  logger.info('SP response recorded', { attemptId, response: finalResponse });

  return finalResponse;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default { startDispatch, handleSpResponse };
