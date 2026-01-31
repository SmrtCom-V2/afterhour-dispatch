/**
 * Settings Routes
 * FM Company settings and user profile management
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(authenticateToken);

// GET /api/settings/company - Get FM company settings
router.get('/company', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, phone_number, fm_oncall_phone, fm_oncall_name,
              ai_confidence_threshold, status, owner_email,
              trial_start_at, trial_end_at, paid_start_at, current_period_end_at,
              created_at
       FROM fm_company
       WHERE id = $1`,
      [req.user.fm_company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ company: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching company settings', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch company settings' });
  }
});

// PUT /api/settings/company - Update FM company settings
router.put('/company', async (req, res) => {
  try {
    const {
      name,
      phoneNumber,
      fmOncallPhone,
      fmOncallName,
      aiConfidenceThreshold,
      ownerEmail
    } = req.body;

    const result = await db.query(
      `UPDATE fm_company SET
         name = COALESCE($1, name),
         phone_number = COALESCE($2, phone_number),
         fm_oncall_phone = COALESCE($3, fm_oncall_phone),
         fm_oncall_name = COALESCE($4, fm_oncall_name),
         ai_confidence_threshold = COALESCE($5, ai_confidence_threshold),
         owner_email = COALESCE($6, owner_email)
       WHERE id = $7
       RETURNING *`,
      [
        name,
        phoneNumber,
        fmOncallPhone,
        fmOncallName,
        aiConfidenceThreshold,
        ownerEmail,
        req.user.fm_company_id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    logger.info('Company settings updated', { companyId: req.user.fm_company_id });

    res.json({ company: result.rows[0] });
  } catch (error) {
    logger.error('Error updating company settings', { error: error.message });
    res.status(500).json({ error: 'Failed to update company settings' });
  }
});

// GET /api/settings/profile - Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, name, is_admin, is_platform_admin, created_at
       FROM fm_admin
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ profile: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching profile', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/settings/profile - Update current user profile
router.put('/profile', async (req, res) => {
  try {
    const { name, email } = req.body;

    // Check if email is already taken by another user
    if (email) {
      const emailCheck = await db.query(
        'SELECT id FROM fm_admin WHERE email = $1 AND id != $2',
        [email.toLowerCase(), req.user.id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email is already in use' });
      }
    }

    const result = await db.query(
      `UPDATE fm_admin SET
         name = COALESCE($1, name),
         email = COALESCE($2, email)
       WHERE id = $3
       RETURNING id, email, name, is_admin, is_platform_admin`,
      [name, email?.toLowerCase(), req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('Profile updated', { userId: req.user.id });

    res.json({ profile: result.rows[0] });
  } catch (error) {
    logger.error('Error updating profile', { error: error.message });
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /api/settings/password - Change password
router.put('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Verify current password
    const userResult = await db.query(
      'SELECT password_hash FROM fm_admin WHERE id = $1',
      [req.user.id]
    );

    const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and save new password
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE fm_admin SET password_hash = $1 WHERE id = $2',
      [newHash, req.user.id]
    );

    logger.info('Password changed', { userId: req.user.id });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Error changing password', { error: error.message });
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// GET /api/settings/users - Get all FM admins (for admin only)
router.get('/users', async (req, res) => {
  try {
    // Only admin can view users
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await db.query(
      `SELECT id, email, name, is_admin, created_at
       FROM fm_admin
       WHERE fm_company_id = $1
       ORDER BY created_at`,
      [req.user.fm_company_id]
    );

    res.json({ users: result.rows });
  } catch (error) {
    logger.error('Error fetching users', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/settings/users - Create new FM admin user (for admin only)
router.post('/users', async (req, res) => {
  try {
    // Only admin can create users
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { email, name, password, isAdmin } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if email is already taken
    const emailCheck = await db.query(
      'SELECT id FROM fm_admin WHERE email = $1',
      [email.toLowerCase()]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email is already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO fm_admin (fm_company_id, email, name, password_hash, is_admin)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, is_admin, created_at`,
      [req.user.fm_company_id, email.toLowerCase(), name, passwordHash, isAdmin || false]
    );

    logger.info('New admin user created', { userId: result.rows[0].id, email });

    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    logger.error('Error creating user', { error: error.message });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/settings/users/:id - Update FM admin user (for admin only)
router.put('/users/:id', async (req, res) => {
  try {
    // Only admin can update users
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { email, name, password, isAdmin } = req.body;

    // Verify user belongs to same company
    const userCheck = await db.query(
      'SELECT id FROM fm_admin WHERE id = $1 AND fm_company_id = $2',
      [id, req.user.fm_company_id]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is already taken by another user
    if (email) {
      const emailCheck = await db.query(
        'SELECT id FROM fm_admin WHERE email = $1 AND id != $2',
        [email.toLowerCase(), id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email is already in use' });
      }
    }

    // Build update query dynamically
    let updateFields = [];
    let updateValues = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(name);
      paramIndex++;
    }
    if (email !== undefined) {
      updateFields.push(`email = $${paramIndex}`);
      updateValues.push(email.toLowerCase());
      paramIndex++;
    }
    if (isAdmin !== undefined) {
      updateFields.push(`is_admin = $${paramIndex}`);
      updateValues.push(isAdmin);
      paramIndex++;
    }
    if (password && password.length >= 8) {
      const passwordHash = await bcrypt.hash(password, 10);
      updateFields.push(`password_hash = $${paramIndex}`);
      updateValues.push(passwordHash);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(id);
    const result = await db.query(
      `UPDATE fm_admin SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, email, name, is_admin, created_at`,
      updateValues
    );

    logger.info('Admin user updated', { updatedUserId: id, byUserId: req.user.id });

    res.json({ user: result.rows[0] });
  } catch (error) {
    logger.error('Error updating user', { error: error.message });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/settings/users/:id - Delete FM admin user (for admin only)
router.delete('/users/:id', async (req, res) => {
  try {
    // Only admin can delete users
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    // Can't delete yourself
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await db.query(
      `DELETE FROM fm_admin
       WHERE id = $1 AND fm_company_id = $2
       RETURNING id`,
      [id, req.user.fm_company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('Admin user deleted', { deletedUserId: id, byUserId: req.user.id });

    res.json({ message: 'User deleted' });
  } catch (error) {
    logger.error('Error deleting user', { error: error.message });
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
