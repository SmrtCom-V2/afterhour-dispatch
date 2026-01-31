/**
 * Super Admin Authentication Routes
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db/index.js';
import { generateToken } from '../middleware/auth.js';
import { assertSuperAdminAllowlist, authenticateSuperAdmin } from '../middleware/superAdmin.js';
import { logger } from '../utils/logger.js';

const router = Router();

// POST /sa/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const normalizedEmail = email.toLowerCase();

    const result = await db.query(
      `SELECT T1.id, T1.email, T1.password_hash, T1.name, T1.is_super_admin
       FROM fm_admin T1
       INNER JOIN super_admin_allowlist T2 ON T1.email = T2.email
       WHERE T1.email = $1`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_super_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Issue a token scoped to super admin so it cannot be used for tenant/admin endpoints
    const token = generateToken(user.id, user.email, { role: 'super_admin' });

    logger.info('Super admin logged in', { userId: user.id, email: user.email });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        is_super_admin: true,
      },
    });
  } catch (error) {
    logger.error('Super admin login error', { error: error.message });
    return res.status(500).json({ error: 'Login failed' });
  }
});

// GET /sa/auth/me
router.get('/me', authenticateSuperAdmin, async (req, res) => {
  return res.json({
    user: {
      id: req.superAdmin.id,
      email: req.superAdmin.email,
      name: req.superAdmin.name,
      is_super_admin: true,
    },
  });
});

// POST /sa/auth/logout
router.post('/logout', (req, res) => {
  return res.json({ message: 'Logged out' });
});

export default router;
