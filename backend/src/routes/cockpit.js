/**
 * Decision Cockpit routes — Night Ops HITL, see NIGHT_OPS_MASTER_PLAN.md §4.3
 * and AFTERHOUR_ONCALL_COCKPIT_DECISION_FUNNEL_REBUILD_2026-09-02.md.
 *
 * Token-authenticated (the token IS the auth — no JWT/login), single-use per
 * decision, scoped to one incident. Deliberately NOT mounted under /api/auth
 * or behind authenticateToken: a half-asleep on-call person following an SMS
 * link must not have to log in.
 *
 * Decision actions (POST /:token/decision):
 *   send_company         → decision=emergency_dispatch, system runs the SP call loop
 *   send_company_manual  → decision=emergency_dispatch, on-call person phones the SP
 *                          themselves; we only record it + issue the report token
 *   owner_on_site        → decision=not_emergency, on-call person handles it
 *   escalate_fm          → decision=escalated_to_fm_by_human, rings the FM on-call
 *   defer_morning        → decision=not_emergency, waits until the office opens
 *   callback_tenant      → NOT a decision — decision stays 'pending', T+10 fail-safe
 *                          stays armed. Bumps callback_count, returns and lets the
 *                          human call the tenant, then come back and decide.
 */
import express from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { startDispatch, recordManualDispatch } from '../services/dispatch.js';
import { determineRequiredTrade } from '../services/tradeMapping.js';
import { notifyHuman } from '../services/notificationChannel.js';
import { GuidedQuestions } from '../providers/voiceai/index.js';
import { decryptBuildingCodes } from './buildings.js';
import { decryptPiiFields } from '../utils/piiCrypto.js';

const router = express.Router();

// The T+10 fail-safe (wakeupEngine.js) auto-dispatches if nobody has decided
// 10 minutes after incident.created_at. The cockpit shows a live countdown to
// this so the on-call person knows the clock is running.
const FAILSAFE_MINUTES = 10;

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

/**
 * Is a service provider reachable right now? Computed server-side against
 * Europe/Berlin wall-clock so the on-call person (often not a trades pro)
 * doesn't call a "business hours only" contractor at 2am.
 * Returns 'always' | 'open' | 'closed'.
 */
function spOpenNow(sp, now = new Date()) {
  if (sp.available_24h) return 'always';
  if (!sp.available_from || !sp.available_to) return 'always'; // unset window = assume reachable
  const berlin = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const mins = berlin.getHours() * 60 + berlin.getMinutes();
  const [fh, fm] = String(sp.available_from).split(':').map(Number);
  const [th, tm] = String(sp.available_to).split(':').map(Number);
  const from = fh * 60 + fm;
  const to = th * 60 + tm;
  const openNow = from <= to ? (mins >= from && mins < to) : (mins >= from || mins < to); // handle overnight window
  return openNow ? 'open' : 'closed';
}

function shapeSp(sp) {
  if (!sp) return null;
  return {
    id: sp.id,
    companyName: sp.company_name,
    trade: sp.trade,
    phone: sp.phone,
    priority: sp.priority ?? null,
    usageNote: sp.usage_note || null,
    available24h: sp.available_24h ?? true,
    availableFrom: sp.available_from || null,
    availableTo: sp.available_to || null,
    openNow: spOpenNow(sp),
  };
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
 * GET /api/cockpit/forward/:token — the code-stripped read-only view.
 * NO building access codes, NO janitor phone, NO special access instructions.
 *
 * MUST be declared before GET /:token or Express matches "forward" as a token.
 */
router.get('/forward/:token', async (req, res) => {
  try {
    const linkResult = await db.query(
      `SELECT id, incident_id, expires_at FROM cockpit_forward_link WHERE token = $1`,
      [req.params.token],
    );
    if (linkResult.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    const link = linkResult.rows[0];
    if (new Date(link.expires_at) < new Date()) return res.status(410).json({ error: 'expired' });

    await db.query(
      `UPDATE cockpit_forward_link SET opened_at = COALESCE(opened_at, NOW()) WHERE id = $1`,
      [link.id],
    );

    const incidentResult = await db.query(
      `SELECT i.id, i.issue_category, i.issue_description, i.created_at,
              b.name as building_name, b.address as building_address,
              c.transcript
       FROM incident i
       LEFT JOIN building b ON i.building_id = b.id
       LEFT JOIN call c ON i.call_id = c.id
       WHERE i.id = $1`,
      [link.incident_id],
    );
    if (incidentResult.rows.length === 0) return res.status(404).json({ error: 'incident_not_found' });
    const incident = incidentResult.rows[0];

    const briefRow = await db.query(
      `SELECT event_data FROM incident_timeline
       WHERE incident_id = $1 AND event_type = 'ai_incident_summary'
       ORDER BY created_at DESC LIMIT 1`,
      [link.incident_id],
    );
    const aiBrief = briefRow.rows[0]?.event_data || null;

    await db.query(
      `INSERT INTO incident_timeline (incident_id, event_type, event_data)
       VALUES ($1, 'cockpit.forward_opened', $2)`,
      [link.incident_id, JSON.stringify({})],
    );

    const requiredTrade = determineRequiredTrade(incident.issue_category);

    // Deliberately minimal — this is a link that may leave the building.
    res.json({
      incident: {
        category: incident.issue_category,
        description: incident.issue_description,
        createdAt: incident.created_at,
        transcript: incident.transcript,
        aiBrief: aiBrief
          ? {
              headline: aiBrief.headline,
              reported: aiBrief.reported,
              story_summary: aiBrief.story_summary,
              qa: aiBrief.qa,
              emergency_assessment: aiBrief.emergency_assessment,
              suggested_actions: aiBrief.suggested_actions,
              narrative: aiBrief.narrative,
            }
          : null,
      },
      building: { name: incident.building_name, address: incident.building_address },
      requiredTrade,
    });
  } catch (error) {
    logger.error('cockpit forward view error', { error: error.message });
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * GET /api/cockpit/:token — full incident context for the decision funnel:
 *   Zone 1 verdict · Zone 2 the 20-second read · Zone 3 detail · Zone 4 decide.
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
              i.classification_reason, i.verification_status,
              i.tenant_name_given, i.tenant_phone_given, i.created_at, i.guided_answers,
              i.decision, i.night_outcome, i.decided_by_person, i.override_reason,
              i.dispatch_mode, i.callback_count,
              b.id as building_id, b.name as building_name, b.address as building_address,
              b.water_shutoff_location, b.gas_shutoff_location, b.electric_shutoff_location,
              b.key_safe_location, b.key_safe_code, b.gate_code, b.main_entrance_code,
              b.special_access_instructions, b.janitor_name, b.janitor_phone,
              t.name as tenant_name, t.phone as tenant_phone,
              c.transcript, c.language, c.caller_phone,
              fm.fm_oncall_name, fm.fm_oncall_phone
       FROM incident i
       LEFT JOIN building b ON i.building_id = b.id
       LEFT JOIN tenant t ON i.tenant_id = t.id
       LEFT JOIN call c ON i.call_id = c.id
       LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
       LEFT JOIN fm_company fm ON pm.fm_company_id = fm.id
       WHERE i.id = $1`,
      [tokenRow.incident_id],
    );
    if (incidentResult.rows.length === 0) return res.status(404).json({ error: 'incident_not_found' });
    // Decrypt immediately, before hasSensitiveCodes/anything else reads
    // these fields (Blocker #4/#1) — keeps every downstream use consistent.
    const incident = decryptPiiFields(decryptBuildingCodes(incidentResult.rows[0]));

    // History: recent incidents at this building (pattern recognition).
    const history = await db.query(
      `SELECT id, issue_category, created_at, decision, night_outcome
       FROM incident
       WHERE building_id = $1 AND id != $2
       ORDER BY created_at DESC
       LIMIT 5`,
      [incident.building_id, incident.id],
    );

    // Recurring-pattern signal for Zone 2 ("3rd water issue here this month").
    const recurring = await db.query(
      `SELECT
         COUNT(*)::int AS count,
         COUNT(*) FILTER (WHERE issue_category = $3)::int AS same_category_count
       FROM incident
       WHERE building_id = $1 AND id != $2 AND created_at > NOW() - INTERVAL '30 days'`,
      [incident.building_id, incident.id, incident.issue_category],
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

    // The AI's post-call brief (headline, what was reported, the Q&A, the
    // emergency read incl. "unsure", suggested actions). Written by the voice
    // brain's generateIncidentSummary() to incident_timeline right after the
    // ticket. This is the scannable version — the raw guided_answers below
    // stay as a fallback for older incidents that predate it.
    const briefRow = await db.query(
      `SELECT event_data FROM incident_timeline
       WHERE incident_id = $1 AND event_type = 'ai_incident_summary'
       ORDER BY created_at DESC LIMIT 1`,
      [incident.id],
    );
    const aiBrief = briefRow.rows[0]?.event_data || null;

    // Explicit suggested-action label (gap found in the 2026-08-30 cockpit
    // UX review — the badge color implied an action but never said it in
    // words). Computed once, server-side. Falls back to the AI brief's own
    // emergency read for incidents where ai_urgency was never written (the
    // live voice-brain-direct-twilio-poc path only writes decision/
    // ai_confidence, not ai_urgency — see the urgencyKeyFor comment on the
    // frontend). 'unsure' → no suggested action, the human must read and decide.
    const briefEmergency = aiBrief?.emergency_assessment?.is_emergency;
    const suggestedAction =
      incident.decision === 'emergency_dispatch' ||
      incident.ai_urgency === 'critical' ||
      briefEmergency === 'yes'
        ? 'send_company'
        : incident.decision === 'not_emergency' ||
          incident.ai_urgency === 'low' ||
          briefEmergency === 'no'
        ? 'defer_morning'
        : null;

    // Other wake-up attempts so far, for "already handled by X" display.
    const wakeups = await db.query(
      `SELECT stage, channel, result, created_at FROM wakeup_attempt WHERE incident_id = $1 ORDER BY created_at`,
      [incident.id],
    );

    // Security: cockpit links can be forwarded (single-use-per-decision and
    // 12h expiry don't stop a *view*, only a second decision). Sensitive
    // building access codes have no verification gate here by design — the
    // on-call human needs them regardless of whether the caller was verified
    // — so the mitigation is an audit trail, not a block: log every view
    // that actually exposed a code, so a leaked link is at least traceable.
    const hasSensitiveCodes = [incident.key_safe_code, incident.gate_code, incident.main_entrance_code].some(
      (v) => v != null && v !== '',
    );
    if (hasSensitiveCodes) {
      await db.query(
        `INSERT INTO incident_timeline (incident_id, event_type, event_data)
         VALUES ($1, 'cockpit.codes_viewed', $2)`,
        [incident.id, JSON.stringify({ viewerRole: tokenRow.role, viewerName: tokenRow.person_name })],
      );
    }

    const failsafeAt = new Date(
      new Date(incident.created_at).getTime() + FAILSAFE_MINUTES * 60 * 1000,
    ).toISOString();

    res.json({
      incident: {
        id: incident.id,
        category: incident.issue_category,
        description: incident.issue_description,
        aiConfidence: incident.ai_confidence,
        aiUrgency: incident.ai_urgency,
        classificationReason: incident.classification_reason,
        verificationStatus: incident.verification_status,
        // The cockpit renders in the language the CALL happened in (English
        // default until the German path ships). Not a UI toggle — the on-call
        // person is not a logged-in user with a saved preference.
        callLanguage: incident.language || 'en',
        createdAt: incident.created_at,
        failsafeAt,
        decision: incident.decision,
        nightOutcome: incident.night_outcome,
        dispatchMode: incident.dispatch_mode,
        callbackCount: incident.callback_count ?? 0,
        decidedByPerson: incident.decided_by_person,
        overrideReason: incident.override_reason,
        transcript: incident.transcript,
        guidedAnswers: labelGuidedAnswers(incident.guided_answers, incident.language),
        aiBrief,
        aiBriefMissing: !aiBrief,
      },
      caller: {
        name: incident.tenant_name || incident.tenant_name_given,
        phone: incident.tenant_phone || incident.tenant_phone_given || incident.caller_phone,
        nameGiven: incident.tenant_name_given,
        nameOnFile: incident.tenant_name,
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
      recurringPattern: {
        count: recurring.rows[0]?.count ?? 0,
        sameCategoryCount: recurring.rows[0]?.same_category_count ?? 0,
      },
      requiredTrade,
      suggestedAction,
      suggestedCompany: shapeSp(suggested),
      allCompanies: spList.rows.map(shapeSp),
      wakeupAttempts: wakeups.rows,
      fmOnCall: incident.fm_oncall_phone
        ? { name: incident.fm_oncall_name || null, phone: incident.fm_oncall_phone }
        : null,
      viewer: { role: tokenRow.role, name: tokenRow.person_name },
      alreadyDecided: incident.decision !== 'pending',
    });
  } catch (error) {
    logger.error('cockpit GET error', { error: error.message });
    res.status(500).json({ error: 'server_error' });
  }
});

const VALID_OVERRIDE_REASONS = [
  'ai_missed_a_fact',
  'ai_misjudged_severity',
  'caller_gave_more_info_after_call',
  'tier_right_tone_off',
  'other',
];

// Actions that resolve the incident (win the T+0..T+10 race). callback_tenant
// is deliberately absent — it is a holding action, not a decision.
const RESOLVING_ACTIONS = ['send_company', 'send_company_manual', 'owner_on_site', 'escalate_fm', 'defer_morning'];

/**
 * POST /api/cockpit/:token/decision
 *
 * Race-safe for the resolving actions: the UPDATE's `WHERE decision = 'pending'`
 * means only the first request to land wins; the second gets rowCount 0 and is
 * told someone already decided. callback_tenant takes a separate, non-racing
 * path — it never touches `decision`.
 */
router.post('/:token/decision', async (req, res) => {
  try {
    const { tokenRow, error } = await loadTokenContext(req.params.token);
    if (error === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error === 'expired') return res.status(410).json({ error: 'expired' });

    const { action, chosenSpId, overrideReason } = req.body;
    if (![...RESOLVING_ACTIONS, 'callback_tenant'].includes(action)) {
      return res.status(400).json({ error: 'invalid_action' });
    }
    if (overrideReason !== undefined && overrideReason !== null && !VALID_OVERRIDE_REASONS.includes(overrideReason)) {
      return res.status(400).json({ error: 'invalid_override_reason' });
    }

    const incidentResult = await db.query(
      `SELECT i.building_id, i.issue_category, i.decision, i.callback_count,
              fm.fm_oncall_name, fm.fm_oncall_phone
       FROM incident i
       LEFT JOIN building b ON i.building_id = b.id
       LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
       LEFT JOIN fm_company fm ON pm.fm_company_id = fm.id
       WHERE i.id = $1`,
      [tokenRow.incident_id],
    );
    if (incidentResult.rows.length === 0) return res.status(404).json({ error: 'incident_not_found' });
    const incident = incidentResult.rows[0];
    const decidedBy = tokenRow.person_name || tokenRow.phone;

    // ---- Holding action: call the tenant back first ------------------------
    // Does NOT resolve the incident. decision stays 'pending', the T+10
    // fail-safe stays armed. We just record it and let the human make the call.
    if (action === 'callback_tenant') {
      const upd = await db.query(
        `UPDATE incident SET callback_count = COALESCE(callback_count, 0) + 1
         WHERE id = $1 AND decision = 'pending'
         RETURNING callback_count`,
        [tokenRow.incident_id],
      );
      if (upd.rowCount === 0) {
        const already = await db.query(
          'SELECT decided_by_person, night_outcome FROM incident WHERE id = $1',
          [tokenRow.incident_id],
        );
        return res.status(409).json({
          error: 'already_decided',
          decidedByPerson: already.rows[0]?.decided_by_person,
          nightOutcome: already.rows[0]?.night_outcome,
        });
      }
      await db.query(
        `INSERT INTO incident_timeline (incident_id, event_type, event_data)
         VALUES ($1, 'cockpit.callback', $2)`,
        [tokenRow.incident_id, JSON.stringify({ by: decidedBy, role: tokenRow.role })],
      );
      return res.json({ ok: true, action, callbackCount: upd.rows[0].callback_count });
    }

    // ---- Escalate to FM: need someone to escalate to ---------------------
    if (action === 'escalate_fm' && !incident.fm_oncall_phone) {
      return res.status(422).json({ error: 'no_fm_oncall_configured' });
    }

    // ---- Resolving actions ----------------------------------------------
    const requiredTrade = determineRequiredTrade(incident.issue_category);
    let suggestedSpId = null;
    if (action === 'send_company' || action === 'send_company_manual') {
      const suggestion = await db.query(
        `SELECT sp.id FROM service_provider sp
         JOIN building_service_provider bsp ON sp.id = bsp.service_provider_id
         WHERE bsp.building_id = $1 AND sp.trade = $2 AND sp.status = 'active'
         ORDER BY bsp.priority ASC LIMIT 1`,
        [incident.building_id, requiredTrade],
      );
      suggestedSpId = suggestion.rows[0]?.id || null;
    }

    const decisionValue = {
      send_company: 'emergency_dispatch',
      send_company_manual: 'emergency_dispatch',
      owner_on_site: 'not_emergency',
      escalate_fm: 'escalated_to_fm_by_human',
      defer_morning: 'not_emergency',
    }[action];

    const nightOutcome = {
      send_company: 'dispatched',
      send_company_manual: 'dispatched_manual',
      owner_on_site: 'owner_on_site',
      escalate_fm: 'escalated_to_fm',
      defer_morning: 'deferred_morning',
    }[action];

    const dispatchMode =
      action === 'send_company' ? 'auto' : action === 'send_company_manual' ? 'manual' : null;

    const chosenSp =
      action === 'send_company' || action === 'send_company_manual'
        ? chosenSpId || suggestedSpId
        : null;

    // Race-safe: only succeeds if still 'pending'. This is the single write
    // that resolves the T+0..T+10 wake-up race between primary/backup.
    const updateResult = await db.query(
      `UPDATE incident
       SET decision = $1, decision_at = NOW(), decided_by_person = $2, decided_via = 'cockpit',
           suggested_sp_id = $3, chosen_sp_id = $4, night_outcome = $5, override_reason = $6,
           dispatch_mode = $7
       WHERE id = $8 AND decision = 'pending'
       RETURNING id`,
      [
        decisionValue,
        decidedBy,
        suggestedSpId,
        chosenSp,
        nightOutcome,
        overrideReason || null,
        dispatchMode,
        tokenRow.incident_id,
      ],
    );

    if (updateResult.rowCount === 0) {
      const already = await db.query(
        'SELECT decided_by_person, night_outcome FROM incident WHERE id = $1',
        [tokenRow.incident_id],
      );
      return res.status(409).json({
        error: 'already_decided',
        decidedByPerson: already.rows[0]?.decided_by_person,
        nightOutcome: already.rows[0]?.night_outcome,
      });
    }

    // Mark THIS token used_at — it's the one that won the decision race.
    // escalateToFM's "ring the actual decider" lookup depends on this.
    await db.query(`UPDATE cockpit_token SET used_at = NOW() WHERE id = $1`, [tokenRow.id]);

    await db.query(
      `INSERT INTO incident_timeline (incident_id, event_type, event_data)
       VALUES ($1, 'cockpit.decision', $2)`,
      [
        tokenRow.incident_id,
        JSON.stringify({
          action,
          decidedBy,
          role: tokenRow.role,
          chosenSpId: chosenSp,
          dispatchMode,
          overrideReason: overrideReason || null,
        }),
      ],
    );

    // Side effects per action.
    if (action === 'send_company') {
      startDispatch(tokenRow.incident_id, requiredTrade, chosenSp || null).catch((err) =>
        logger.error('cockpit-triggered startDispatch failed', {
          incidentId: tokenRow.incident_id,
          error: err.message,
        }),
      );
    } else if (action === 'send_company_manual') {
      // The human is phoning the SP themselves — don't run the call loop, but
      // still issue the report token + "no report = no payment" SMS so the
      // accountability loop is identical to an auto-dispatch.
      recordManualDispatch(tokenRow.incident_id, chosenSp || null, decidedBy).catch((err) =>
        logger.error('cockpit recordManualDispatch failed', {
          incidentId: tokenRow.incident_id,
          error: err.message,
        }),
      );
    } else if (action === 'escalate_fm') {
      const body =
        `On-call escalation: ${incident.issue_category || 'incident'} — the on-call person ` +
        `(${decidedBy}) needs your call. Incident ${tokenRow.incident_id}.`;
      notifyHuman({
        recipient: { name: incident.fm_oncall_name || undefined, phone: incident.fm_oncall_phone },
        purpose: 'fm_escalation',
        content: { title: 'On-call escalation', body },
        channels: ['voice_call', 'sms'],
        correlation: { incidentId: tokenRow.incident_id },
      }).catch((err) =>
        logger.error('cockpit escalate_fm notifyHuman failed', {
          incidentId: tokenRow.incident_id,
          error: err.message,
        }),
      );
    }

    // NOTE: defer_morning does not currently notify the original caller.
    // This Twilio number is voice-only (no SMS capability) — an automated
    // phone call to say "this is not an emergency" would be a worse
    // experience than the current silence. Revisit once SMS works.

    res.json({ success: true, action, nightOutcome, dispatchMode });
  } catch (error) {
    logger.error('cockpit decision error', { error: error.message });
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * POST /api/cockpit/:token/outcome — Zone 5 after-action capture
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

/**
 * POST /api/cockpit/:token/forward — Zone 4 "forward a safe brief".
 * Creates a read-only, code-stripped link the on-call person can send to an
 * SP or a colleague without leaking building access codes.
 */
router.post('/:token/forward', async (req, res) => {
  try {
    const { tokenRow, error } = await loadTokenContext(req.params.token);
    if (error === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error === 'expired') return res.status(410).json({ error: 'expired' });

    const forwardToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h, matches cockpit token

    await db.query(
      `INSERT INTO cockpit_forward_link (incident_id, token, created_by_person, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [tokenRow.incident_id, forwardToken, tokenRow.person_name || tokenRow.phone, expiresAt],
    );
    await db.query(
      `INSERT INTO incident_timeline (incident_id, event_type, event_data)
       VALUES ($1, 'cockpit.forward_created', $2)`,
      [tokenRow.incident_id, JSON.stringify({ by: tokenRow.person_name || tokenRow.phone })],
    );

    const base = process.env.FRONTEND_URL || process.env.APP_URL || '';
    res.json({ url: `${base.replace(/\/$/, '')}/cockpit/forward/${forwardToken}`, expiresAt });
  } catch (error) {
    logger.error('cockpit forward error', { error: error.message });
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
