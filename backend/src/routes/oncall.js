/**
 * On-Call Schedule Routes
 */
import express from 'express';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all on-call schedules for the FM company
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ocs.*, e.name as employee_name, e.phone as employee_phone
       FROM on_call_schedule ocs
       JOIN fm_employee e ON ocs.fm_employee_id = e.id
       WHERE ocs.fm_company_id = $1
       ORDER BY ocs.day_of_week, ocs.start_time`,
      [req.user.fm_company_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching on-call schedules:', error);
    res.status(500).json({ error: 'Failed to fetch on-call schedules' });
  }
});

// Get current on-call employee
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);

    // First check for specific date override
    const dateOverride = await db.query(
      `SELECT ocs.*, e.name as employee_name, e.phone as employee_phone
       FROM on_call_schedule ocs
       JOIN fm_employee e ON ocs.fm_employee_id = e.id
       WHERE ocs.fm_company_id = $1
         AND ocs.schedule_type = 'one_time'
         AND ocs.specific_date = CURRENT_DATE
         AND ocs.is_active = true
         AND $2::time BETWEEN ocs.start_time AND ocs.end_time
       ORDER BY ocs.priority
       LIMIT 1`,
      [req.user.fm_company_id, currentTime]
    );

    if (dateOverride.rows.length > 0) {
      return res.json(dateOverride.rows[0]);
    }

    // Then check recurring schedule
    const recurring = await db.query(
      `SELECT ocs.*, e.name as employee_name, e.phone as employee_phone
       FROM on_call_schedule ocs
       JOIN fm_employee e ON ocs.fm_employee_id = e.id
       WHERE ocs.fm_company_id = $1
         AND ocs.schedule_type = 'recurring'
         AND ocs.day_of_week = $2
         AND ocs.is_active = true
         AND (
           (ocs.start_time <= ocs.end_time AND $3::time BETWEEN ocs.start_time AND ocs.end_time)
           OR
           (ocs.start_time > ocs.end_time AND ($3::time >= ocs.start_time OR $3::time <= ocs.end_time))
         )
       ORDER BY ocs.priority
       LIMIT 1`,
      [req.user.fm_company_id, dayOfWeek, currentTime]
    );

    if (recurring.rows.length > 0) {
      return res.json(recurring.rows[0]);
    }

    res.json(null);
  } catch (error) {
    console.error('Error fetching current on-call:', error);
    res.status(500).json({ error: 'Failed to fetch current on-call' });
  }
});

// Get schedules by employee
router.get('/employee/:employeeId', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM on_call_schedule
       WHERE fm_employee_id = $1 AND fm_company_id = $2
       ORDER BY day_of_week, start_time`,
      [req.params.employeeId, req.user.fm_company_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employee schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Create on-call schedule
router.post('/', authenticateToken, async (req, res) => {
  const {
    fm_employee_id,
    schedule_type,
    day_of_week,
    start_time,
    end_time,
    specific_date,
    priority,
    notes
  } = req.body;

  if (!fm_employee_id || !start_time || !end_time) {
    return res.status(400).json({ error: 'Employee, start time, and end time are required' });
  }

  if (schedule_type === 'recurring' && day_of_week === undefined) {
    return res.status(400).json({ error: 'Day of week is required for recurring schedules' });
  }

  if (schedule_type === 'one_time' && !specific_date) {
    return res.status(400).json({ error: 'Specific date is required for one-time schedules' });
  }

  try {
    const result = await db.query(
      `INSERT INTO on_call_schedule (
         fm_company_id, fm_employee_id, schedule_type, day_of_week,
         start_time, end_time, specific_date, priority, notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.user.fm_company_id,
        fm_employee_id,
        schedule_type || 'recurring',
        day_of_week,
        start_time,
        end_time,
        specific_date,
        priority || 1,
        notes
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating on-call schedule:', error);
    res.status(500).json({ error: 'Failed to create on-call schedule' });
  }
});

// Update on-call schedule
router.put('/:id', authenticateToken, async (req, res) => {
  const {
    fm_employee_id,
    schedule_type,
    day_of_week,
    start_time,
    end_time,
    specific_date,
    is_active,
    priority,
    notes
  } = req.body;

  try {
    const result = await db.query(
      `UPDATE on_call_schedule
       SET fm_employee_id = COALESCE($1, fm_employee_id),
           schedule_type = COALESCE($2, schedule_type),
           day_of_week = COALESCE($3, day_of_week),
           start_time = COALESCE($4, start_time),
           end_time = COALESCE($5, end_time),
           specific_date = COALESCE($6, specific_date),
           is_active = COALESCE($7, is_active),
           priority = COALESCE($8, priority),
           notes = COALESCE($9, notes)
       WHERE id = $10 AND fm_company_id = $11
       RETURNING *`,
      [
        fm_employee_id, schedule_type, day_of_week, start_time, end_time,
        specific_date, is_active, priority, notes, req.params.id, req.user.fm_company_id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating on-call schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Delete on-call schedule
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `DELETE FROM on_call_schedule
       WHERE id = $1 AND fm_company_id = $2
       RETURNING id`,
      [req.params.id, req.user.fm_company_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting on-call schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// Bulk create/update schedules for an employee
router.post('/bulk', authenticateToken, async (req, res) => {
  const { fm_employee_id, schedules } = req.body;

  if (!fm_employee_id || !schedules || !Array.isArray(schedules)) {
    return res.status(400).json({ error: 'Employee ID and schedules array are required' });
  }

  try {
    const insertedSchedules = await db.transaction(async (client) => {
      // Delete existing recurring schedules for this employee
      await client.query(
        `DELETE FROM on_call_schedule
         WHERE fm_employee_id = $1 AND fm_company_id = $2 AND schedule_type = 'recurring'`,
        [fm_employee_id, req.user.fm_company_id]
      );

      // Insert new schedules
      const results = [];
      for (const schedule of schedules) {
        const result = await client.query(
          `INSERT INTO on_call_schedule (
             fm_company_id, fm_employee_id, schedule_type, day_of_week,
             start_time, end_time, priority, notes
           )
           VALUES ($1, $2, 'recurring', $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            req.user.fm_company_id,
            fm_employee_id,
            schedule.day_of_week,
            schedule.start_time,
            schedule.end_time,
            schedule.priority || 1,
            schedule.notes
          ]
        );
        results.push(result.rows[0]);
      }
      return results;
    });

    res.json(insertedSchedules);
  } catch (error) {
    console.error('Error bulk updating schedules:', error);
    res.status(500).json({ error: 'Failed to update schedules' });
  }
});

export default router;
