/**
 * Internal Notify Route
 *
 * Lets a trusted same-box process (currently: the direct-Twilio voice POC,
 * afterhour-direct-twilio-poc) page the real on-call person for an fm_company
 * via the existing notifyHuman() seam (notificationChannel.js) — the same
 * mechanism dispatch.js and wakeupEngine.js already use for SP/on-call calls.
 *
 * Not a public webhook: gated by a shared secret header, not a Twilio
 * signature, because the caller here is our own POC process, not Twilio.
 * Mirrors the fail-closed pattern already used for VOICE_WS_AUTH_TOKEN
 * (see After hour/CLAUDE.md — Aug 27-28 security audit).
 */
import { Router } from 'express';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { notifyHuman } from '../services/notificationChannel.js';

const router = Router();

function requireInternalAuth(req, res, next) {
  const expected = process.env.INTERNAL_NOTIFY_TOKEN;
  if (!expected) {
    logger.error('INTERNAL_NOTIFY_TOKEN not set — refusing all internal-notify requests (fail closed)');
    return res.status(503).json({ error: 'Internal notify not configured' });
  }
  if (req.get('X-Internal-Token') !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

async function getCurrentOnCall(fmCompanyId) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentTime = now.toTimeString().slice(0, 5);

  const dateOverride = await db.query(
    `SELECT COALESCE(e.name, ocs.contact_name) as employee_name,
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
    [fmCompanyId, currentTime],
  );
  if (dateOverride.rows.length > 0) return dateOverride.rows[0];

  const recurring = await db.query(
    `SELECT COALESCE(e.name, ocs.contact_name) as employee_name,
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
    [fmCompanyId, dayOfWeek, currentTime],
  );
  return recurring.rows[0] || null;
}

// POST /api/internal/notify-oncall
// Body: { fmCompanyId, tier, line1, line2, line3, incidentId }
router.post('/notify-oncall', requireInternalAuth, async (req, res) => {
  const { fmCompanyId, tier, line1, line2, line3, incidentId } = req.body || {};
  if (!fmCompanyId || !tier || !line1) {
    return res.status(400).json({ error: 'fmCompanyId, tier and line1 are required' });
  }

  try {
    const onCall = await getCurrentOnCall(fmCompanyId);
    if (!onCall || !onCall.employee_phone) {
      logger.error('internal-notify: no on-call person configured/active', { fmCompanyId, incidentId });
      return res.status(422).json({ delivered: false, reason: 'no_oncall_configured' });
    }

    const body = [line1, line2, line3].filter(Boolean).join('. ');
    const result = await notifyHuman({
      recipient: { name: onCall.employee_name, phone: onCall.employee_phone },
      purpose: 'fm_escalation',
      content: { title: `${tier} incident`, body },
      channels: ['voice_call', 'sms'],
      correlation: { incidentId },
    });

    res.json({ delivered: result.delivered, channelUsed: result.channelUsed, onCallName: onCall.employee_name });
  } catch (error) {
    logger.error('internal-notify failed', { error: error.message, fmCompanyId, incidentId });
    res.status(500).json({ delivered: false, error: 'internal_error' });
  }
});

export default router;
