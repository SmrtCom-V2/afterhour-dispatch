/**
 * Signup Email Verification Routes
 * Verify email BEFORE account creation using 6-digit codes
 */

import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { sendEmail } from '../utils/email.js';

const router = Router();

// Code expiry time (10 minutes)
const CODE_EXPIRY_MINUTES = 10;

/**
 * Generate 6-digit verification code
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Ensure verification table exists
 */
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS signup_verification_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL,
      code VARCHAR(6) NOT NULL,
      pending_data JSONB,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      verified_at TIMESTAMP WITH TIME ZONE,
      attempts INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Create index for quick lookup
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_signup_verification_email
    ON signup_verification_codes(email)
  `);
}

/**
 * POST /api/signup-verification/send
 * Send verification code to email (pre-signup)
 * Body: { email, companyName, phone }
 */
router.post('/send', async (req, res) => {
  try {
    await ensureTable();

    const { email, companyName, phone } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if email already registered
    const existingUser = await db.query(
      'SELECT id FROM fm_admin WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Check rate limiting (max 3 codes per email per hour)
    const recentCodes = await db.query(
      `SELECT COUNT(*) FROM signup_verification_codes
       WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [email]
    );

    if (parseInt(recentCodes.rows[0].count) >= 5) {
      return res.status(429).json({ error: 'Too many verification attempts. Please try again later.' });
    }

    // Generate verification code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    // Delete any existing codes for this email
    await db.query(
      'DELETE FROM signup_verification_codes WHERE email = $1 AND verified_at IS NULL',
      [email]
    );

    // Store pending signup data along with code
    const pendingData = { companyName, phone, email };

    // Insert new code
    await db.query(
      `INSERT INTO signup_verification_codes (email, code, pending_data, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [email, code, JSON.stringify(pendingData), expiresAt]
    );

    // Send email with code
    await sendEmail({
      to: email,
      subject: 'Your Verification Code - 24-7 Dispatch',
      text: `Your verification code is: ${code}\n\nThis code will expire in ${CODE_EXPIRY_MINUTES} minutes.\n\nIf you didn't request this code, you can safely ignore this email.\n\n- 24-7 Dispatch`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
<tr><td style="background: linear-gradient(135deg, #3B82F6, #6366F1); padding: 30px; text-align: center;">
<h1 style="color: white; margin: 0; font-size: 28px;">24-7 Dispatch</h1>
</td></tr>
<tr><td style="padding: 30px; background: #ffffff;">
<h2 style="color: #1e293b; margin-top: 0;">Verify Your Email</h2>
<p style="color: #475569; line-height: 1.6;">Hi there,</p>
<p style="color: #475569; line-height: 1.6;">Use the following code to verify your email address and continue with your registration:</p>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 30px 0;">
<span style="display: inline-block; background: #f1f5f9; padding: 20px 40px; border-radius: 12px; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1e293b; font-family: monospace;">${code}</span>
</td></tr></table>
<p style="color: #475569; line-height: 1.6;">This code will expire in ${CODE_EXPIRY_MINUTES} minutes.</p>
<p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">If you didn't request this code, you can safely ignore this email.</p>
</td></tr>
<tr><td style="background: #f8fafc; padding: 20px; text-align: center;">
<p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} 24-7 Dispatch. All rights reserved.</p>
</td></tr>
</table>
</body>
</html>`
    });

    logger.info('Signup verification code sent', { email });

    res.json({
      message: 'Verification code sent',
      expiresIn: CODE_EXPIRY_MINUTES * 60 // seconds
    });

  } catch (error) {
    logger.error('Send verification code error', { error: error.message });
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

/**
 * POST /api/signup-verification/verify
 * Verify the code
 * Body: { email, code }
 */
router.post('/verify', async (req, res) => {
  try {
    await ensureTable();

    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    // Find the code
    const codeResult = await db.query(
      `SELECT id, code, pending_data, expires_at, verified_at, attempts
       FROM signup_verification_codes
       WHERE email = $1 AND verified_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
    }

    const codeData = codeResult.rows[0];

    // Check if expired
    if (new Date(codeData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Check attempts (max 5)
    if (codeData.attempts >= 5) {
      return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' });
    }

    // Check code
    if (codeData.code !== code) {
      // Increment attempts
      await db.query(
        'UPDATE signup_verification_codes SET attempts = attempts + 1 WHERE id = $1',
        [codeData.id]
      );
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Mark as verified
    await db.query(
      'UPDATE signup_verification_codes SET verified_at = NOW() WHERE id = $1',
      [codeData.id]
    );

    logger.info('Signup verification code verified', { email });

    res.json({
      message: 'Email verified',
      verified: true,
      pendingData: codeData.pending_data
    });

  } catch (error) {
    logger.error('Verify code error', { error: error.message });
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * POST /api/signup-verification/resend
 * Resend verification code
 * Body: { email }
 */
router.post('/resend', async (req, res) => {
  try {
    await ensureTable();

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Get pending data from previous attempt
    const previousCode = await db.query(
      `SELECT pending_data FROM signup_verification_codes
       WHERE email = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    const pendingData = previousCode.rows[0]?.pending_data || {};

    // Check rate limiting
    const recentCodes = await db.query(
      `SELECT COUNT(*) FROM signup_verification_codes
       WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [email]
    );

    if (parseInt(recentCodes.rows[0].count) >= 5) {
      return res.status(429).json({ error: 'Too many verification attempts. Please try again later.' });
    }

    // Generate new code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    // Delete old unverified codes
    await db.query(
      'DELETE FROM signup_verification_codes WHERE email = $1 AND verified_at IS NULL',
      [email]
    );

    // Insert new code
    await db.query(
      `INSERT INTO signup_verification_codes (email, code, pending_data, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [email, code, JSON.stringify(pendingData), expiresAt]
    );

    // Send email
    await sendEmail({
      to: email,
      subject: 'Your New Verification Code - 24-7 Dispatch',
      text: `Your new verification code is: ${code}\n\nThis code will expire in ${CODE_EXPIRY_MINUTES} minutes.\n\n- 24-7 Dispatch`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
<tr><td style="background: linear-gradient(135deg, #3B82F6, #6366F1); padding: 30px; text-align: center;">
<h1 style="color: white; margin: 0; font-size: 28px;">24-7 Dispatch</h1>
</td></tr>
<tr><td style="padding: 30px; background: #ffffff;">
<h2 style="color: #1e293b; margin-top: 0;">Your New Verification Code</h2>
<p style="color: #475569; line-height: 1.6;">Here's your new verification code:</p>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 30px 0;">
<span style="display: inline-block; background: #f1f5f9; padding: 20px 40px; border-radius: 12px; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1e293b; font-family: monospace;">${code}</span>
</td></tr></table>
<p style="color: #475569; line-height: 1.6;">This code will expire in ${CODE_EXPIRY_MINUTES} minutes.</p>
</td></tr>
<tr><td style="background: #f8fafc; padding: 20px; text-align: center;">
<p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} 24-7 Dispatch. All rights reserved.</p>
</td></tr>
</table>
</body>
</html>`
    });

    logger.info('Signup verification code resent', { email });

    res.json({
      message: 'New verification code sent',
      expiresIn: CODE_EXPIRY_MINUTES * 60
    });

  } catch (error) {
    logger.error('Resend code error', { error: error.message });
    res.status(500).json({ error: 'Failed to resend code' });
  }
});

export default router;
