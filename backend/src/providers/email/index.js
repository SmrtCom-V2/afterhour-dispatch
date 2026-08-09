/**
 * Email Provider
 * For sending morning reports via email
 */

import nodemailer from 'nodemailer';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

class EmailProvider {
  constructor() {
    this.transporter = null;
  }

  async init() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });

    // Verify connection
    try {
      await this.transporter.verify();
      logger.info('Email transporter ready');
    } catch (error) {
      logger.error('Email transporter verification failed', { error: error.message });
    }
  }

  async sendEmail({ to, subject, text, html, attachments = [] }) {
    if (!this.transporter) {
      await this.init();
    }

    try {
      const result = await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        text,
        html,
        attachments,
      });

      logger.info('Email sent', { to, subject, messageId: result.messageId });
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Email send failed', { error: error.message, to, subject });
      // Throw rather than returning { success: false }. Returning made every
      // caller's try/catch dead code: a hard SMTP rejection (e.g. a 550 from
      // the mail provider) flowed on to "mark as sent" DB writes and success
      // logs, so undelivered morning reports were recorded as delivered
      // (observed live 2026-08-09). Callers that must not abort on a failed
      // email — e.g. dispatch.js, where SMS is the fallback — catch this
      // explicitly at the call site.
      const err = new Error(error.message);
      err.cause = error;
      err.emailDeliveryFailed = true;
      throw err;
    }
  }

  async sendMorningReport(to, pmName, reportDate, pdfBuffer) {
    return this.sendEmail({
      to,
      subject: `After-Hours Report - ${pmName} - ${reportDate}`,
      text: `Please find attached the after-hours incident report for ${reportDate}.`,
      html: `
        <h2>After-Hours Incident Report</h2>
        <p><strong>Property Manager:</strong> ${pmName}</p>
        <p><strong>Report Date:</strong> ${reportDate}</p>
        <p>Please find the detailed report attached.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated report from the FM After-Hours System.</p>
      `,
      attachments: [
        {
          filename: `afterhours-report-${reportDate}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  async sendSpReportLink(to, spName, incidentSummary, reportLink, deadline) {
    return this.sendEmail({
      to,
      subject: 'Action Required: Submit Service Report',
      text: `
Hello ${spName},

You have completed a service call. Please submit your report using the link below.

Incident: ${incidentSummary}
Deadline: ${deadline}
Report Link: ${reportLink}

IMPORTANT: NO REPORT = NO PAYMENT

Thank you.
      `.trim(),
      html: `
        <h2>Service Report Required</h2>
        <p>Hello ${spName},</p>
        <p>You have completed a service call. Please submit your report.</p>
        <table style="margin: 20px 0;">
          <tr><td><strong>Incident:</strong></td><td>${incidentSummary}</td></tr>
          <tr><td><strong>Deadline:</strong></td><td>${deadline}</td></tr>
        </table>
        <p>
          <a href="${reportLink}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Submit Report
          </a>
        </p>
        <p style="color: #c00; font-weight: bold; margin-top: 20px;">
          IMPORTANT: NO REPORT = NO PAYMENT
        </p>
      `,
    });
  }

  async sendSpReportReminder(to, spName, reportLink, deadline) {
    return this.sendEmail({
      to,
      subject: 'REMINDER: Service Report Due Soon',
      text: `
Hello ${spName},

This is a reminder that your service report is due by ${deadline}.

Report Link: ${reportLink}

NO REPORT = NO PAYMENT
      `.trim(),
      html: `
        <h2 style="color: #c00;">Reminder: Report Due Soon</h2>
        <p>Hello ${spName},</p>
        <p>Your service report is due by <strong>${deadline}</strong>.</p>
        <p>
          <a href="${reportLink}" style="background: #c00; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Submit Report Now
          </a>
        </p>
        <p style="color: #c00; font-weight: bold;">NO REPORT = NO PAYMENT</p>
      `,
    });
  }
}

// Mock Email Provider for development
class MockEmailProvider {
  async init() {}

  async sendEmail({ to, subject, text, html, attachments }) {
    logger.info('[MOCK] Email sent', { to, subject, hasAttachments: attachments.length > 0 });
    return { success: true, messageId: `mock_${Date.now()}` };
  }

  async sendMorningReport(to, pmName, reportDate, pdfBuffer) {
    logger.info('[MOCK] Morning report sent', { to, pmName, reportDate });
    return { success: true, messageId: `mock_report_${Date.now()}` };
  }

  async sendSpReportLink(to, spName, incidentSummary, reportLink, deadline) {
    logger.info('[MOCK] SP report link sent', { to, spName, reportLink });
    return { success: true, messageId: `mock_sp_${Date.now()}` };
  }

  async sendSpReportReminder(to, spName, reportLink, deadline) {
    logger.info('[MOCK] SP report reminder sent', { to, spName });
    return { success: true, messageId: `mock_reminder_${Date.now()}` };
  }
}

// Factory function
export function createEmailProvider() {
  if (config.nodeEnv === 'production' && config.email.host) {
    return new EmailProvider();
  }
  return new MockEmailProvider();
}

// Singleton
let emailProvider = null;

export async function getEmailProvider() {
  if (!emailProvider) {
    emailProvider = createEmailProvider();
    await emailProvider.init();
  }
  return emailProvider;
}

export default getEmailProvider;
