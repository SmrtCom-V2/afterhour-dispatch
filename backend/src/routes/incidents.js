/**
 * Incidents Routes
 * View and manage incidents
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { determineRequiredTrade } from '../services/tradeMapping.js';
import { GuidedQuestions } from '../providers/voiceai/index.js';
import { decryptBuildingCodes } from './buildings.js';
import { decryptPiiFields } from '../utils/piiCrypto.js';

/**
 * Labels raw guided_answers ({problem: "...", danger_type: "..."}) with the
 * actual question text that was asked, in the call's language — so the app
 * doesn't need to duplicate GuidedQuestions client-side or guess at labels.
 */
function labelGuidedAnswers(guidedAnswers, language) {
  if (!guidedAnswers) return [];
  const questions = GuidedQuestions[language] || GuidedQuestions.de;
  return questions
    .filter((q) => guidedAnswers[q.id] !== undefined)
    .map((q) => ({ question: q.question, answer: guidedAnswers[q.id] }));
}

const router = Router();

router.use(authenticateToken);

// GET /api/incidents - List incidents for FM company
router.get('/', async (req, res) => {
  try {
    const { status, buildingId, pmCompanyId, isEmergency, dateFrom, dateTo, missingReport, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT i.*,
             b.name as building_name,
             b.address as building_address,
             pm.name as pm_company_name,
             pm.id as pm_company_id,
             sp.company_name as sp_company_name,
             (SELECT COUNT(*) FROM sp_report WHERE incident_id = i.id AND status = 'missing') as missing_report
      FROM incident i
      LEFT JOIN building b ON i.building_id = b.id
      LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
      LEFT JOIN service_provider sp ON i.assigned_sp_id = sp.id
      LEFT JOIN call c ON i.call_id = c.id
      WHERE (pm.fm_company_id = $1 OR c.fm_company_id = $1)
    `;
    const params = [req.user.fm_company_id];

    if (pmCompanyId) {
      query += ` AND pm.id = $${params.length + 1}`;
      params.push(pmCompanyId);
    }

    if (status === 'open') {
      // "open" here means the dashboard's definition (not closed / not
      // completed), matching /stats' open_incidents count — NOT a literal
      // status='open' match, since a real incident's status also moves
      // through sp_dispatched/escalated_to_fm/etc while still being "open"
      // from an operator's point of view.
      query += ` AND i.status NOT IN ('closed', 'sp_completed')`;
    } else if (status) {
      query += ` AND i.status = $${params.length + 1}`;
      params.push(status);
    }

    if (buildingId) {
      query += ` AND i.building_id = $${params.length + 1}`;
      params.push(buildingId);
    }

    if (isEmergency !== undefined) {
      query += ` AND i.is_emergency = $${params.length + 1}`;
      params.push(isEmergency === 'true');
    }

    if (dateFrom) {
      query += ` AND i.created_at >= $${params.length + 1}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND i.created_at <= $${params.length + 1}`;
      params.push(dateTo);
    }

    if (missingReport === 'true') {
      query += ` AND EXISTS (SELECT 1 FROM sp_report sr WHERE sr.incident_id = i.id AND sr.status = 'missing')`;
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) FROM incident i
      LEFT JOIN building b ON i.building_id = b.id
      LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
      LEFT JOIN call c ON i.call_id = c.id
      WHERE (pm.fm_company_id = $1 OR c.fm_company_id = $1)
    `;
    const countParams = [req.user.fm_company_id];

    if (pmCompanyId) {
      countQuery += ` AND pm.id = $${countParams.length + 1}`;
      countParams.push(pmCompanyId);
    }

    if (status === 'open') {
      countQuery += ` AND i.status NOT IN ('closed', 'sp_completed')`;
    } else if (status) {
      countQuery += ` AND i.status = $${countParams.length + 1}`;
      countParams.push(status);
    }

    const countResult = await db.query(countQuery, countParams);

    res.json({
      incidents: result.rows.map(decryptPiiFields),
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error('Error fetching incidents', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// GET /api/incidents/stats - Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const { pmCompanyId } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const companyResult = await db.query(
      `SELECT created_at FROM fm_company WHERE id = $1`,
      [req.user.fm_company_id]
    );
    const companyCreatedAt = companyResult.rows[0]?.created_at || null;

    let pmFilter = '';
    const params = [req.user.fm_company_id, today.toISOString()];

    if (pmCompanyId) {
      pmFilter = ' AND pm.id = $3';
      params.push(pmCompanyId);
    }

    const stats = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM incident i
          LEFT JOIN building b ON i.building_id = b.id
          LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
          LEFT JOIN call c ON i.call_id = c.id
          WHERE (pm.fm_company_id = $1 OR c.fm_company_id = $1)
            AND i.status NOT IN ('closed', 'sp_completed')${pmFilter}) as open_incidents,

         (SELECT COUNT(*) FROM call c2
          LEFT JOIN incident i2 ON i2.call_id = c2.id
          LEFT JOIN building b2 ON i2.building_id = b2.id
          LEFT JOIN pm_company pm2 ON b2.pm_company_id = pm2.id
          WHERE c2.fm_company_id = $1 AND c2.created_at >= $2${pmCompanyId ? ' AND pm2.id = $3' : ''}) as tonight_calls,

         (SELECT COUNT(*) FROM incident i
          LEFT JOIN building b ON i.building_id = b.id
          LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
          WHERE pm.fm_company_id = $1
            AND i.status IN ('sp_dispatched', 'sp_accepted')${pmFilter}) as sp_pending,

         (SELECT COUNT(*) FROM sp_report sr
          JOIN incident i ON sr.incident_id = i.id
          LEFT JOIN building b ON i.building_id = b.id
          LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
          WHERE pm.fm_company_id = $1 AND sr.status = 'missing'${pmFilter}) as missing_reports,

         (SELECT COUNT(*) FROM call c3
          LEFT JOIN incident i3 ON i3.call_id = c3.id
          LEFT JOIN building b3 ON i3.building_id = b3.id
          LEFT JOIN pm_company pm3 ON b3.pm_company_id = pm3.id
          WHERE c3.fm_company_id = $1 AND c3.created_at >= NOW() - INTERVAL '30 days'${pmCompanyId ? ' AND pm3.id = $3' : ''}) as month_calls`,
      params
    );

    const weekCallsParams = pmCompanyId ? [req.user.fm_company_id, pmCompanyId] : [req.user.fm_company_id];
    const weekCallsResult = await db.query(
      `SELECT
         (c.created_at AT TIME ZONE 'Europe/Berlin')::date as call_date,
         COUNT(*) as call_count
       FROM call c
       LEFT JOIN incident i ON i.call_id = c.id
       LEFT JOIN building b ON i.building_id = b.id
       LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
       WHERE c.fm_company_id = $1
         AND c.created_at >= NOW() - INTERVAL '7 days'${pmCompanyId ? ' AND pm.id = $2' : ''}
       GROUP BY call_date`,
      weekCallsParams
    );

    const dailyCallCounts = {};
    for (const row of weekCallsResult.rows) {
      dailyCallCounts[row.call_date.toISOString().slice(0, 10)] = parseInt(row.call_count, 10);
    }

    res.json({
      stats: {
        ...stats.rows[0],
        daily_call_counts: dailyCallCounts,
        company_created_at: companyCreatedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching incident stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/incidents/:id - Get single incident with full details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get incident
    const incidentResult = await db.query(
      `SELECT i.*,
              b.name as building_name, b.address as building_address,
              sp.company_name as sp_company_name, sp.phone as sp_phone,
              t.name as tenant_name, t.phone as tenant_phone, t.unit as tenant_unit,
              c.language as call_language
       FROM incident i
       LEFT JOIN building b ON i.building_id = b.id
       LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
       LEFT JOIN service_provider sp ON i.assigned_sp_id = sp.id
       LEFT JOIN tenant t ON i.tenant_id = t.id
       LEFT JOIN call c ON i.call_id = c.id
       WHERE i.id = $1 AND (pm.fm_company_id = $2 OR c.fm_company_id = $2)`,
      [id, req.user.fm_company_id]
    );

    if (incidentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Get timeline
    const timelineResult = await db.query(
      `SELECT * FROM incident_timeline
       WHERE incident_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    // Get dispatch attempts
    const dispatchResult = await db.query(
      `SELECT da.*, sp.company_name, sp.phone as sp_phone
       FROM dispatch_attempt da
       JOIN service_provider sp ON da.service_provider_id = sp.id
       WHERE da.incident_id = $1
       ORDER BY da.attempt_number`,
      [id]
    );

    // Get SP report if exists
    const reportResult = await db.query(
      `SELECT sr.*,
              (SELECT json_agg(json_build_object('id', sra.id, 'file_name', sra.file_name, 'file_path', sra.file_path))
               FROM sp_report_attachment sra WHERE sra.sp_report_id = sr.id) as attachments
       FROM sp_report sr
       WHERE sr.incident_id = $1`,
      [id]
    );

    res.json({
      incident: decryptPiiFields(incidentResult.rows[0]),
      timeline: timelineResult.rows,
      dispatchAttempts: dispatchResult.rows,
      spReport: reportResult.rows[0] || null,
    });
  } catch (error) {
    logger.error('Error fetching incident', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

/**
 * GET /api/incidents/:id/mobile-detail — read-only full ticket view for the
 * mobile app's ticket history (tapping a row in the Tickets list). Same data
 * shape as GET /api/cockpit/:token (building access info, AI confidence,
 * suggested/all service providers) plus a timeline, but auth-token scoped to
 * the logged-in admin's company instead of a one-time cockpit token — this
 * is for browsing past/current tickets after the fact, not for making a
 * decision (that only happens via the live cockpit-token call/push link,
 * same as the real 3am flow). No decision endpoints are exposed here.
 */
router.get('/:id/mobile-detail', async (req, res) => {
  try {
    const { id } = req.params;

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
       LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
       LEFT JOIN tenant t ON i.tenant_id = t.id
       LEFT JOIN call c ON i.call_id = c.id
       WHERE i.id = $1 AND pm.fm_company_id = $2`,
      [id, req.user.fm_company_id],
    );
    if (incidentResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }
    // Blocker #4/#1: decrypt before this row's code/phone fields are read anywhere below.
    const incident = decryptPiiFields(decryptBuildingCodes(incidentResult.rows[0]));

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

    const timeline = await db.query(
      `SELECT event_type, event_data, created_at FROM incident_timeline
       WHERE incident_id = $1 ORDER BY created_at ASC`,
      [id],
    );

    const wakeups = await db.query(
      `SELECT stage, channel, result, created_at FROM wakeup_attempt WHERE incident_id = $1 ORDER BY created_at`,
      [id],
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
      requiredTrade,
      suggestedCompany: suggested,
      allCompanies: spList.rows,
      wakeupAttempts: wakeups.rows,
      timeline: timeline.rows,
      alreadyDecided: incident.decision !== 'pending',
    });
  } catch (error) {
    logger.error('mobile-detail GET error', { error: error.message, incidentId: req.params.id });
    res.status(500).json({ error: 'server_error' });
  }
});

// PUT /api/incidents/:id/close - Close incident manually
router.put('/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await db.query(
      `UPDATE incident SET status = 'closed'
       WHERE id = $1
         AND id IN (
           SELECT i.id FROM incident i
           LEFT JOIN building b ON i.building_id = b.id
           LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
           LEFT JOIN call c ON i.call_id = c.id
           WHERE i.id = $1 AND (pm.fm_company_id = $2 OR c.fm_company_id = $2)
         )
       RETURNING *`,
      [id, req.user.fm_company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Add timeline entry
    await db.query(
      `INSERT INTO incident_timeline (incident_id, event_type, event_data)
       VALUES ($1, 'manually_closed', $2)`,
      [id, JSON.stringify({ reason, closed_by: req.user.email })]
    );

    logger.info('Incident closed manually', { incidentId: id, by: req.user.email });

    res.json({ incident: result.rows[0] });
  } catch (error) {
    logger.error('Error closing incident', { error: error.message });
    res.status(500).json({ error: 'Failed to close incident' });
  }
});

// POST /api/incidents/:id/translate - Translate this incident's summary into
// the requesting operator's dashboard language. Real tenant-emergency text —
// this is a live translation of a safety-relevant record, not decorative
// copy, so failures must surface clearly (never silently return the
// original re-labeled as a translation) and must never block the page: the
// frontend already has the original text and shows it regardless of whether
// this call succeeds.
router.post('/:id/translate', async (req, res) => {
  try {
    const { id } = req.params;
    const { targetLanguage } = req.body;
    const supported = ['de', 'en'];
    if (!supported.includes(targetLanguage)) {
      return res.status(400).json({ error: `targetLanguage must be one of: ${supported.join(', ')}` });
    }

    const result = await db.query(
      `SELECT i.issue_description
       FROM incident i
       LEFT JOIN building b ON i.building_id = b.id
       LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
       LEFT JOIN call c ON i.call_id = c.id
       WHERE i.id = $1 AND (pm.fm_company_id = $2 OR c.fm_company_id = $2)`,
      [id, req.user.fm_company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const original = result.rows[0].issue_description;
    if (!original) {
      return res.status(404).json({ error: 'This incident has no summary text to translate' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      logger.error('Translate requested but ANTHROPIC_API_KEY not configured');
      return res.status(503).json({ error: 'Translation is not configured on this server' });
    }

    const targetName = targetLanguage === 'de' ? 'German' : 'English';
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system:
          `Translate the given property-management incident report into ${targetName}. ` +
          `This is a factual record of a real tenant call — preserve every detail exactly ` +
          `(names, addresses, room/unit numbers, what was reported as unclear or uncertain). ` +
          `Do not add commentary, do not summarize further, do not omit anything. ` +
          `Reply with ONLY the translated text, nothing else.`,
        messages: [{ role: 'user', content: original }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      logger.error('Translation API call failed', { status: anthropicRes.status, errBody });
      return res.status(502).json({ error: 'Translation failed' });
    }

    const data = await anthropicRes.json();
    const translated = data.content?.[0]?.text?.trim();
    if (!translated) {
      logger.error('Translation API returned no text', { incidentId: id });
      return res.status(502).json({ error: 'Translation failed' });
    }

    res.json({ original, translated, targetLanguage });
  } catch (error) {
    logger.error('Error translating incident summary', { error: error.message });
    res.status(500).json({ error: 'Failed to translate summary' });
  }
});

export default router;
