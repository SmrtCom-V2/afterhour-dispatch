/**
 * Password Reset Routes
 * Handle forgot password and reset password flows
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { sendEmail } from '../utils/email.js';

const router = Router();

// Token expiry time (1 hour)
const TOKEN_EXPIRY_HOURS = 1;

/**
 * POST /api/password-reset/request
 * Request a password reset email
 */
router.post('/request', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const userResult = await db.query(
      `SELECT fa.id, fa.email, fa.name, pc.name as company_name
       FROM fm_admin fa
       LEFT JOIN pm_company pc ON fa.fm_company_id = pc.id
       WHERE fa.email = $1`,
      [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (userResult.rows.length === 0) {
      logger.info('Password reset requested for non-existent email', { email });
      return res.json({
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    }

    const user = userResult.rows[0];

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store token in database (create table if needed, or use existing pattern)
    // First check if table exists, create it if not
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES fm_admin(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Delete any existing tokens for this user
    await db.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [user.id]
    );

    // Insert new token
    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    // Build reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset Your Password - 24-7 Dispatch',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #3B82F6, #6366F1); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">24-7 Dispatch</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="color: #1e293b; margin-top: 0;">Password Reset Request</h2>
              <p style="color: #475569; line-height: 1.6;">
                Hi ${user.name || 'there'},
              </p>
              <p style="color: #475569; line-height: 1.6;">
                We received a request to reset the password for your account at <strong>${user.company_name}</strong>.
              </p>
              <p style="color: #475569; line-height: 1.6;">
                Click the button below to set a new password:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="
                  display: inline-block;
                  background: #3B82F6;
                  color: white;
                  padding: 14px 32px;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                  font-size: 16px;
                ">Reset Password</a>
              </div>
              <p style="color: #475569; line-height: 1.6;">
                This link will expire in ${TOKEN_EXPIRY_HOURS} hour${TOKEN_EXPIRY_HOURS > 1 ? 's' : ''}.
              </p>
              <p style="color: #475569; line-height: 1.6;">
                If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
              <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #3B82F6; word-break: break-all;">${resetUrl}</a>
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

      logger.info('Password reset email sent', { userId: user.id, email: user.email });
    } catch (emailError) {
      logger.error('Failed to send password reset email', { error: emailError.message });
      // Still return success to prevent enumeration
    }

    res.json({
      message: 'If an account exists with this email, you will receive a password reset link.'
    });

  } catch (error) {
    logger.error('Password reset request error', { error: error.message });
    res.status(500).json({ error: 'Failed to process request' });
  }
});

/**
 * POST /api/password-reset/verify
 * Verify if a reset token is valid
 */
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await db.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, fa.email
       FROM password_reset_tokens prt
       JOIN fm_admin fa ON prt.user_id = fa.id
       WHERE prt.token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const tokenData = result.rows[0];

    if (tokenData.used_at) {
      return res.status(400).json({ error: 'This reset link has already been used' });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This reset link has expired' });
    }

    res.json({
      valid: true,
      email: tokenData.email
    });

  } catch (error) {
    logger.error('Token verification error', { error: error.message });
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * POST /api/password-reset/reset
 * Reset password with token
 */
router.post('/reset', async (req, res) => {
  const client = await db.getClient();

  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await client.query('BEGIN');

    // Find and validate token
    const tokenResult = await client.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at
       FROM password_reset_tokens prt
       WHERE prt.token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const tokenData = tokenResult.rows[0];

    if (tokenData.used_at) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This reset link has already been used' });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This reset link has expired' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user password
    await client.query(
      'UPDATE fm_admin SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, tokenData.user_id]
    );

    // Mark token as used
    await client.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [tokenData.id]
    );

    await client.query('COMMIT');

    logger.info('Password reset successful', { userId: tokenData.user_id });

    res.json({ message: 'Password has been reset successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Password reset error', { error: error.message });
    res.status(500).json({ error: 'Password reset failed' });
  } finally {
    client.release();
  }
});

export default router;
