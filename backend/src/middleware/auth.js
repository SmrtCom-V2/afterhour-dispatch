/**
 * Authentication Middleware
 * JWT-based auth for FM admin users
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);

    // Prevent a Super Admin token from being used as a tenant/admin token
    if (payload.role === 'super_admin') {
      return res.status(403).json({ error: 'Invalid token for this endpoint' });
    }

    // Verify user still exists
    const result = await db.query(
      `SELECT fa.id, fa.email, fa.name, fa.fm_company_id, fa.is_admin, fa.is_platform_admin, fa.disabled, fa.token_version, fc.name as company_name
       FROM fm_admin fa
       JOIN fm_company fc ON fa.fm_company_id = fc.id
       WHERE fa.id = $1`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Every password change bumps fm_admin.token_version (see auth.js
    // change-password route); a token signed with an older version was
    // issued before that change and must die immediately, not ride out
    // its remaining ~24h natural expiry (config.jwt.expiresIn).
    if (payload.tokenVersion !== result.rows[0].token_version) {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }

    // fm_admin.disabled is set both by super-admin "disable user" (saUsers.js)
    // and by GDPR deletion execution (gdprExecution.js anonymizeFmAdmin) —
    // previously neither actually revoked access: a JWT issued before
    // disabling stayed valid until its natural expiry (up to 24h,
    // config.jwt.expiresIn) because this middleware never re-checked the
    // flag per-request. Found while testing GDPR deletion end-to-end
    // (2026-07-29) — deletion anonymized the account but a pre-existing
    // token could still call authenticated endpoints afterward.
    if (result.rows[0].disabled) {
      return res.status(403).json({ error: 'This account has been disabled' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    logger.error('Auth error', { error: error.message });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    return res.status(403).json({ error: 'Invalid token' });
  }
}

export function generateToken(userId, email, options = {}) {
  // options: { role, tokenVersion }
  const payload = { userId, email };
  if (options.role) payload.role = options.role;
  if (options.tokenVersion !== undefined) payload.tokenVersion = options.tokenVersion;
  return jwt.sign(
    payload,
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

export default { authenticateToken, generateToken };
