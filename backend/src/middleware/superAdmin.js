/**
 * Super Admin authentication middleware
 * Enforces is_super_admin + allowlist
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

async function getAllowlist() {
  const raw = process.env.SUPER_ADMIN_EMAILS || '';
  const envList = raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  try {
    const result = await db.query(`SELECT email FROM super_admin_allowlist`);
    const dbList = result.rows.map((r) => r.email.toLowerCase());
    return Array.from(new Set([...envList, ...dbList]));
  } catch (err) {
    // If table missing or error, fall back to env list
    return envList;
  }
}

async function isEmailAllowed(email) {
  const allowlist = await getAllowlist();
  if (allowlist.length === 0) return false;
  return allowlist.includes(email.toLowerCase());
}

export async function authenticateSuperAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);

    // Ensure this token is explicitly a super admin token
    if (payload.role !== 'super_admin') {
      return res.status(403).json({ error: 'Invalid token for super admin endpoint' });
    }

    const result = await db.query(
      `SELECT id, email, name, is_super_admin
       FROM fm_admin
       WHERE id = $1`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.is_super_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const allowed = await isEmailAllowed(user.email);
    if (!allowed) {
      return res.status(403).json({ error: 'Not in allowlist' });
    }

    // Capture optional impersonation header (set by Super Admin UI when acting as a user)
    req.impersonatedAdminId = req.headers['x-impersonated-admin-id'] || null;

    req.superAdmin = user;
    next();
  } catch (error) {
    logger.error('Super admin auth error', { error: error.message });
    return res.status(403).json({ error: 'Invalid token' });
  }
}

export async function assertSuperAdminAllowlist(email) {
  return await isEmailAllowed(email);
}

export default { authenticateSuperAdmin, assertSuperAdminAllowlist };
