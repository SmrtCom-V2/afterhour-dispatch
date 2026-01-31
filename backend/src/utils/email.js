/**
 * Email Utility
 * Sends emails using nodemailer
 */

import nodemailer from 'nodemailer';
import { logger } from './logger.js';

// Create transporter based on environment
const createTransporter = () => {
  // Check if SMTP settings are configured
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
    logger.warn('No SMTP configured - emails will be logged but not sent');
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
  const from = process.env.SMTP_FROM || '24-7 Dispatch <noreply@247dispatch.com>';

  if (!transporter) {
    // Log email in development when no SMTP configured
    logger.info('Email (not sent - no SMTP configured)', {
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

export default { sendEmail };
