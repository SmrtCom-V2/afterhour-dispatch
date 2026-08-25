/**
 * Authentication Routes
 * Login for FM admin users
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db/index.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Sprint 3 retrofit: best-effort lookup against the shared identity-service
// (SmrtCom-V2 monorepo, packages/identity-service). Never throws — an
// identity-service outage or unset IDENTITY_SERVICE_URL must not block a
// login that worked perfectly well before this service existed. Uses native
// fetch (no new dependency) with a short timeout via AbortSignal.
export async function fetchEntitlements(fmCompanyId) {
  const identityServiceUrl = process.env.IDENTITY_SERVICE_URL;
  if (!identityServiceUrl || !fmCompanyId) return [];

  try {
    const response = await fetch(
      `${identityServiceUrl}/v1/entitlements/by-afterhour-company/${fmCompanyId}`,
      { signal: AbortSignal.timeout(2000) },
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data?.products ?? [];
  } catch (error) {
    logger.warn('Entitlements lookup failed', { fmCompanyId, error: error.message });
    return [];
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const result = await db.query(
      `SELECT fa.id, fa.email, fa.password_hash, fa.name, fa.fm_company_id, fa.is_admin, fa.is_platform_admin, fa.token_version, fc.name as company_name
       FROM fm_admin fa
       JOIN fm_company fc ON fa.fm_company_id = fc.id
       WHERE fa.email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id, user.email, { tokenVersion: user.token_version });

    logger.info('User logged in', { userId: user.id, email: user.email });

    const entitlements = await fetchEntitlements(user.fm_company_id);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: user.fm_company_id,
        companyName: user.company_name,
        is_admin: user.is_admin,
        is_platform_admin: user.is_platform_admin,
      },
      entitlements,
    });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, async (req, res) => {
  // Sprint 4: without this, entitlements (and the cross-product nav they
  // drive) would silently vanish on every page refresh — /login is not the
  // only place a session starts from the frontend's point of view.
  const entitlements = await fetchEntitlements(req.user.fm_company_id);

  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      companyId: req.user.fm_company_id,
      companyName: req.user.company_name,
      is_admin: req.user.is_admin,
      is_platform_admin: req.user.is_platform_admin,
    },
    entitlements,
  });
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Get current password hash
    const result = await db.query(
      'SELECT password_hash FROM fm_admin WHERE id = $1',
      [req.user.id]
    );

    const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);

    // Bumping token_version invalidates every other session (stolen device,
    // old browser tab, etc.) immediately — they fail authenticateToken's
    // version check on their next request instead of riding out the JWT's
    // remaining ~24h natural expiry.
    const updateResult = await db.query(
      `UPDATE fm_admin SET password_hash = $1, token_version = token_version + 1
       WHERE id = $2 RETURNING token_version`,
      [newHash, req.user.id]
    );

    logger.info('Password changed', { userId: req.user.id });

    const token = generateToken(req.user.id, req.user.email, {
      tokenVersion: updateResult.rows[0].token_version
    });

    res.json({ message: 'Password changed successfully', token });
  } catch (error) {
    logger.error('Password change error', { error: error.message });
    res.status(500).json({ error: 'Password change failed' });
  }
});

export default router;
