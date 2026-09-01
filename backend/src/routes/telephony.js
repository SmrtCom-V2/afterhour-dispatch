/**
 * Telephony / Number Provisioning Routes  (customer-facing, FM admin auth)
 * Spec: AFTERHOUR_PHONE_NUMBER_PROVISIONING_SPEC.md
 *
 * Mounted at /api/telephony behind authenticateToken + requireActiveSubscription.
 *
 *   GET  /status                 - number + state for each of my PM companies
 *   GET  /available?type=&areaCode= - list buyable numbers (preview before purchase)
 *   POST /provision              - buy a DID + bind it to one of my PM companies
 *   POST /byo-forward            - register "I'll forward my own number" for a PM company
 *   POST /verify-test-call       - trigger / confirm the end-to-end test call
 *   GET  /carriers               - per-carrier forwarding instructions (static, i18n)
 *
 * Release + provision-on-behalf-of live in the SA routes (telephonySa.js).
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { toE164, isE164 } from '../utils/phoneFormat.js';
import * as prov from '../providers/telephony/provisioning.js';
import { CARRIER_FORWARDING } from '../data/carrierForwarding.js';
import {
  syncDedicatedNumberBilling,
  isTelephonyBillingConfigured,
  DEDICATED_NUMBER_PRICE_CENTS,
} from '../services/telephonyBilling.js';

const router = Router();

// Fallback Twilio monthly cost if the pricing lookup fails (cents). Used for
// internal cost reporting only — the CUSTOMER price is the fixed
// DEDICATED_NUMBER_PRICE_CENTS (€4.99) from telephonyBilling.js, not cost+markup.
const NUMBER_COST_FALLBACK_CENTS = parseInt(process.env.TELEPHONY_NUMBER_COST_FALLBACK_CENTS || '100', 10);

/** All PM companies for the caller's FM, with telephony state. */
router.get('/status', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT pm.id, pm.name, pm.telephony_model, pm.service_phone,
              pm.service_phone_status, pm.published_number,
              pm.service_phone_verified_at, pm.forwarding_verified_at,
              pn.e164_number, pn.number_type, pn.billed_cents
       FROM pm_company pm
       LEFT JOIN provisioned_number pn
         ON pn.pm_company_id = pm.id AND pn.status = 'active'
       WHERE pm.fm_company_id = $1
       ORDER BY pm.name`,
      [req.user.fm_company_id]
    );

    const anyActive = result.rows.some((r) => r.service_phone_status === 'active');
    const anyUnassigned = result.rows.some((r) => r.service_phone_status === 'unassigned');
    res.json({
      pmCompanies: result.rows,
      allLinesReady: anyActive && result.rows.every(
        (r) => r.service_phone_status === 'active' || r.service_phone_status === 'unassigned'
      ),
      needsSetup: anyUnassigned || !anyActive,
      // provisioningAvailable = creds present AND the purchase kill-switch is
      // off. BYO-forward also needs purchase (hidden forward-target DID), so
      // both paths gate on this.
      provisioningAvailable: prov.isProvisioningAvailable() && prov.isPurchaseEnabled(),
      dedicatedNumberPriceCents: DEDICATED_NUMBER_PRICE_CENTS,
      billingConfigured: isTelephonyBillingConfigured(),
    });
  } catch (error) {
    logger.error('telephony/status error', { error: error.message });
    res.status(500).json({ error: 'Failed to load telephony status' });
  }
});

/** Preview buyable numbers. Does not reserve anything. */
router.get('/available', async (req, res) => {
  if (!prov.isProvisioningAvailable()) {
    return res.status(503).json({ error: 'Number provisioning is not available' });
  }
  try {
    const type = ['national', 'local', 'mobile', 'tollfree'].includes(req.query.type)
      ? req.query.type
      : 'national';
    const areaCode = req.query.areaCode ? String(req.query.areaCode).replace(/\D/g, '') : undefined;
    const numbers = await prov.searchAvailableNumbers({ type, areaCode, limit: 5 });
    res.json({ numbers, type });
  } catch (error) {
    logger.error('telephony/available error', { error: error.message });
    // Twilio "no numbers found" and regulatory-bundle errors both land here.
    res.status(502).json({ error: 'Could not fetch available numbers from the carrier', detail: error.message });
  }
});

/**
 * Buy a number and bind it to one of my PM companies.
 * body: { pmCompanyId, type?, areaCode?, phoneNumber? }
 *   phoneNumber optional — if given (from /available), buy that exact one;
 *   otherwise pick the first available of `type`.
 */
router.post('/provision', async (req, res) => {
  if (!prov.isProvisioningAvailable()) {
    return res.status(503).json({ error: 'Number provisioning is not available' });
  }
  if (!prov.isPurchaseEnabled()) {
    return res.status(503).json({ error: 'Number provisioning is not enabled yet — coming soon.' });
  }

  const { pmCompanyId, type = 'national', areaCode, phoneNumber } = req.body || {};
  if (!pmCompanyId) return res.status(400).json({ error: 'pmCompanyId is required' });

  try {
    // Ownership + current state check.
    const pmRes = await db.query(
      `SELECT id, name, service_phone_status FROM pm_company
       WHERE id = $1 AND fm_company_id = $2`,
      [pmCompanyId, req.user.fm_company_id]
    );
    if (pmRes.rows.length === 0) return res.status(404).json({ error: 'PM company not found' });
    const pm = pmRes.rows[0];
    if (['provisioning', 'active'].includes(pm.service_phone_status)) {
      return res.status(409).json({ error: `This PM company already has a number (${pm.service_phone_status}).` });
    }

    // Pick a number.
    let chosen = phoneNumber && isE164(phoneNumber) ? { phoneNumber: toE164(phoneNumber) } : null;
    if (!chosen) {
      const candidates = await prov.searchAvailableNumbers({ type, areaCode, limit: 1 });
      if (candidates.length === 0) {
        return res.status(502).json({ error: 'No numbers available to purchase right now' });
      }
      chosen = candidates[0];
    }

    // Buy it (Twilio).
    const bought = await prov.purchaseNumber({
      phoneNumber: chosen.phoneNumber,
      friendlyName: `AfterHour ${pm.name}`,
    });
    const e164 = toE164(bought.phoneNumber);
    const costCents = (await prov.getMonthlyCostCents(e164)) ?? NUMBER_COST_FALLBACK_CENTS;

    // Record + bind, atomically. billed_cents is the fixed customer price
    // (€4.99) — set here for display; the actual Stripe line item is synced
    // right after by syncDedicatedNumberBilling.
    await db.transaction(async (client) => {
      await client.query(
        `INSERT INTO provisioned_number
           (fm_company_id, pm_company_id, twilio_number_sid, e164_number,
            region, number_type, status, monthly_cost_cents, billed_cents)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)`,
        [req.user.fm_company_id, pmCompanyId, bought.sid, e164,
         chosen.region || (type === 'national' ? 'DE-national' : null), type,
         costCents, DEDICATED_NUMBER_PRICE_CENTS]
      );
      await client.query(
        `UPDATE pm_company
           SET service_phone = $1,
               twilio_number_sid = $2,
               telephony_model = 'provisioned',
               service_phone_status = 'provisioning'
         WHERE id = $3 AND fm_company_id = $4`,
        [e164, bought.sid, pmCompanyId, req.user.fm_company_id]
      );
    });

    // Sync the Stripe add-on line item. Best-effort — a billing hiccup must
    // not leave the customer without a working line. Deferred to checkout if
    // the customer is still on trial (no Stripe subscription yet).
    const billing = await syncDedicatedNumberBilling(req.user.fm_company_id);
    if (!billing.ok) {
      logger.warn('Dedicated-number billing sync failed after provision (non-fatal)', {
        fmCompanyId: req.user.fm_company_id, error: billing.error,
      });
    }

    logger.info('Number provisioned for PM company', {
      pmCompanyId, fmCompanyId: req.user.fm_company_id, e164, sid: bought.sid,
      billingAction: billing.action || billing.error,
    });

    res.status(201).json({
      number: e164,
      status: 'provisioning',
      monthlyBilledCents: DEDICATED_NUMBER_PRICE_CENTS,
      billing: billing.action || 'deferred',
      message: 'Number provisioned. Run a test call to activate it.',
    });
  } catch (error) {
    logger.error('telephony/provision error', { error: error.message, stack: error.stack });
    res.status(502).json({ error: 'Provisioning failed', detail: error.message });
  }
});

/**
 * Register the BYO-forward model for a PM company. We still provision a hidden
 * DID as the forward target (no separate charge), and store the customer's
 * published number for display + instructions.
 * body: { pmCompanyId, publishedNumber }
 */
router.post('/byo-forward', async (req, res) => {
  if (!prov.isProvisioningAvailable()) {
    return res.status(503).json({ error: 'Number provisioning is not available' });
  }
  if (!prov.isPurchaseEnabled()) {
    // BYO-forward still buys a hidden forward-target DID, so it's gated too.
    return res.status(503).json({ error: 'Number provisioning is not enabled yet — coming soon.' });
  }
  const { pmCompanyId, publishedNumber } = req.body || {};
  if (!pmCompanyId || !publishedNumber) {
    return res.status(400).json({ error: 'pmCompanyId and publishedNumber are required' });
  }
  if (!isE164(publishedNumber)) {
    return res.status(400).json({ error: 'publishedNumber must be a valid phone number (e.g. +49301234567)' });
  }

  try {
    const pmRes = await db.query(
      `SELECT id, name, service_phone_status FROM pm_company
       WHERE id = $1 AND fm_company_id = $2`,
      [pmCompanyId, req.user.fm_company_id]
    );
    if (pmRes.rows.length === 0) return res.status(404).json({ error: 'PM company not found' });
    const pm = pmRes.rows[0];
    if (pm.service_phone_status === 'active') {
      return res.status(409).json({ error: 'This PM company already has an active line.' });
    }

    // Provision the hidden forward-target DID.
    const candidates = await prov.searchAvailableNumbers({ type: 'national', limit: 1 });
    if (candidates.length === 0) {
      return res.status(502).json({ error: 'No numbers available to purchase right now' });
    }
    const bought = await prov.purchaseNumber({
      phoneNumber: candidates[0].phoneNumber,
      friendlyName: `AfterHour ${pm.name} (forward target)`,
    });
    const e164 = toE164(bought.phoneNumber);
    const costCents = (await prov.getMonthlyCostCents(e164)) ?? NUMBER_COST_FALLBACK_CENTS;

    await db.transaction(async (client) => {
      await client.query(
        `INSERT INTO provisioned_number
           (fm_company_id, pm_company_id, twilio_number_sid, e164_number,
            region, number_type, status, monthly_cost_cents, billed_cents)
         VALUES ($1, $2, $3, $4, 'DE-national', 'national', 'active', $5, 0)`,
        [req.user.fm_company_id, pmCompanyId, bought.sid, e164, costCents]
      );
      await client.query(
        `UPDATE pm_company
           SET service_phone = $1,
               twilio_number_sid = $2,
               published_number = $3,
               telephony_model = 'byo_forward',
               service_phone_status = 'forwarding_pending'
         WHERE id = $4 AND fm_company_id = $5`,
        [e164, bought.sid, toE164(publishedNumber), pmCompanyId, req.user.fm_company_id]
      );
    });

    res.status(201).json({
      forwardTo: e164,
      publishedNumber: toE164(publishedNumber),
      status: 'forwarding_pending',
      message: 'Set up conditional call-forwarding from your published number to the forward-to number, then run a test call.',
    });
  } catch (error) {
    logger.error('telephony/byo-forward error', { error: error.message });
    res.status(502).json({ error: 'Setup failed', detail: error.message });
  }
});

/**
 * Verify the line end to end.
 *
 * The routable DID's voice webhook is the direct-Twilio voice server, which
 * has no notion of a "test call" — so instead of a synthetic outbound call
 * that the brain would try to run a real intake on, verification is a real
 * human test call the customer places, plus automated checks:
 *
 *   1. Twilio: the number exists on our account and its voiceUrl is the
 *      correct voice entrypoint.
 *   2. DB: the routing resolver query (pm_company.service_phone -> exactly
 *      one fm_company) returns this customer, no collision.
 *   3. Human: the customer calls the number (provisioned) or their published
 *      number (byo_forward), hears the After Hour greeting, hangs up, and
 *      clicks "I heard it". That flips a real inbound `call` row check.
 *
 * POST /verify-test-call     { pmCompanyId }  -> runs 1+2, returns instructions for 3
 * POST /verify-test-call/:id/confirm-heard    -> customer confirms 3, we check for a recent inbound call
 */
router.post('/verify-test-call', async (req, res) => {
  const { pmCompanyId } = req.body || {};
  if (!pmCompanyId) return res.status(400).json({ error: 'pmCompanyId is required' });

  try {
    const pmRes = await db.query(
      `SELECT id, name, telephony_model, service_phone, published_number,
              service_phone_status, twilio_number_sid
       FROM pm_company WHERE id = $1 AND fm_company_id = $2`,
      [pmCompanyId, req.user.fm_company_id]
    );
    if (pmRes.rows.length === 0) return res.status(404).json({ error: 'PM company not found' });
    const pm = pmRes.rows[0];
    if (!pm.service_phone) return res.status(409).json({ error: 'No number assigned yet' });

    const checks = { twilioWebhook: false, routingResolves: false, detail: [] };

    // Check 1 — Twilio number config.
    try {
      const cfg = await prov.describeNumber(pm.twilio_number_sid);
      if (cfg && cfg.voiceUrl && cfg.voiceUrl.includes('/poc-voice-incoming')) {
        checks.twilioWebhook = true;
      } else {
        checks.detail.push(`Twilio voiceUrl is "${cfg?.voiceUrl || 'unset'}" — expected the voice entrypoint.`);
      }
    } catch (e) {
      checks.detail.push(`Could not read Twilio number config: ${e.message}`);
    }

    // Check 2 — routing resolver (mirror of realTools.resolveFmCompanyIdByDialedNumber).
    const routeRes = await db.query(
      `SELECT pm.fm_company_id, count(*) OVER () AS match_count
       FROM pm_company pm
       WHERE pm.service_phone = $1 AND pm.status = 'active'`,
      [pm.service_phone]
    );
    if (routeRes.rows.length === 1 && routeRes.rows[0].fm_company_id === req.user.fm_company_id) {
      checks.routingResolves = true;
    } else if (routeRes.rows.length > 1) {
      checks.detail.push(`Routing collision: ${pm.service_phone} matches ${routeRes.rows.length} PM companies.`);
    } else {
      checks.detail.push('Routing did not resolve this number to your account.');
    }

    const verifyRow = await db.query(
      `INSERT INTO telephony_verification
         (pm_company_id, model, dialed_number, resolved_fm_company_id, result, initiated_by, detail)
       VALUES ($1, $2, $3, $4, 'pending', 'customer', $5)
       RETURNING id`,
      [pmCompanyId, pm.telephony_model, pm.service_phone,
       checks.routingResolves ? req.user.fm_company_id : null,
       checks.detail.join(' ') || null]
    );

    const numberToCall = pm.telephony_model === 'byo_forward'
      ? (pm.published_number || pm.service_phone)
      : pm.service_phone;

    res.json({
      verificationId: verifyRow.rows[0].id,
      autoChecks: checks,
      instruction: pm.telephony_model === 'byo_forward'
        ? `Call ${numberToCall} from any phone. You should reach the After Hour assistant. Then click "I heard it".`
        : `Call ${numberToCall} from any phone. You should hear the After Hour assistant greeting. Then click "I heard it".`,
      numberToCall,
      autoChecksPassed: checks.twilioWebhook && checks.routingResolves,
    });
  } catch (error) {
    logger.error('telephony/verify-test-call error', { error: error.message });
    res.status(500).json({ error: 'Verification failed to start' });
  }
});

/**
 * Customer clicks "I heard it". We look for a real inbound `call` row for this
 * FM in the last 10 minutes as corroboration, then flip the line to active.
 * The inbound-call check is best-effort — if the brain didn't write a call row
 * (e.g. caller hung up during greeting) we still allow activation on the
 * customer's confirmation + passing auto-checks, but flag it in the log.
 */
router.post('/verify-test-call/:id/confirm-heard', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT tv.*, pm.service_phone, pm.name AS pm_name
       FROM telephony_verification tv
       JOIN pm_company pm ON pm.id = tv.pm_company_id
       WHERE tv.id = $1 AND pm.fm_company_id = $2`,
      [req.params.id, req.user.fm_company_id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const v = r.rows[0];

    const recentCall = await db.query(
      `SELECT id, started_at FROM call
       WHERE fm_company_id = $1 AND started_at > NOW() - INTERVAL '10 minutes'
       ORDER BY started_at DESC LIMIT 1`,
      [req.user.fm_company_id]
    );
    const sawInboundCall = recentCall.rows.length > 0;

    await db.transaction(async (client) => {
      await client.query(
        `UPDATE telephony_verification
           SET result = 'success', completed_at = NOW(),
               detail = COALESCE(detail,'') || $2
         WHERE id = $1`,
        [v.id, sawInboundCall ? ' [inbound call row seen]' : ' [confirmed by customer, no call row]']
      );
      await client.query(
        `UPDATE pm_company
           SET service_phone_status = 'active',
               service_phone_verified_at = NOW(),
               forwarding_verified_at = CASE WHEN telephony_model = 'byo_forward' THEN NOW() ELSE forwarding_verified_at END
         WHERE id = $1 AND fm_company_id = $2`,
        [v.pm_company_id, req.user.fm_company_id]
      );
    });

    logger.info('Telephony line activated', {
      pmCompanyId: v.pm_company_id, fmCompanyId: req.user.fm_company_id, sawInboundCall,
    });
    res.json({ status: 'active', sawInboundCall, message: 'Your emergency line is live.' });
  } catch (error) {
    logger.error('telephony/confirm-heard error', { error: error.message });
    res.status(500).json({ error: 'Could not confirm' });
  }
});

/** Poll a verification's result. */
router.get('/verify-test-call/:id', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT tv.id, tv.result, tv.detail, tv.model, tv.completed_at, pm.name AS pm_name
       FROM telephony_verification tv
       JOIN pm_company pm ON pm.id = tv.pm_company_id
       WHERE tv.id = $1 AND pm.fm_company_id = $2`,
      [req.params.id, req.user.fm_company_id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ verification: r.rows[0] });
  } catch (error) {
    logger.error('telephony/verify poll error', { error: error.message });
    res.status(500).json({ error: 'Failed to check verification' });
  }
});

/** Per-carrier call-forwarding instructions (static content, DE + EN). */
router.get('/carriers', (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'de';
  res.json({ lang, carriers: CARRIER_FORWARDING[lang] });
});

/**
 * Release a PM company's number (customer downgrades / no longer wants a
 * dedicated line). Releases the Twilio DID, clears routing, and drops the
 * Stripe add-on line item (or reduces quantity if the FM has others).
 * Soft-keeps the provisioned_number row as status='released' for audit.
 * body: { pmCompanyId, confirm: true }
 */
router.post('/release', async (req, res) => {
  const { pmCompanyId, confirm } = req.body || {};
  if (!pmCompanyId) return res.status(400).json({ error: 'pmCompanyId is required' });
  if (confirm !== true) {
    return res.status(400).json({ error: 'Pass confirm:true — this permanently releases the number and tenants can no longer reach it.' });
  }

  try {
    const pmRes = await db.query(
      `SELECT pm.id, pm.name, pm.twilio_number_sid, pm.telephony_model,
              pn.id AS provisioned_number_id
       FROM pm_company pm
       LEFT JOIN provisioned_number pn ON pn.pm_company_id = pm.id AND pn.status = 'active'
       WHERE pm.id = $1 AND pm.fm_company_id = $2`,
      [pmCompanyId, req.user.fm_company_id]
    );
    if (pmRes.rows.length === 0) return res.status(404).json({ error: 'PM company not found' });
    const pm = pmRes.rows[0];
    if (!pm.twilio_number_sid) return res.status(409).json({ error: 'No number to release' });

    // Release from Twilio first (best-effort — if the SID is already gone,
    // still clear our side).
    try {
      await prov.releaseNumber(pm.twilio_number_sid);
    } catch (e) {
      logger.warn('Twilio release failed (continuing to clear local state)', {
        sid: pm.twilio_number_sid, error: e.message,
      });
    }

    await db.transaction(async (client) => {
      await client.query(
        `UPDATE provisioned_number SET status = 'released', released_at = NOW()
         WHERE pm_company_id = $1 AND status = 'active'`,
        [pmCompanyId]
      );
      await client.query(
        `UPDATE pm_company
           SET service_phone = NULL,
               twilio_number_sid = NULL,
               published_number = NULL,
               telephony_model = 'provisioned',
               service_phone_status = 'released',
               service_phone_verified_at = NULL,
               forwarding_verified_at = NULL
         WHERE id = $1 AND fm_company_id = $2`,
        [pmCompanyId, req.user.fm_company_id]
      );
    });

    const billing = await syncDedicatedNumberBilling(req.user.fm_company_id);

    logger.info('Telephony line released', {
      pmCompanyId, fmCompanyId: req.user.fm_company_id, billingAction: billing.action || billing.error,
    });
    res.json({ status: 'released', billing: billing.action || 'deferred' });
  } catch (error) {
    logger.error('telephony/release error', { error: error.message });
    res.status(500).json({ error: 'Release failed', detail: error.message });
  }
});

export default router;
