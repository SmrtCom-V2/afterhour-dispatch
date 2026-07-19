/**
 * Background Jobs Scheduler
 * Handles:
 * - Morning report generation (7 AM)
 * - SP report deadline check (9 AM)
 * - SP report reminders (before deadline)
 */

import cron from 'node-cron';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { generateMorningReport, getPmCompaniesForReports } from '../services/morningReport.js';
import { getEmailProvider } from '../providers/email/index.js';
import { getTelephonyProvider } from '../providers/telephony/index.js';
import { config } from '../config/index.js';
import { processExpiringTrials, sendTrialReminders } from '../services/trialConversion.js';
import { startDispatch } from '../services/dispatch.js';
import { runWakeupTick } from '../services/wakeupEngine.js';
import { determineRequiredTrade } from '../services/tradeMapping.js';

/**
 * Initialize all scheduled jobs
 */
export function initializeScheduler() {
  logger.info('Initializing job scheduler');

  // Morning reports - 7 AM local time
  cron.schedule('0 7 * * *', async () => {
    logger.info('Running morning report job');
    await sendMorningReports();
  });

  // SP report deadline check - 9 AM local time
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running SP report deadline check');
    await checkMissingReports();
  });

  // SP report reminders - 6 AM local time (3 hours before deadline)
  cron.schedule('0 6 * * *', async () => {
    logger.info('Running SP report reminder job');
    await sendReportReminders();
  });

  // Dispatch timeout check - every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await checkDispatchTimeouts();
  });

  // External emergency pickup - every minute.
  // The SmrtCom Voice Gateway (separate NestJS process, shares this database)
  // marks incidents decision='emergency_dispatch' when a decision-card 🔴 is
  // pressed, the 15-min fail-safe fires, or the voice AI detects a confirmed
  // emergency — but it deliberately does NOT reimplement the SP dispatch loop.
  // Without this job those rows are written and never acted on: no SP call,
  // no SMS, silence. This job is the missing pickup.
  cron.schedule('* * * * *', async () => {
    await pickupExternalEmergencyDispatches();
  });

  // Night Ops wake-up engine - every minute.
  // Night Ops D1: the AI never dispatches — it creates incidents with
  // ai_urgency set and decision='pending'. This job rings/SMSes the on-call
  // human (T+0, re-ring T+2, backup T+5, fail-safe auto-dispatch T+10) until
  // a human decides in the Decision Cockpit. See NIGHT_OPS_MASTER_PLAN.md §4.2.
  // Node-cron's 1-minute floor means T+2/5/10 land within ~1 min of their
  // target, which is fine for human-response windows measured in minutes.
  cron.schedule('* * * * *', async () => {
    await runWakeupTick();
  });

  // Trial conversion - 12:01 AM daily (process expired trials)
  cron.schedule('1 0 * * *', async () => {
    logger.info('Running trial conversion job');
    await processExpiringTrials();
  });

  // Trial reminders - 10 AM daily (send 3-day and 1-day reminders)
  cron.schedule('0 10 * * *', async () => {
    logger.info('Running trial reminder job');
    await sendTrialReminders();
  });

  logger.info('Job scheduler initialized');
}

/**
 * Send morning reports to all PMs with incidents
 */
async function sendMorningReports() {
  try {
    const pmCompanies = await getPmCompaniesForReports();
    const emailProvider = await getEmailProvider();

    logger.info(`Sending morning reports to ${pmCompanies.length} PM companies`);

    for (const pm of pmCompanies) {
      try {
        const pdfBuffer = await generateMorningReport(pm.id);

        await emailProvider.sendMorningReport(
          pm.contact_email,
          pm.name,
          new Date().toISOString().split('T')[0],
          pdfBuffer
        );

        // Update report record
        await db.query(
          `UPDATE morning_report SET sent_at = NOW(), sent_to = $1
           WHERE pm_company_id = $2 AND report_date = $3`,
          [pm.contact_email, pm.id, new Date().toISOString().split('T')[0]]
        );

        logger.info('Morning report sent', { pmId: pm.id, email: pm.contact_email });
      } catch (error) {
        logger.error('Failed to send morning report', { pmId: pm.id, error: error.message });
      }
    }
  } catch (error) {
    logger.error('Morning report job failed', { error: error.message });
  }
}

/**
 * Check for missing SP reports and flag them
 */
async function checkMissingReports() {
  try {
    // Find all pending reports past deadline (9 AM today)
    const result = await db.query(
      `UPDATE sp_report
       SET status = 'missing'
       WHERE status = 'pending'
         AND token_expires_at < NOW()
       RETURNING id, incident_id, service_provider_id`
    );

    logger.info(`Flagged ${result.rows.length} missing SP reports`);

    // Add timeline entries and notify
    for (const report of result.rows) {
      await db.query(
        `INSERT INTO incident_timeline (incident_id, event_type, event_data)
         VALUES ($1, 'report_missing', $2)`,
        [report.incident_id, JSON.stringify({ reportId: report.id })]
      );

      // Update report status to flagged_unpaid
      await db.query(
        `UPDATE sp_report SET status = 'flagged_unpaid' WHERE id = $1`,
        [report.id]
      );
    }
  } catch (error) {
    logger.error('Missing report check failed', { error: error.message });
  }
}

/**
 * Send reminders for pending SP reports
 */
async function sendReportReminders() {
  try {
    // Find pending reports that haven't had a reminder sent
    const result = await db.query(
      `SELECT sr.*, sp.company_name, sp.email, sp.phone,
              i.issue_category, b.address as building_address
       FROM sp_report sr
       JOIN service_provider sp ON sr.service_provider_id = sp.id
       JOIN incident i ON sr.incident_id = i.id
       LEFT JOIN building b ON i.building_id = b.id
       WHERE sr.status = 'pending'
         AND sr.reminder_sent_at IS NULL
         AND sr.token_expires_at > NOW()`
    );

    const emailProvider = await getEmailProvider();
    const telephony = getTelephonyProvider();

    logger.info(`Sending reminders for ${result.rows.length} pending reports`);

    for (const report of result.rows) {
      const reportLink = `${process.env.APP_URL || 'http://localhost:3000'}/report/${report.token}`;
      const deadline = new Date(report.token_expires_at).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      });

      // Send email reminder
      if (report.email) {
        await emailProvider.sendSpReportReminder(
          report.email,
          report.company_name,
          reportLink,
          deadline
        );
      }

      // Send SMS reminder
      await telephony.sendSms(
        report.phone,
        `REMINDER: Your service report is due by ${deadline}.\n\n${reportLink}\n\nNO REPORT = NO PAYMENT`
      );

      // Mark reminder as sent
      await db.query(
        `UPDATE sp_report SET reminder_sent_at = NOW() WHERE id = $1`,
        [report.id]
      );

      logger.info('Report reminder sent', { reportId: report.id, spPhone: report.phone });
    }
  } catch (error) {
    logger.error('Report reminder job failed', { error: error.message });
  }
}

/**
 * Pick up emergency incidents that were marked for dispatch by an external
 * process (SmrtCom Voice Gateway) and run them through the existing SP
 * dispatch loop.
 *
 * Selection rules, and why each exists:
 * - decision='emergency_dispatch' + no dispatch_attempt rows: the incident
 *   was marked for dispatch but nobody ever started the SP loop.
 * - status IN ('open','escalated_to_fm'): 'open' = created directly by the
 *   Voice Gateway (call_id IS NULL); 'escalated_to_fm' = a phone-intake
 *   incident that went the "unclear" route and was later decided 🔴 via the
 *   decision card or its fail-safe.
 * - call_id IS NULL OR decision_at older than 90s: callFlow.js dispatches its
 *   own emergencies in-process — give it 90 seconds to create its first
 *   dispatch_attempt before treating the row as orphaned. (If the app crashed
 *   mid-dispatch, this job picks the incident up — a resilience win, not a
 *   duplicate: the NOT EXISTS check keeps us out of anything already started.)
 * - decision_at within the last 60 minutes: never surprise-dispatch stale
 *   rows from before this job existed; a dispatch an hour late is wrong anyway
 *   and needs a human, not an automatic SP call.
 */
const inFlightPickups = new Set();

async function pickupExternalEmergencyDispatches() {
  try {
    const result = await db.query(
      `SELECT i.id, i.issue_category
       FROM incident i
       WHERE i.decision = 'emergency_dispatch'
         AND i.status IN ('open', 'escalated_to_fm')
         AND i.decision_at > NOW() - INTERVAL '60 minutes'
         AND (i.call_id IS NULL OR i.decision_at < NOW() - INTERVAL '90 seconds')
         AND NOT EXISTS (SELECT 1 FROM dispatch_attempt da WHERE da.incident_id = i.id)`
    );

    for (const incident of result.rows) {
      if (inFlightPickups.has(incident.id)) continue;
      inFlightPickups.add(incident.id);

      // Same mapping as voiceai's determineRequiredTrade (kept in sync by hand;
      // it lives on a provider class we don't want to instantiate here).
      const tradeMapping = {
        water_leak: 'plumber',
        fire: 'general',
        smoke: 'general',
        gas_smell: 'general',
        total_power_outage: 'electrician',
        lockout: 'locksmith',
        other: 'general',
      };
      const requiredTrade = tradeMapping[incident.issue_category] || 'general';

      logger.info('Picking up external emergency incident for dispatch', {
        incidentId: incident.id,
        requiredTrade,
      });

      startDispatch(incident.id, requiredTrade)
        .catch((err) =>
          logger.error('External pickup dispatch failed', {
            incidentId: incident.id,
            error: err.message,
          })
        )
        .finally(() => inFlightPickups.delete(incident.id));
    }
  } catch (error) {
    logger.error('External emergency pickup job failed', { error: error.message });
  }
}

const inFlightResumes = new Set();

/**
 * Check for stale dispatch attempts and handle timeouts.
 *
 * Marking the row 'timeout' used to be the whole job — fine when the SP
 * loop was still alive in-process to notice and move to the next SP itself.
 * But if pm2 restarts mid-wait (deploy, crash, OOM), dispatchLoop's in-memory
 * for-loop is gone with it: the timed-out row just sits there forever with
 * nobody dialing the next SP or escalating. That's a real missed dispatch
 * with zero automatic recovery — this resumes it, using the same
 * startDispatch/escalateToFM path dispatchLoop itself would have taken.
 */
async function checkDispatchTimeouts() {
  try {
    // Find pending dispatch attempts that have timed out
    const result = await db.query(
      `UPDATE dispatch_attempt
       SET response = 'timeout', response_at = NOW()
       WHERE response = 'pending'
         AND timeout_at < NOW()
       RETURNING id, incident_id`
    );

    if (result.rows.length > 0) {
      logger.info(`Timed out ${result.rows.length} dispatch attempts`);
    }

    // One resume attempt per affected incident, not per timed-out row (an
    // incident can have both a timed-out call attempt and a timed-out SMS
    // attempt from the same SP in one tick).
    const incidentIds = [...new Set(result.rows.map((r) => r.incident_id))];
    for (const incidentId of incidentIds) {
      if (inFlightResumes.has(incidentId)) continue;
      resumeStaleDispatch(incidentId)
        .catch((err) => logger.error('Dispatch resume failed', { incidentId, error: err.message }))
        .finally(() => inFlightResumes.delete(incidentId));
      inFlightResumes.add(incidentId);
    }
  } catch (error) {
    logger.error('Dispatch timeout check failed', { error: error.message });
  }
}

/**
 * Picks a just-timed-out incident back up: if the incident is still
 * genuinely mid-dispatch (status='sp_dispatched', nobody accepted, no other
 * attempt still pending) start a fresh startDispatch excluding every SP
 * already tried. startDispatch itself calls escalateToFM if that leaves no
 * SPs — same terminal behavior dispatchLoop always had, just reachable
 * again after a restart instead of dead-ending.
 */
async function resumeStaleDispatch(incidentId) {
  const incidentResult = await db.query(
    `SELECT id, status, issue_category FROM incident WHERE id = $1`,
    [incidentId],
  );
  const incident = incidentResult.rows[0];
  if (!incident || incident.status !== 'sp_dispatched') return;

  const pendingResult = await db.query(
    `SELECT 1 FROM dispatch_attempt WHERE incident_id = $1 AND response = 'pending' LIMIT 1`,
    [incidentId],
  );
  if (pendingResult.rows.length > 0) return; // a live in-process loop is still waiting on this one

  // A live loop transitions pending->timeout itself and immediately inserts
  // its next attempt (milliseconds apart) — if the most recent attempt on
  // this incident was created in roughly the last cron interval, assume a
  // live process is mid-transition rather than actually gone, and let the
  // next tick re-check instead of risking a double-dispatch.
  const recentResult = await db.query(
    `SELECT 1 FROM dispatch_attempt WHERE incident_id = $1 AND started_at > NOW() - INTERVAL '90 seconds' LIMIT 1`,
    [incidentId],
  );
  if (recentResult.rows.length > 0) return;

  const triedResult = await db.query(
    `SELECT DISTINCT service_provider_id FROM dispatch_attempt WHERE incident_id = $1`,
    [incidentId],
  );
  const excludeSpIds = triedResult.rows.map((r) => r.service_provider_id);

  logger.warn('Resuming orphaned dispatch after restart/timeout', { incidentId, excludeSpIds });
  await startDispatch(incidentId, determineRequiredTrade(incident.issue_category), null, excludeSpIds);
}

export default { initializeScheduler };
