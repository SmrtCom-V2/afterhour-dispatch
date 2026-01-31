/**
 * Email Verification Routes
 * Handle email verification for new accounts
 */

import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { sendEmail } from '../utils/email.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Token expiry time (24 hours)
const TOKEN_EXPIRY_HOURS = 24;

/**
 * Ensure verification table exists
 */
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES fm_admin(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      verified_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Add email_verified column to fm_admin if it doesn't exist
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='fm_admin' AND column_name='email_verified'
      ) THEN
        ALTER TABLE fm_admin ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
      END IF;
    END $$;
  `);
}

/**
 * POST /api/email-verification/send
 * Send verification email to current user
 */
router.post('/send', authenticateToken, async (req, res) => {
  try {
    await ensureTable();

    const user = req.user;

    // Check if already verified
    const userResult = await db.query(
      'SELECT email_verified FROM fm_admin WHERE id = $1',
      [user.id]
    );

    if (userResult.rows[0]?.email_verified) {
      return res.json({ message: 'Email already verified' });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Delete any existing tokens for this user
    await db.query(
      'DELETE FROM email_verification_tokens WHERE user_id = $1',
      [user.id]
    );

    // Insert new token
    await db.query(
      `INSERT INTO email_verification_tokens (user_id, email, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, user.email, tokenHash, expiresAt]
    );

    // Build verification URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
    const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    // Send email
    await sendEmail({
      to: user.email,
      subject: 'Verify Your Email - 24-7 Dispatch',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3B82F6, #6366F1); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">24-7 Dispatch</h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: #1e293b; margin-top: 0;">Verify Your Email Address</h2>
            <p style="color: #475569; line-height: 1.6;">
              Hi ${user.name || 'there'},
            </p>
            <p style="color: #475569; line-height: 1.6;">
              Please verify your email address to complete your account setup and access all features.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}" style="
                display: inline-block;
                background: #3B82F6;
                color: white;
                padding: 14px 32px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
              ">Verify Email</a>
            </div>
            <p style="color: #475569; line-height: 1.6;">
              This link will expire in ${TOKEN_EXPIRY_HOURS} hours.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${verifyUrl}" style="color: #3B82F6; word-break: break-all;">${verifyUrl}</a>
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} 24-7 Dispatch. All rights reserved.
            </p>
          </div>
        </div>
      `
    });

    logger.info('Verification email sent', { userId: user.id, email: user.email });

    res.json({ message: 'Verification email sent' });

  } catch (error) {
    logger.error('Send verification error', { error: error.message });
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

/**
 * POST /api/email-verification/verify
 * Verify email with token
 */
router.post('/verify', async (req, res) => {
  try {
    await ensureTable();

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find token
    const tokenResult = await db.query(
      `SELECT evt.id, evt.user_id, evt.email, evt.expires_at, evt.verified_at
       FROM email_verification_tokens evt
       WHERE evt.token_hash = $1`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid verification link' });
    }

    const tokenData = tokenResult.rows[0];

    if (tokenData.verified_at) {
      return res.json({ message: 'Email already verified' });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification link has expired' });
    }

    // Update user email_verified status
    await db.query(
      'UPDATE fm_admin SET email_verified = TRUE, updated_at = NOW() WHERE id = $1',
      [tokenData.user_id]
    );

    // Mark token as used
    await db.query(
      'UPDATE email_verification_tokens SET verified_at = NOW() WHERE id = $1',
      [tokenData.id]
    );

    logger.info('Email verified', { userId: tokenData.user_id, email: tokenData.email });

    res.json({ message: 'Email verified successfully' });

  } catch (error) {
    logger.error('Verification error', { error: error.message });
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * GET /api/email-verification/status
 * Check verification status for current user
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    await ensureTable();

    const result = await db.query(
      'SELECT email_verified FROM fm_admin WHERE id = $1',
      [req.user.id]
    );

    res.json({
      verified: result.rows[0]?.email_verified || false
    });

  } catch (error) {
    logger.error('Status check error', { error: error.message });
    res.status(500).json({ error: 'Failed to check status' });
  }
});

export default router;
