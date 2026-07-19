/**
 * Decision Cockpit routes — Night Ops HITL, see NIGHT_OPS_MASTER_PLAN.md §4.3.
 *
 * Token-authenticated (the token IS the auth — no JWT/login), single-use per
 * decision, scoped to one incident. Deliberately NOT mounted under /api/auth
 * or behind authenticateToken: a half-asleep on-call person following an SMS
 * link must not have to log in.
 */
import express from 'express';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { startDispatch } from '../services/dispatch.js';
import { determineRequiredTrade } from '../services/tradeMapping.js';
import { GuidedQuestions } from '../providers/voiceai/index.js';

const router = express.Router();

/**
 * Labels raw guided_answers ({problem: "...", danger_type: "..."}) with the
 * actual question text that was asked, in the call's language — so the
 * cockpit page/app doesn't need to duplicate GuidedQuestions client-side.
 */
function labelGuidedAnswers(guidedAnswers, language) {
  if (!guidedAnswers) return [];
  const questions = GuidedQuestions[language] || GuidedQuestions.de;
  return questions
    .filter((q) => guidedAnswers[q.id] !== undefined)
    .map((q) => ({ question: q.question, answer: guidedAnswers[q.id] }));
}

async function loadTokenContext(token) {
  const tokenResult = await db.query(
    `SELECT ct.id, ct.incident_id, ct.role, ct.person_name, ct.phone, ct.expires_at, ct.used_at
     FROM cockpit_token ct
     WHERE ct.token = $1`,
    [token],
  );
  if (tokenResult.rows.length === 0) return { error: 'not_found' };

  const tokenRow = tokenResult.rows[0];
  if (new Date(tokenRow.expires_at) < new Date()) return { error: 'expired', tokenRow };

  return { tokenRow };
}

/**
 * GET /api/cockpit/:token — full incident context for section A-D of the
 * cockpit page (What happened / Where / History / Suggested company).
 */
router.get('/:token', async (req, res) => {
  try {
    const { tokenRow, error } = await loadTokenContext(req.params.token);
    if (error === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error === 'expired') return res.status(410).json({ error: 'expired' });

    // Mark opened_at on first view only.
    await db.query(
      `UPDATE cockpit_token SET opened_at = COALESCE(opened_at, NOW()) WHERE id = $1`,
      [tokenRow.id],
    );

    const incidentResult = await db.query(
      `SELECT i.id, i.issue_category, i.issue_description, i.ai_confidence, i.ai_urgency,
              i.tenant_name_given, i.tenant_phone_given, i.created_at, i.guided_answers,
              i.decision, i.night_outcome, i.decided_by_person,
              b.id as building_id, b.name as building_name, b.address as building_address,
              b.water_shutoff_location, b.gas_shutoff_location, b.electric_shutoff_location,
              b.key_safe_location, b.key_safe_code, b.gate_code, b.main_entrance_code,
              b.special_access_instructions, b.janitor_name, b.janitor_phone,
              t.name as tenant_name, t.phone as tenant_phone,
              c.transcript, c.language, c.caller_phone
       FROM incident i
       LEFT JOIN building b ON i.building_id = b.id
       LEFT JOIN tenant t ON i.tenant_id = t.id
       LEFT JOIN call c ON i.call_id = c.id
       WHERE i.id = $1`,
      [tokenRow.incident_id],
    );
    if (incidentResult.rows.length === 0) return res.status(404).json({ error: 'incident_not_found' });
    const incident = incidentResult.rows[0];

    // History: recent incidents at this building (pattern recognition).
    const history = await db.query(
      `SELECT id, issue_category, created_at, decision, night_outcome
       FROM incident
       WHERE building_id = $1 AND id != $2
       ORDER BY created_at DESC
       LIMIT 5`,
      [incident.building_id, incident.id],
    );

    // Suggested company: priority-1 active SP for this building+trade,
    // fallback 'general', plus the full list for override (Night Ops §5 —
    // Phase 1 anti-collusion is the audit trail, not routing cleverness).
    const requiredTrade = determineRequiredTrade(incident.issue_category);
    const spList = await db.query(
      `SELECT sp.id, sp.company_name, sp.phone, sp.trade, bsp.priority,
              sp.usage_note, sp.available_24h, sp.available_from, sp.available_to
       FROM service_provider sp
       JOIN building_service_provider bsp ON sp.id = bsp.service_provider_id
       WHERE bsp.building_id = $1 AND sp.status = 'active'
       ORDER BY (sp.trade = $2) DESC, bsp.priority ASC`,
      [incident.building_id, requiredTrade],
    );

    const suggested = spList.rows.find((sp) => sp.trade === requiredTrade) || spList.rows[0] || null;

    // Other wake-up attempts so far, for "already handled by X" display.
    const wakeups = await db.query(
      `SELECT stage, channel, result, created_at FROM wakeup_attempt WHERE incident_id = $1 ORDER BY created_at`,
      [incident.id],
    );

    res.json({
      incident: {
        id: incident.id,
        category: incident.issue_category,
        description: incident.issue_description,
        aiConfidence: incident.ai_confidence,
        aiUrgency: incident.ai_urgency,
        createdAt: incident.created_at,
        decision: incident.decision,
        nightOutcome: incident.night_outcome,
        decidedByPerson: incident.decided_by_person,
        transcript: incident.transcript,
        guidedAnswers: labelGuidedAnswers(incident.guided_answers, incident.language),
      },
      caller: {
        name: incident.tenant_name || incident.tenant_name_given,
        phone: incident.tenant_phone || incident.tenant_phone_given || incident.caller_phone,
      },
      building: {
        id: incident.building_id,
        name: incident.building_name,
        address: incident.building_address,
        waterShutoff: incident.water_shutoff_location,
        gasShutoff: incident.gas_shutoff_location,
        electricShutoff: incident.electric_shutoff_location,
        keySafeLocation: incident.key_safe_location,
        keySafeCode: incident.key_safe_code,
        gateCode: incident.gate_code,
        mainEntranceCode: incident.main_entrance_code,
        specialAccessInstructions: incident.special_access_instructions,
        janitorName: incident.janitor_name,
        janitorPhone: incident.janitor_phone,
      },
      history: history.rows,
      requiredTrade,
      suggestedCompany: suggested,
      allCompanies: spList.rows,
      wakeupAttempts: wakeups.rows,
      viewer: { role: tokenRow.role, name: tokenRow.person_name },
      alreadyDecided: incident.decision !== 'pending',
    });
  } catch (error) {
    logger.error('cockpit GET error', { error: error.message });
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * POST /api/cockpit/:token/decision — buttons B1 (send company) / B2 (I'll
 * go myself) / B3 (can wait until morning). Race-safe: the UPDATE's
 * `WHERE decision = 'pending'` means only the first request to land wins;
 * the second gets rowCount 0 and is told someone already decided.
 */
router.post('/:token/decision', async (req, res) => {
  try {
    const { tokenRow, error } = await loadTokenContext(req.params.token);
    if (error === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error === 'expired') return res.status(410).json({ error: 'expired' });

    const { action, chosenSpId, deferReason } = req.body;
    if (!['send_company', 'owner_on_site', 'defer_morning'].includes(action)) {
      return res.status(400).json({ error: 'invalid_action' });
    }

    const incidentResult = await db.query('SELECT building_id, issue_category, decision FROM incident WHERE id = $1', [
      tokenRow.incident_id,
    ]);
    if (incidentResult.rows.length === 0) return res.status(404).json({ error: 'incident_not_found' });
    const incident = incidentResult.rows[0];

    const requiredTrade = determineRequiredTrade(incident.issue_category);
    let suggestedSpId = null;
    if (action === 'send_company') {
      const suggestion = await db.query(
        `SELECT sp.id FROM service_provider sp
         JOIN building_service_provider bsp ON sp.id = bsp.service_provider_id
         WHERE bsp.building_id = $1 AND sp.trade = $2 AND sp.status = 'active'
         ORDER BY bsp.priority ASC LIMIT 1`,
        [incident.building_id, requiredTrade],
      );
      suggestedSpId = suggestion.rows[0]?.id || null;
    }

    const nightOutcome =
      action === 'send_company' ? 'dispatched' : action === 'owner_on_site' ? 'owner_on_site' : 'deferred_morning';

    // Race-safe: only succeeds if still 'pending'. This is the single write
    // that resolves the T+0..T+10 wake-up race between primary/backup.
    const updateResult = await db.query(
      `UPDATE incident
       SET decision = $1, decision_at = NOW(), decided_by_person = $2, decided_via = 'cockpit',
           suggested_sp_id = $3, chosen_sp_id = $4, night_outcome = $5
       WHERE id = $6 AND decision = 'pending'
       RETURNING id`,
      [
        action === 'send_company' ? 'emergency_dispatch' : 'not_emergency',
        tokenRow.person_name || tokenRow.phone,
        suggestedSpId,
        action === 'send_company' ? chosenSpId || suggestedSpId : null,
        nightOutcome,
        tokenRow.incident_id,
      ],
    );

    if (updateResult.rowCount === 0) {
      // Someone else already decided — tell the caller who and what.
      const already = await db.query('SELECT decided_by_person, night_outcome FROM incident WHERE id = $1', [
        tokenRow.incident_id,
      ]);
      return res.status(409).json({
        error: 'already_decided',
        decidedByPerson: already.rows[0]?.decided_by_person,
        nightOutcome: already.rows[0]?.night_outcome,
      });
    }

    // Mark THIS token used_at — it's the one that won the decision race
    // (the UPDATE above already gated that with `WHERE decision = 'pending'`).
    // escalateToFM's "ring the actual decider" lookup depends on this.
    await db.query(`UPDATE cockpit_token SET used_at = NOW() WHERE id = $1`, [tokenRow.id]);

    await db.query(
      `INSERT INTO incident_timeline (incident_id, event_type, event_data)
       VALUES ($1, 'cockpit.decision', $2)`,
      [
        tokenRow.incident_id,
        JSON.stringify({ action, decidedBy: tokenRow.person_name || tokenRow.phone, role: tokenRow.role, chosenSpId }),
      ],
    );

    if (action === 'send_company') {
      startDispatch(tokenRow.incident_id, requiredTrade, chosenSpId || null).catch((err) =>
        logger.error('cockpit-triggered startDispatch failed', { incidentId: tokenRow.incident_id, error: err.message }),
      );
    }

    // NOTE: defer_morning does not currently notify the original caller.
    // This Twilio number is voice-only (no SMS capability) — an automated
    // phone call to say "this is not an emergency" would be a worse
    // experience than the current silence. Revisit once SMS works.

    res.json({ success: true, action, nightOutcome });
  } catch (error) {
    logger.error('cockpit decision error', { error: error.message });
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * POST /api/cockpit/:token/outcome — section F, after-action capture
 * ("stabilized", "resolved tonight"). Editable, not race-gated like
 * /decision — the same decider (or the office next morning) can update it.
 */
router.post('/:token/outcome', async (req, res) => {
  try {
    const { tokenRow, error } = await loadTokenContext(req.params.token);
    if (error === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error === 'expired') return res.status(410).json({ error: 'expired' });

    const { outcome, note } = req.body;
    if (!['stabilized_pending_repair', 'resolved_night'].includes(outcome)) {
      return res.status(400).json({ error: 'invalid_outcome' });
    }

    await db.query(`UPDATE incident SET night_outcome = $1 WHERE id = $2`, [outcome, tokenRow.incident_id]);
    await db.query(
      `INSERT INTO incident_timeline (incident_id, event_type, event_data)
       VALUES ($1, 'cockpit.outcome', $2)`,
      [tokenRow.incident_id, JSON.stringify({ outcome, note, recordedBy: tokenRow.person_name || tokenRow.phone })],
    );

    res.json({ success: true, outcome });
  } catch (error) {
    logger.error('cockpit outcome error', { error: error.message });
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
