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
 * Check for stale dispatch attempts and handle timeouts
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
  } catch (error) {
    logger.error('Dispatch timeout check failed', { error: error.message });
  }
}

export default { initializeScheduler };
