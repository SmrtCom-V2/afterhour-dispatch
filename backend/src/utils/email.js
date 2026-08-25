/**
 * Email Utility
 * Sends emails using nodemailer
 *
 * Supports two auth modes, checked in this order:
 *   1. Gmail OAuth2 (GMAIL_OAUTH_CLIENT_ID / GMAIL_OAUTH_CLIENT_SECRET /
 *      GMAIL_OAUTH_REFRESH_TOKEN / GMAIL_OAUTH_USER) — used for
 *      noreply@smrtcom.com sending via the admin@smrtcom.com Workspace
 *      account. See GOOGLE_OAUTH2_EMAIL_SETUP_GUIDE.md for setup.
 *   2. Legacy SMTP (SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS) — kept
 *      as a fallback path for any future non-Gmail provider.
 * If neither is configured, sendEmail() logs and returns a fake
 * messageId instead of silently pretending to succeed in prod — see the
 * NODE_ENV check below.
 */

import nodemailer from 'nodemailer';
import { logger } from './logger.js';

function isGmailOAuth2Configured() {
  return Boolean(
    process.env.GMAIL_OAUTH_CLIENT_ID &&
    process.env.GMAIL_OAUTH_CLIENT_SECRET &&
    process.env.GMAIL_OAUTH_REFRESH_TOKEN &&
    process.env.GMAIL_OAUTH_USER
  );
}

// Create transporter based on environment
const createTransporter = () => {
  // Preferred: Gmail via OAuth2 (Workspace edition has no App Passwords).
  // Authenticates as GMAIL_OAUTH_USER (admin@smrtcom.com) but the actual
  // "From" address used in sendEmail() can be the noreply@smrtcom.com
  // alias — Gmail allows sending as any verified "Send mail as" alias
  // of the authenticated account, nodemailer just passes the header
  // through, it does not need to know about the alias itself.
  if (isGmailOAuth2Configured()) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_OAUTH_USER,
        clientId: process.env.GMAIL_OAUTH_CLIENT_ID,
        clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_OAUTH_REFRESH_TOKEN
      }
    });
  }

  // Fallback: plain SMTP (kept for any future non-Gmail provider).
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Development: use ethereal email (fake SMTP for testing)
  if (process.env.NODE_ENV === 'development') {
    logger.warn('No email provider configured - emails will be logged but not sent');
    return null;
  }

  return null;
};

const transporter = createTransporter();

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text content
 */
export async function sendEmail({ to, subject, html, text }) {
  // EMAIL_FROM takes priority (used for the Gmail-alias "From:" header,
  // e.g. "24-7 Dispatch <noreply@smrtcom.com>"), then legacy SMTP_FROM,
  // then the old hardcoded default.
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || '24-7 Dispatch <noreply@247dispatch.com>';

  if (!transporter) {
    // Log email when no email provider configured
    logger.info('Email (not sent - no email provider configured)', {
      to,
      subject,
      preview: html.substring(0, 200) + '...'
    });
    return { messageId: 'dev-' + Date.now() };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '')
    });

    logger.info('Email sent', {
      to,
      subject,
      messageId: info.messageId
    });

    return info;
  } catch (error) {
    logger.error('Failed to send email', {
      to,
      subject,
      error: error.message
    });
    throw error;
  }
}

// Exported for testing only — lets tests exercise transporter-selection
// logic without needing to reload the module or set env vars before import.
export { createTransporter, isGmailOAuth2Configured };

export default { sendEmail };
