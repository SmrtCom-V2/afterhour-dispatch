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
      `SELECT ocs.*,
              COALESCE(e.name, ocs.contact_name) as employee_name,
              COALESCE(e.phone, ocs.contact_phone) as employee_phone
       FROM on_call_schedule ocs
       LEFT JOIN fm_employee e ON ocs.fm_employee_id = e.id
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
    // LEFT JOIN fm_employee (not inner JOIN): an FM-company-staffed slot has
    // no fm_employee row at all — COALESCE with contact_name/contact_phone
    // (Night Ops D3). An inner JOIN here silently dropped those slots from
    // every on-call view, discovered while wiring the wake-up engine.
    const dateOverride = await db.query(
      `SELECT ocs.*,
              COALESCE(e.name, ocs.contact_name) as employee_name,
              COALESCE(e.phone, ocs.contact_phone) as employee_phone
       FROM on_call_schedule ocs
       LEFT JOIN fm_employee e ON ocs.fm_employee_id = e.id
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
      `SELECT ocs.*,
              COALESCE(e.name, ocs.contact_name) as employee_name,
              COALESCE(e.phone, ocs.contact_phone) as employee_phone
       FROM on_call_schedule ocs
       LEFT JOIN fm_employee e ON ocs.fm_employee_id = e.id
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
    notes,
    // Night Ops D3/D5: role distinguishes tonight's primary from backup;
    // staffing_mode + contact_name/contact_phone support an outsourced FM
    // company contact who isn't a fm_employee row at all. Defaults keep
    // every pre-existing caller (the original Employees.jsx UI) working
    // unchanged — a plain employee schedule is still 'primary'/'pm_employee'.
    role,
    staffing_mode,
    contact_name,
    contact_phone,
  } = req.body;

  if (!fm_employee_id && !contact_phone) {
    return res.status(400).json({ error: 'Either an employee or a contact phone number is required' });
  }
  if (!start_time || !end_time) {
    return res.status(400).json({ error: 'Start time and end time are required' });
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
         start_time, end_time, specific_date, priority, notes,
         role, staffing_mode, contact_name, contact_phone
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        req.user.fm_company_id,
        fm_employee_id || null,
        schedule_type || 'recurring',
        day_of_week,
        start_time,
        end_time,
        specific_date,
        priority || 1,
        notes,
        role || 'primary',
        staffing_mode || 'pm_employee',
        contact_name || null,
        contact_phone || null,
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

// ---- Weekly rotation assignments (Night Ops D5) ----
// A "week assignment" = one person is primary on-call 24/7 for a Mon-Sun
// week. Stored as 7 one_time rows in on_call_schedule (one per date,
// 00:00-23:59, role='primary') — the wake-up engine already resolves
// one_time rows with no changes needed, and a specific-date row overrides
// the recurring baseline. This replaces the Employees.jsx rotation
// calendar's previous behavior of holding assignments in React state only
// (the save call was literally commented out — nothing ever persisted).

// Get week assignments in a date range, aggregated per week
router.get('/week-assignments', authenticateToken, async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to dates are required' });

  try {
    const result = await db.query(
      `SELECT ocs.specific_date, ocs.notes,
              ocs.fm_employee_id,
              COALESCE(e.name, ocs.contact_name) as person_name,
              COALESCE(e.phone, ocs.contact_phone) as person_phone
       FROM on_call_schedule ocs
       LEFT JOIN fm_employee e ON ocs.fm_employee_id = e.id
       WHERE ocs.fm_company_id = $1
         AND ocs.schedule_type = 'one_time'
         AND ocs.role = 'primary'
         AND ocs.is_active = true
         AND ocs.specific_date BETWEEN $2 AND $3
       ORDER BY ocs.specific_date`,
      [req.user.fm_company_id, from, to]
    );

    // Aggregate consecutive dates into per-week entries, keyed by the week
    // START in the SAME convention as Employees.jsx's getWeekStart (Sunday-
    // based: date minus getDay()) — a Monday-keyed aggregation here silently
    // misaligned every assignment with the calendar's week cells.
    const assignments = {};
    for (const row of result.rows) {
      const d = new Date(row.specific_date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split('T')[0];
      if (!assignments[key]) {
        assignments[key] = {
          weekStart: key,
          employeeId: row.fm_employee_id,
          employeeName: row.person_name,
          employeePhone: row.person_phone,
          notes: row.notes || '',
          days: 0,
        };
      }
      assignments[key].days += 1;
    }

    res.json(Object.values(assignments));
  } catch (error) {
    console.error('Error fetching week assignments:', error);
    res.status(500).json({ error: 'Failed to fetch week assignments' });
  }
});

// Set (or clear) the primary on-call person for a whole week
router.post('/week-assignment', authenticateToken, async (req, res) => {
  const { week_start, fm_employee_id, notes } = req.body;
  if (!week_start || !/^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
    return res.status(400).json({ error: 'week_start (YYYY-MM-DD, a Monday) is required' });
  }

  try {
    const saved = await db.transaction(async (client) => {
      // Clear any existing one_time primary rows for those 7 dates first —
      // prevents the duplicate-rows-same-priority ambiguity that misrouted
      // a wake-up call during the July 18 live drill.
      await client.query(
        `DELETE FROM on_call_schedule
         WHERE fm_company_id = $1
           AND schedule_type = 'one_time'
           AND role = 'primary'
           AND specific_date >= $2::date
           AND specific_date < $2::date + INTERVAL '7 days'`,
        [req.user.fm_company_id, week_start]
      );

      if (!fm_employee_id) return []; // cleared

      const rows = [];
      for (let i = 0; i < 7; i++) {
        const result = await client.query(
          `INSERT INTO on_call_schedule (
             fm_company_id, fm_employee_id, schedule_type, specific_date,
             start_time, end_time, is_active, priority, role, staffing_mode, notes
           )
           VALUES ($1, $2, 'one_time', $3::date + ($4 || ' days')::interval, '00:00:00', '23:59:59', true, 1, 'primary', 'pm_employee', $5)
           RETURNING id, specific_date`,
          [req.user.fm_company_id, fm_employee_id, week_start, String(i), notes || null]
        );
        rows.push(result.rows[0]);
      }
      return rows;
    });

    res.json({ success: true, daysWritten: saved.length });
  } catch (error) {
    console.error('Error saving week assignment:', error);
    res.status(500).json({ error: 'Failed to save week assignment' });
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
