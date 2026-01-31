/**
 * FM Employees Routes
 */
import express from 'express';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all employees for the FM company
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM fm_employee
       WHERE fm_company_id = $1
       ORDER BY name`,
      [req.user.fm_company_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get single employee
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM fm_employee
       WHERE id = $1 AND fm_company_id = $2`,
      [req.params.id, req.user.fm_company_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Create employee
router.post('/', authenticateToken, async (req, res) => {
  const { name, email, phone, role, is_active, can_be_oncall, notes } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO fm_employee (fm_company_id, name, email, phone, role, is_active, can_be_oncall, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.user.fm_company_id, name, email, phone, role || 'staff', is_active !== false, can_be_oncall !== false, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Update employee
router.put('/:id', authenticateToken, async (req, res) => {
  const { name, email, phone, role, is_active, can_be_oncall, notes } = req.body;

  try {
    const result = await db.query(
      `UPDATE fm_employee
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           role = COALESCE($4, role),
           is_active = COALESCE($5, is_active),
           can_be_oncall = COALESCE($6, can_be_oncall),
           notes = COALESCE($7, notes)
       WHERE id = $8 AND fm_company_id = $9
       RETURNING *`,
      [name, email, phone, role, is_active, can_be_oncall, notes, req.params.id, req.user.fm_company_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// Delete employee
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `DELETE FROM fm_employee
       WHERE id = $1 AND fm_company_id = $2
       RETURNING id`,
      [req.params.id, req.user.fm_company_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

export default router;
