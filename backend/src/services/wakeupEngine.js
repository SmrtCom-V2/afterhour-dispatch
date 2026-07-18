/**
 * Wake-up Engine — Night Ops HITL core loop.
 *
 * Implements NIGHT_OPS_MASTER_PLAN.md §4.2: when a night incident is created
 * (ai_urgency set, decision still 'pending'), ring + SMS the on-call primary
 * at T+0, re-ring at T+2, escalate to backup at T+5, and fail-safe
 * auto-dispatch at T+10 if nobody has decided anything in the cockpit yet.
 *
 * Runs as a cron tick (every ~20s — fine-grained enough that T+2/5/10 minute
 * boundaries are hit within one tick) rather than setTimeout chains, so state
 * survives a server restart: everything is driven off `wakeup_attempt` rows
 * and `incident.decision`, not in-memory timers.
 */

import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { notifyHuman } from './notificationChannel.js';
import { startDispatch } from './dispatch.js';
import { determineRequiredTrade } from './tradeMapping.js';

const STAGE_DELAY_MINUTES = { t0: 0, t2: 2, t5_backup: 5, t10_failsafe: 10 };

/**
 * Main tick — call this from the scheduler cron. Finds every open night
 * incident that needs *some* wake-up action right now and takes it.
 */
export async function runWakeupTick() {
  try {
    const incidents = await db.query(
      `SELECT id, building_id, issue_category, issue_description, ai_urgency, ai_confidence, created_at
       FROM incident
       WHERE ai_urgency IS NOT NULL
         AND decision = 'pending'
         AND night_outcome IS NULL
         AND created_at > NOW() - INTERVAL '2 hours'`,
    );

    for (const incident of incidents.rows) {
      await processIncidentWakeup(incident).catch((err) =>
        logger.error('Wake-up tick failed for incident', { incidentId: incident.id, error: err.message }),
      );
    }
  } catch (error) {
    logger.error('runWakeupTick failed', { error: error.message });
  }
}

async function processIncidentWakeup(incident) {
  const ageMinutes = (Date.now() - new Date(incident.created_at).getTime()) / 60000;

  const attempts = await db.query(
    `SELECT stage FROM wakeup_attempt WHERE incident_id = $1`,
    [incident.id],
  );
  const stagesDone = new Set(attempts.rows.map((r) => r.stage));

  // T+0: primary, immediately
  if (!stagesDone.has('t0')) {
    await wakeStage(incident, 't0', 'primary');
    return; // one stage per tick keeps this simple and race-free
  }

  // T+2: re-ring primary (same person, second attempt)
  if (ageMinutes >= STAGE_DELAY_MINUTES.t2 && !stagesDone.has('t2')) {
    await wakeStage(incident, 't2', 'primary');
    return;
  }

  // T+5: backup
  if (ageMinutes >= STAGE_DELAY_MINUTES.t5_backup && !stagesDone.has('t5_backup')) {
    await wakeStage(incident, 't5_backup', 'backup');
    return;
  }

  // T+10: fail-safe auto-dispatch — the only place besides the cockpit that
  // may set decision='emergency_dispatch' (Night Ops D1).
  if (ageMinutes >= STAGE_DELAY_MINUTES.t10_failsafe && !stagesDone.has('t10_failsafe')) {
    await fireFailsafe(incident);
  }
}

async function wakeStage(incident, stage, role) {
  const person = await resolveOnCallPerson(incident.building_id, role);

  if (!person) {
    logger.warn('No on-call person configured for stage', {
      incidentId: incident.id,
      stage,
      role,
      buildingId: incident.building_id,
    });
    // Log the attempt as failed-no-recipient so this stage doesn't retry
    // forever and the morning report can flag the config gap.
    await db.query(
      `INSERT INTO wakeup_attempt (incident_id, person_name, phone, stage, channel, result)
       VALUES ($1, NULL, NULL, $2, 'voice_call', 'no_recipient_configured')`,
      [incident.id, stage],
    );
    return;
  }

  const token = await createCockpitToken(incident.id, role, person);
  const cockpitUrl = `${process.env.APP_URL || 'http://localhost:3005'}/cockpit/${token}`;

  const urgencyLabel =
    incident.ai_urgency === 'unclear' ? 'AI IST UNSICHER' : incident.ai_urgency === 'critical' ? 'NOTFALL' : 'DRINGEND';
  const categoryLabel = (incident.issue_category || 'Vorfall').replace(/_/g, ' ');

  await notifyHuman({
    recipient: { name: person.name, phone: person.phone },
    purpose: 'wakeup',
    content: {
      title: urgencyLabel,
      body: `${urgencyLabel}: ${categoryLabel}. Details und Entscheidung: ${cockpitUrl}`,
    },
    channels: ['voice_call', 'sms'],
    correlation: { incidentId: incident.id, wakeupStage: stage },
  });

  logger.warn(`Incident ${incident.id}: wake-up stage ${stage} (${role}) sent to ${person.name || person.phone}`);
}

async function fireFailsafe(incident) {
  const requiredTrade = determineRequiredTrade(incident.issue_category);

  await db.query(
    `UPDATE incident
     SET decision = 'emergency_dispatch', decision_at = NOW(), decided_by_person = 'failsafe', decided_via = 'failsafe'
     WHERE id = $1 AND decision = 'pending'`,
    [incident.id],
  );

  await db.query(
    `INSERT INTO incident_timeline (incident_id, event_type, event_data)
     VALUES ($1, 'wakeup.failsafe_triggered', $2)`,
    [incident.id, JSON.stringify({ requiredTrade })],
  );

  logger.warn(`Incident ${incident.id}: T+10 fail-safe triggered — nobody decided, auto-dispatching ${requiredTrade}`);

  // Notify both roles it happened, best-effort — this must never block or
  // fail the dispatch itself.
  const [primary, backup] = await Promise.all([
    resolveOnCallPerson(incident.building_id, 'primary'),
    resolveOnCallPerson(incident.building_id, 'backup'),
  ]);
  for (const person of [primary, backup].filter(Boolean)) {
    notifyHuman({
      recipient: { name: person.name, phone: person.phone },
      purpose: 'wakeup',
      content: { title: 'Auto-Dispatch', body: `Niemand hat reagiert — Dienstleister wurde automatisch alarmiert. Vorfall ${incident.id}.` },
      channels: ['sms'],
      correlation: { incidentId: incident.id, wakeupStage: 't10_failsafe' },
    }).catch((err) => logger.error('Failsafe notify failed', { error: err.message }));
  }

  await db.query(
    `INSERT INTO wakeup_attempt (incident_id, person_name, phone, stage, channel, result)
     VALUES ($1, NULL, NULL, 't10_failsafe', 'voice_call', 'failsafe_dispatched')`,
    [incident.id],
  );

  startDispatch(incident.id, requiredTrade).catch((err) =>
    logger.error('Failsafe startDispatch failed', { incidentId: incident.id, error: err.message }),
  );
}

/**
 * Resolve tonight's primary/backup for a building via its FM company's
 * on_call_schedule. Falls back to fm_company.fm_oncall_phone if no
 * role-tagged schedule entry exists (config-gap safety net, flagged in
 * wakeStage's no_recipient_configured log when even that is missing).
 */
async function resolveOnCallPerson(buildingId, role) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentTime = now.toTimeString().slice(0, 8);

  const result = await db.query(
    `SELECT COALESCE(ocs.contact_name, e.name) AS name,
            COALESCE(ocs.contact_phone, e.phone) AS phone
     FROM building b
     JOIN pm_company pm ON b.pm_company_id = pm.id
     JOIN fm_company fm ON pm.fm_company_id = fm.id
     JOIN on_call_schedule ocs ON ocs.fm_company_id = fm.id
     LEFT JOIN fm_employee e ON ocs.fm_employee_id = e.id
     WHERE b.id = $1
       AND ocs.role = $2
       AND ocs.is_active = true
       AND (
         (ocs.schedule_type = 'one_time' AND ocs.specific_date = CURRENT_DATE)
         OR (ocs.schedule_type = 'recurring' AND ocs.day_of_week = $3)
       )
       AND (
         (ocs.start_time <= ocs.end_time AND $4::time BETWEEN ocs.start_time AND ocs.end_time)
         OR (ocs.start_time > ocs.end_time AND ($4::time >= ocs.start_time OR $4::time <= ocs.end_time))
       )
     ORDER BY ocs.priority, ocs.updated_at DESC
     LIMIT 1`,
    [buildingId, role, dayOfWeek, currentTime],
  );

  if (result.rows.length > 0 && result.rows[0].phone) {
    return result.rows[0];
  }

  if (role === 'primary') {
    const fallback = await db.query(
      `SELECT fm.fm_oncall_name AS name, fm.fm_oncall_phone AS phone
       FROM building b
       JOIN pm_company pm ON b.pm_company_id = pm.id
       JOIN fm_company fm ON pm.fm_company_id = fm.id
       WHERE b.id = $1 AND fm.fm_oncall_phone IS NOT NULL`,
      [buildingId],
    );
    if (fallback.rows.length > 0) return fallback.rows[0];
  }

  return null;
}

async function createCockpitToken(incidentId, role, person) {
  // token column is VARCHAR(64) unique — replace() strips hyphens from two
  // concatenated UUIDs for a 64-char unguessable token without pgcrypto
  // (gen_random_bytes needs the pgcrypto extension, not enabled on this DB;
  // gen_random_uuid() is built into PG13+ and already verified working).
  const result = await db.query(
    `INSERT INTO cockpit_token (incident_id, token, role, person_name, phone, expires_at)
     VALUES ($1, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), $2, $3, $4, NOW() + INTERVAL '12 hours')
     RETURNING token`,
    [incidentId, role, person.name || null, person.phone],
  );
  return result.rows[0].token;
}

export default { runWakeupTick };
