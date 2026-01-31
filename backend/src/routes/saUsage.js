/**
 * Super Admin Usage
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateSuperAdmin } from '../middleware/superAdmin.js';

const router = Router();

router.get('/', authenticateSuperAdmin, async (req, res) => {
  const result = await db.query(
    `SELECT id, name, seats_used, seats_limit, last_activity_at, owner_email
     FROM fm_company
     ORDER BY seats_used DESC NULLS LAST`
  );

  res.json({
    usage: result.rows.map((row) => ({
      ...row,
      over_limit: row.seats_limit > 0 && row.seats_used > row.seats_limit,
    })),
  });
});

export default router;
