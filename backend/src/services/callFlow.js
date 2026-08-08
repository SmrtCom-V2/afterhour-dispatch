/**
 * Inbound Call Flow Service
 * Handles the AI-driven call flow for tenant calls
 *
 * Flow:
 * 1. Answer call, detect language (DE/EN)
 * 2. Verify tenant: phone + name + address
 * 3. Guided questions (mandatory, in order):
 *    - What is the problem?
 *    - Is there water, fire, gas smell, or no electricity?
 *    - Is anyone in danger right now?
 * 4. Classify emergency
 * 5. Decide:
 *    - Emergency → dispatch SP
 *    - Not emergency → inform + close
 *    - Unclear → notify FM on-call
 */

import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { getVoiceAIProvider, GuidedQuestions, VerificationPrompts, BusinessHoursMessages, IssueCategories, keywordBackstopDetectsEmergency } from '../providers/voiceai/index.js';
import { getTelephonyProvider } from '../providers/telephony/index.js';
import { config } from '../config/index.js';
import { resolveOnCallPerson } from './wakeupEngine.js';
import { encryptPhone, decryptPhone, hashPhone } from '../utils/piiCrypto.js';

/**
 * Live transfer (Aug 8 2026 — overrides Night Ops D1's original "AI never
 * live-transfers, always hangup + async wake-up" rule for the emergency/
 * unclear paths specifically). Caller stays on the line, we bridge in
 * tonight's on-call primary via Twilio <Dial>. If they don't pick up within
 * the timeout, Twilio hits the statusWebhookUrl below and control returns to
 * the AI to take a full message — the existing wakeupEngine ladder (T0/2/5/
 * backup/10 failsafe, unchanged) then handles getting that message to a human.
 */
const LIVE_TRANSFER_TIMEOUT_SECONDS = 20;

async function attemptLiveTransfer(callId, incidentId, buildingId, language, connectingMessage) {
  const telephony = getTelephonyProvider();
  const person = buildingId ? await resolveOnCallPerson(buildingId, 'primary') : null;

  if (!person?.phone) {
    // No on-call person configured for this building/time — same config gap
    // wakeStage already logs as no_recipient_configured. Fall through to the
    // existing hangup + async wake-up path rather than dialing nothing.
    logger.warn('Live transfer: no on-call person resolved, falling back to async wake-up', { incidentId, buildingId });
    return null;
  }

  await addTimelineEntry(incidentId, 'live_transfer_attempted', { to_role: 'primary' });

  return telephony.generateCallResponse([
    { type: 'say', language, text: connectingMessage },
    {
      type: 'dial',
      to: person.phone,
      timeoutSeconds: LIVE_TRANSFER_TIMEOUT_SECONDS,
      statusWebhookUrl: `/api/webhooks/call/${callId}/transfer-status`,
    },
  ]);
}

/**
 * Handle incoming call webhook
 */
export async function handleIncomingCall(callData) {
  const { callId, from, to } = callData;

  logger.info('Incoming call', { callId, from, to });

  // Find FM company by phone number
  const fmResult = await db.query(
    `SELECT * FROM fm_company WHERE phone_number = $1`,
    [to]
  );

  if (fmResult.rows.length === 0) {
    logger.error('No FM company found for number', { to });
    return generateHangup('Sorry, this number is not configured.');
  }

  const fmCompany = fmResult.rows[0];

  // Blocker #3 (2026-08-08 audit): Twilio retries this webhook on network
  // hiccups with the SAME CallSid. ON CONFLICT DO NOTHING + a fallback SELECT
  // (rather than a plain INSERT) means a retry replays the same response
  // instead of creating a second call + incident row and paging the on-call
  // worker twice for one phone call. See add_call_provider_id_dedupe.sql.
  // Blocker #1 (2026-08-08 audit): caller_phone/tenant_phone_given are now
  // stored encrypted (piiCrypto.js). *_hash is a deterministic HMAC of the
  // same number, written alongside so tenant lookup below can still match
  // by phone without the DB holding the plaintext.
  const callRecord = await db.query(
    `INSERT INTO call (fm_company_id, caller_phone, caller_phone_hash, call_provider_id, language)
     VALUES ($1, $2, $3, $4, 'de')
     ON CONFLICT (call_provider_id) WHERE (call_provider_id IS NOT NULL) DO NOTHING
     RETURNING id`,
    [fmCompany.id, encryptPhone(from), hashPhone(from), callId]
  );

  let internalCallId;
  let incidentId;

  if (callRecord.rows.length > 0) {
    internalCallId = callRecord.rows[0].id;

    // Try to find tenant by phone (matched via phone_hash, not the encrypted column)
    const tenantResult = await db.query(
      `SELECT t.*, b.id as building_id, b.name as building_name, b.address as building_address,
              b.ai_confidence_override
       FROM tenant t
       JOIN building b ON t.building_id = b.id
       JOIN pm_company pm ON b.pm_company_id = pm.id
       WHERE t.phone_hash = $1 AND pm.fm_company_id = $2 AND t.status = 'active'`,
      [hashPhone(from), fmCompany.id]
    );

    const possibleTenant = tenantResult.rows[0] || null;
    if (possibleTenant) possibleTenant.phone = decryptPhone(possibleTenant.phone);

    // Create incident record
    const incidentResult = await db.query(
      `INSERT INTO incident (call_id, building_id, tenant_id, tenant_phone_given, tenant_phone_given_hash, verification_status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        internalCallId,
        possibleTenant?.building_id || null,
        possibleTenant?.id || null,
        encryptPhone(from),
        hashPhone(from),
        possibleTenant ? 'pending' : 'pending',
      ]
    );
    incidentId = incidentResult.rows[0].id;

    // Add timeline entry
    await addTimelineEntry(incidentId, 'call_received', { from, to, callId });
  } else {
    // Retry of a call we've already seen — reuse the existing row instead of
    // creating a duplicate. Twilio still needs a valid TwiML response below.
    const existing = await db.query(
      `SELECT c.id as call_id, i.id as incident_id
       FROM call c LEFT JOIN incident i ON i.call_id = c.id
       WHERE c.call_provider_id = $1
       ORDER BY i.created_at DESC LIMIT 1`,
      [callId]
    );
    internalCallId = existing.rows[0]?.call_id;
    incidentId = existing.rows[0]?.incident_id;
    logger.warn('Duplicate webhook for known call_provider_id — reusing existing call/incident', {
      callId, internalCallId, incidentId,
    });
  }

  // Generate initial response - ask for language preference or start verification
  const telephony = getTelephonyProvider();

  const response = telephony.generateCallResponse([
    {
      type: 'say',
      language: 'de',
      text: 'Willkommen beim Notdienst. Welcome to the after-hours service.',
    },
    {
      type: 'gather',
      numDigits: 1,
      timeout: 5,
      prompt: 'Drücken Sie 1 für Deutsch. Press 2 for English.',
      webhookUrl: `/api/webhooks/call/${internalCallId}/language`,
    },
  ]);

  return response;
}

/**
 * Handle language selection
 */
export async function handleLanguageSelection(callId, digits) {
  const language = digits === '2' ? 'en' : 'de';

  await db.query(
    `UPDATE call SET language = $1 WHERE id = $2`,
    [language, callId]
  );

  // Get incident for this call
  const incidentResult = await db.query(
    `SELECT i.*, t.name as tenant_name, t.phone as tenant_phone, b.address as building_address
     FROM incident i
     LEFT JOIN tenant t ON i.tenant_id = t.id
     LEFT JOIN building b ON i.building_id = b.id
     WHERE i.call_id = $1`,
    [callId]
  );

  const incident = incidentResult.rows[0];
  const prompts = VerificationPrompts[language];
  const telephony = getTelephonyProvider();

  // If we found a potential tenant match, verify name
  if (incident.tenant_id) {
    return telephony.generateCallResponse([
      {
        type: 'say',
        language,
        text: prompts.askName,
      },
      {
        type: 'gather',
        input: 'speech',
        timeout: 10,
        webhookUrl: `/api/webhooks/call/${callId}/verify-name`,
        language,
      },
    ]);
  }

  // No tenant match - ask for name anyway for record
  return telephony.generateCallResponse([
    {
      type: 'say',
      language,
      text: prompts.askName,
    },
    {
      type: 'gather',
      input: 'speech',
      timeout: 10,
      webhookUrl: `/api/webhooks/call/${callId}/collect-name`,
      language,
    },
  ]);
}

/**
 * Handle tenant verification
 */
export async function handleVerification(callId, step, spokenInput) {
  const callResult = await db.query(
    `SELECT c.*, i.id as incident_id, i.tenant_id, i.building_id,
            t.name as tenant_name, t.phone as tenant_phone,
            b.address as building_address
     FROM call c
     JOIN incident i ON i.call_id = c.id
     LEFT JOIN tenant t ON i.tenant_id = t.id
     LEFT JOIN building b ON i.building_id = b.id
     WHERE c.id = $1`,
    [callId]
  );

  const callData = callResult.rows[0];
  const language = callData.language || 'de';
  const prompts = VerificationPrompts[language];
  const telephony = getTelephonyProvider();
  const voiceAI = getVoiceAIProvider();

  await appendTranscript(callId, 'Caller', spokenInput);

  switch (step) {
    case 'verify-name':
    case 'collect-name': {
      // Store provided name
      await db.query(
        `UPDATE incident SET tenant_name_given = $1 WHERE id = $2`,
        [spokenInput, callData.incident_id]
      );

      // If we have a tenant to verify against
      if (callData.tenant_id && callData.tenant_name) {
        const nameMatch = fuzzyMatch(spokenInput?.toLowerCase(), callData.tenant_name?.toLowerCase());

        if (nameMatch >= 0.7) {
          // Name matches - verify address
          await db.query(
            `UPDATE incident SET verification_status = 'partial_match' WHERE id = $1`,
            [callData.incident_id]
          );

          return telephony.generateCallResponse([
            {
              type: 'say',
              language,
              text: prompts.askAddress,
            },
            {
              type: 'gather',
              input: 'speech',
              timeout: 10,
              webhookUrl: `/api/webhooks/call/${callId}/verify-address`,
              language,
            },
          ]);
        }
      }

      // No match or no tenant - ask for address anyway
      return telephony.generateCallResponse([
        {
          type: 'say',
          language,
          text: prompts.askAddress,
        },
        {
          type: 'gather',
          input: 'speech',
          timeout: 10,
          webhookUrl: `/api/webhooks/call/${callId}/collect-address`,
          language,
        },
      ]);
    }

    case 'verify-address':
    case 'collect-address': {
      // Store provided address
      await db.query(
        `UPDATE incident SET tenant_address_given = $1 WHERE id = $2`,
        [spokenInput, callData.incident_id]
      );

      // Check address match if we have a reference
      if (callData.building_address) {
        const addressMatch = fuzzyMatch(spokenInput?.toLowerCase(), callData.building_address?.toLowerCase());

        if (addressMatch >= 0.6) {
          // Verified!
          await db.query(
            `UPDATE incident SET verification_status = 'verified' WHERE id = $1`,
            [callData.incident_id]
          );

          await addTimelineEntry(callData.incident_id, 'tenant_verified', {});

          // Move to guided questions
          return startGuidedQuestions(callId, language, 0);
        } else {
          // Address mismatch - ask for clarification (one chance)
          const clarifyResult = await db.query(
            `SELECT tenant_address_given FROM incident WHERE id = $1`,
            [callData.incident_id]
          );

          // Check if this is second attempt
          if (clarifyResult.rows[0].tenant_address_given !== spokenInput) {
            return telephony.generateCallResponse([
              {
                type: 'say',
                language,
                text: prompts.clarifyAddress,
              },
              {
                type: 'gather',
                input: 'speech',
                timeout: 10,
                webhookUrl: `/api/webhooks/call/${callId}/verify-address-retry`,
                language,
              },
            ]);
          }
        }
      }

      // Can't verify - mark as failed and escalate
      await db.query(
        `UPDATE incident SET verification_status = 'failed', decision = 'verification_failed' WHERE id = $1`,
        [callData.incident_id]
      );

      await addTimelineEntry(callData.incident_id, 'verification_failed', {});
      await escalateUnverified(callData.incident_id);

      return telephony.generateCallResponse([
        {
          type: 'say',
          language,
          text: prompts.verificationFailed,
        },
        { type: 'hangup' },
      ]);
    }

    case 'verify-address-retry': {
      // Second attempt at address
      const addressMatch = fuzzyMatch(spokenInput?.toLowerCase(), callData.building_address?.toLowerCase());

      if (addressMatch >= 0.5) {
        // Close enough on retry
        await db.query(
          `UPDATE incident SET verification_status = 'verified' WHERE id = $1`,
          [callData.incident_id]
        );

        return startGuidedQuestions(callId, language, 0);
      }

      // Still no match - fail verification
      await db.query(
        `UPDATE incident SET verification_status = 'failed', decision = 'verification_failed' WHERE id = $1`,
        [callData.incident_id]
      );

      await addTimelineEntry(callData.incident_id, 'verification_failed', { reason: 'address_mismatch' });
      await escalateUnverified(callData.incident_id);

      return telephony.generateCallResponse([
        {
          type: 'say',
          language,
          text: prompts.verificationFailed,
        },
        { type: 'hangup' },
      ]);
    }

    default:
      logger.error('Unknown verification step', { step });
      return telephony.generateCallResponse([{ type: 'hangup' }]);
  }
}

/**
 * Start guided questions flow
 */
async function startGuidedQuestions(callId, language, questionIndex) {
  const questions = GuidedQuestions[language];
  const telephony = getTelephonyProvider();

  if (questionIndex >= questions.length) {
    // All questions answered - classify
    return classifyAndDecide(callId, language);
  }

  const question = questions[questionIndex];

  return telephony.generateCallResponse([
    {
      type: 'say',
      language,
      text: question.question,
    },
    {
      type: 'gather',
      input: 'speech',
      timeout: 15,
      webhookUrl: `/api/webhooks/call/${callId}/question/${questionIndex}`,
      language,
    },
  ]);
}

/**
 * Handle guided question response
 */
export async function handleQuestionResponse(callId, questionIndex, spokenInput) {
  const callResult = await db.query(
    `SELECT c.language, i.id as incident_id, i.guided_answers
     FROM call c
     JOIN incident i ON i.call_id = c.id
     WHERE c.id = $1`,
    [callId]
  );

  const callData = callResult.rows[0];
  const language = callData.language || 'de';
  const questions = GuidedQuestions[language];
  const question = questions[questionIndex];

  await appendTranscript(callId, 'AI', question.question);
  await appendTranscript(callId, 'Caller', spokenInput);

  // Store answer
  const currentAnswers = callData.guided_answers || {};
  currentAnswers[question.id] = spokenInput;

  await db.query(
    `UPDATE incident SET guided_answers = $1 WHERE id = $2`,
    [JSON.stringify(currentAnswers), callData.incident_id]
  );

  // Move to next question
  return startGuidedQuestions(callId, language, questionIndex + 1);
}

/**
 * Classify issue and make decision
 */
async function classifyAndDecide(callId, language) {
  const callResult = await db.query(
    `SELECT c.*, i.id as incident_id, i.guided_answers, i.building_id,
            b.ai_confidence_override, fm.ai_confidence_threshold,
            fm.unknown_caller_always_emergency,
            pm.afterhours_start, pm.afterhours_end, pm.same_hours_all_days,
            pm.afterhours_by_day, pm.treat_all_as_emergency
     FROM call c
     JOIN incident i ON i.call_id = c.id
     LEFT JOIN building b ON i.building_id = b.id
     LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
     LEFT JOIN fm_company fm ON pm.fm_company_id = fm.id
     WHERE c.id = $1`,
    [callId]
  );

  if (callResult.rows.length === 0) {
    logger.error('classifyAndDecide: no incident joined to this call', { callId });
    return;
  }
  const callData = callResult.rows[0];
  const telephony = getTelephonyProvider();
  const voiceAI = getVoiceAIProvider();

  // Classify the issue
  const transcript = await db.query(
    `SELECT transcript FROM call WHERE id = $1`,
    [callId]
  );

  const classification = await voiceAI.classifyIssue(
    transcript.rows[0]?.transcript || '',
    callData.guided_answers || {}
  );

  // Risk #6: independent keyword backstop — if the LLM's own classification
  // missed an obvious emergency word the caller actually used, force
  // isEmergency/confidence rather than trusting the LLM result alone. See
  // keywordBackstopDetectsEmergency in providers/voiceai/index.js.
  if (keywordBackstopDetectsEmergency(transcript.rows[0]?.transcript || '', callData.guided_answers || {}, classification)) {
    logger.warn('Keyword backstop overrode LLM classification — forcing emergency', {
      callId, incidentId: callData.incident_id, llmResult: classification,
    });
    classification.isEmergency = true;
    classification.confidence = 100;
    classification.reason = `Keyword backstop override: ${classification.reason || 'LLM did not flag as emergency'}`;
  }

  // Determine threshold — ?? not ||, since an explicit override of 0
  // ("accept anything, never ask a human") is a valid, real setting and
  // must not be treated as unset and silently overridden.
  const threshold = callData.ai_confidence_override ??
                   callData.ai_confidence_threshold ??
                   config.app.defaultAiConfidenceThreshold;

  // Update incident with classification
  await db.query(
    `UPDATE incident SET
       issue_category = $1,
       issue_description = $2,
       ai_confidence = $3,
       classification_reason = $4,
       is_emergency = $5,
       decision_at = NOW()
     WHERE id = $6`,
    [
      classification.category,
      callData.guided_answers?.problem || null,
      classification.confidence,
      classification.reason,
      classification.isEmergency,
      callData.incident_id,
    ]
  );

  // Risk #10: link this incident to an existing recent one for the same
  // building + issue category, if any, so the wake-up ladder pages the
  // worker once per real-world issue instead of once per caller. Only
  // meaningful once issue_category is known, hence run right after the
  // classification UPDATE above, not at call-creation time.
  await linkToClusterIfMatch(callData.incident_id, callData.building_id, classification.category);

  await addTimelineEntry(callData.incident_id, 'classified', {
    category: classification.category,
    isEmergency: classification.isEmergency,
    confidence: classification.confidence,
    reason: classification.reason,
  });

  // Make decision
  if (classification.isEmergency && classification.confidence >= threshold) {
    // Business-hours gate: does this pm_company's schedule say we're
    // currently IN business hours (not after-hours)? If so, and the client
    // hasn't opted into always-triage, redirect instead of paging a human
    // for something that isn't actually after-hours. Real emergencies with
    // no building/pm_company match yet (unverified caller) always fall
    // through to the human path — see isCurrentlyAfterHours for the
    // fail-open default and fm_company.unknown_caller_always_emergency.
    const afterHoursNow = isCurrentlyAfterHours(callData);

    if (!afterHoursNow && !callData.treat_all_as_emergency) {
      await db.query(
        `UPDATE incident SET decision = 'not_emergency', status = 'closed' WHERE id = $1`,
        [callData.incident_id]
      );

      await addTimelineEntry(callData.incident_id, 'redirected_business_hours', {
        category: classification.category,
        confidence: classification.confidence,
      });

      return telephony.generateCallResponse([
        { type: 'say', language, text: BusinessHoursMessages[language] || BusinessHoursMessages.de },
        { type: 'hangup' },
      ]);
    }

    // Clear emergency — Night Ops D1: AI never dispatches directly. Set
    // ai_urgency and leave decision='pending' so the wake-up engine
    // (runs every minute, wakeupEngine.js) pages the on-call human via the
    // cockpit; a real person decides and chooses the service provider.
    // T+10 fail-safe auto-dispatches only if nobody responds at all.
    await db.query(
      `UPDATE incident SET ai_urgency = 'critical' WHERE id = $1`,
      [callData.incident_id]
    );

    await addTimelineEntry(callData.incident_id, 'classified_emergency_pending_human', {});

    const connectingMessage = language === 'de'
      ? 'Wir haben einen Notfall erkannt. Bitte bleiben Sie in der Leitung, wir verbinden Sie jetzt mit einem Mitarbeiter.'
      : 'We have identified an emergency. Please stay on the line, connecting you with a representative now.';

    const transferResponse = await attemptLiveTransfer(
      callId, callData.incident_id, callData.building_id, language, connectingMessage
    );
    if (transferResponse) return transferResponse;

    // No on-call person resolved for a live transfer — fall back to the
    // original async path (wakeupEngine ladder still pages someone).
    const emergencyMessage = language === 'de'
      ? 'Wir haben einen Notfall erkannt. Ein Mitarbeiter wird umgehend benachrichtigt. Bitte bleiben Sie ruhig.'
      : 'We have identified an emergency. A representative is being notified immediately. Please stay calm.';

    return telephony.generateCallResponse([
      { type: 'say', language, text: emergencyMessage },
      { type: 'hangup' },
    ]);

  } else if (!classification.isEmergency && classification.confidence >= threshold) {
    // Not emergency - inform and close
    await db.query(
      `UPDATE incident SET decision = 'not_emergency', status = 'closed' WHERE id = $1`,
      [callData.incident_id]
    );

    await addTimelineEntry(callData.incident_id, 'decision_not_emergency', {});

    const notEmergencyMessage = language === 'de'
      ? 'Dies wurde nicht als Notfall eingestuft. Bitte kontaktieren Sie die Hausverwaltung während der Geschäftszeiten. Auf Wiederhören.'
      : 'This has not been classified as an emergency. Please contact the property management during business hours. Goodbye.';

    return telephony.generateCallResponse([
      { type: 'say', language, text: notEmergencyMessage },
      { type: 'hangup' },
    ]);

  } else {
    // Unclear — same D1 rule applies: leave decision='pending', set
    // ai_urgency='unclear' so the wake-up engine's T+0/2/5/10 escalation
    // ladder pages a human (replaces the old one-shot SMS-only escalateUnclear,
    // which had no retry/backup/fail-safe if that single SMS was missed).
    await db.query(
      `UPDATE incident SET ai_urgency = 'unclear', status = 'escalated_to_fm' WHERE id = $1`,
      [callData.incident_id]
    );

    await addTimelineEntry(callData.incident_id, 'classified_unclear_pending_human', { confidence: classification.confidence });

    const connectingMessage = language === 'de'
      ? 'Bitte bleiben Sie in der Leitung, wir verbinden Sie jetzt mit einem Mitarbeiter.'
      : 'Please stay on the line, connecting you with a representative now.';

    const transferResponse = await attemptLiveTransfer(
      callId, callData.incident_id, callData.building_id, language, connectingMessage
    );
    if (transferResponse) return transferResponse;

    const unclearMessage = language === 'de'
      ? 'Wir leiten Ihren Anruf an einen Mitarbeiter weiter. Sie werden in Kürze zurückgerufen.'
      : 'We are forwarding your call to a representative. You will receive a callback shortly.';

    return telephony.generateCallResponse([
      { type: 'say', language, text: unclearMessage },
      { type: 'hangup' },
    ]);
  }
}

/**
 * Twilio hits this when the live-transfer <Dial> completes (answered,
 * no-answer, busy, failed). Answered: nothing to do, the call already
 * happened live. Anything else: take a full message via the AI, same as
 * the old "forwarding your call" path, so the caller isn't just dropped —
 * the existing wakeupEngine ladder then pages a human with that message.
 */
export async function handleTransferStatus(callId, dialCallStatus) {
  const telephony = getTelephonyProvider();

  const callResult = await db.query(
    `SELECT c.language, i.id as incident_id
     FROM call c JOIN incident i ON i.call_id = c.id
     WHERE c.id = $1`,
    [callId]
  );
  const callData = callResult.rows[0];
  const language = callData?.language || 'de';

  if (dialCallStatus === 'completed') {
    // Worker answered and the bridged call already ran its course.
    await addTimelineEntry(callData.incident_id, 'live_transfer_answered', {});
    return telephony.generateCallResponse([{ type: 'hangup' }]);
  }

  await addTimelineEntry(callData.incident_id, 'live_transfer_no_answer', { dialCallStatus });

  const noAnswerMessage = language === 'de'
    ? 'Der Mitarbeiter ist derzeit nicht erreichbar. Bitte teilen Sie mir kurz Ihr Anliegen mit, damit wir Sie zurückrufen können.'
    : 'The representative could not be reached right now. Please briefly describe your issue so we can call you back.';

  return telephony.generateCallResponse([
    { type: 'say', language, text: noAnswerMessage },
    {
      type: 'gather',
      input: 'speech',
      timeout: 15,
      webhookUrl: `/api/webhooks/call/${callId}/transfer-message`,
      language,
    },
  ]);
}

/**
 * Caller's message after a failed live transfer — store it and hand off to
 * the existing async wake-up ladder (wakeupEngine.js) for callback, same as
 * a normal unclear-classification incident.
 */
export async function handleTransferMessage(callId, spokenInput) {
  const callResult = await db.query(
    `SELECT c.language, i.id as incident_id
     FROM call c JOIN incident i ON i.call_id = c.id
     WHERE c.id = $1`,
    [callId]
  );
  const callData = callResult.rows[0];
  const language = callData?.language || 'de';
  const telephony = getTelephonyProvider();

  await appendTranscript(callId, 'Caller', spokenInput);

  await db.query(
    `UPDATE incident SET issue_description = COALESCE(issue_description, '') || $1,
                          ai_urgency = COALESCE(ai_urgency, 'unclear'),
                          status = 'escalated_to_fm'
     WHERE id = $2`,
    [`\n[Nachricht nach nicht erreichtem Mitarbeiter]: ${spokenInput || ''}`, callData.incident_id]
  );
  await addTimelineEntry(callData.incident_id, 'transfer_message_taken', { message: spokenInput });

  const closingMessage = language === 'de'
    ? 'Vielen Dank. Wir haben Ihre Nachricht erhalten und melden uns umgehend.'
    : 'Thank you. We have received your message and will get back to you shortly.';

  return telephony.generateCallResponse([
    { type: 'say', language, text: closingMessage },
    { type: 'hangup' },
  ]);
}

/**
 * Escalate unverified caller to FM
 */
async function escalateUnverified(incidentId) {
  const incidentResult = await db.query(
    `SELECT i.*, fm.fm_oncall_phone
     FROM incident i
     LEFT JOIN call c ON i.call_id = c.id
     LEFT JOIN fm_company fm ON c.fm_company_id = fm.id
     WHERE i.id = $1`,
    [incidentId]
  );

  const incident = incidentResult.rows[0];

  if (!incident.fm_oncall_phone) {
    logger.error('No FM on-call phone for escalation', { incidentId });
    return;
  }

  const telephony = getTelephonyProvider();

  const message = `UNVERIFIED CALLER

Phone: ${decryptPhone(incident.tenant_phone_given) || 'Unknown'}
Name given: ${incident.tenant_name_given || 'Unknown'}
Address given: ${incident.tenant_address_given || 'Unknown'}

Caller could not be verified. Please call back to assess.`;

  await telephony.sendSms(incident.fm_oncall_phone, message);
}

/**
 * Generate hangup response with message
 */
function generateHangup(message) {
  const telephony = getTelephonyProvider();
  return telephony.generateCallResponse([
    { type: 'say', language: 'en', text: message },
    { type: 'hangup' },
  ]);
}

/**
 * Add timeline entry
 */
/**
 * Risk #8 (2026-08-08 audit, promoted to primary call record once audio
 * recording (Risk #7) was dropped from scope): call.transcript existed in
 * the schema but nothing in this file ever wrote to it — only read/nulled.
 * Appends incrementally per-turn (rather than a single end-of-call write)
 * so a transcript exists even if the call drops mid-flow (crash, caller
 * hangs up unexpectedly) — there is no single "call ended" webhook on the
 * inbound Twilio TwiML flow the way voice-brain's WebSocket has an
 * `ws.on('close')` to hook (see that file's separate, already-working
 * transcript persistence via incidentService.endCallByRetellId).
 */
async function appendTranscript(callId, speaker, text) {
  if (!text) return;
  await db.query(
    `UPDATE call SET transcript = COALESCE(transcript || E'\n', '') || $1 WHERE id = $2`,
    [`${speaker}: ${text}`, callId]
  );
}

async function addTimelineEntry(incidentId, eventType, eventData) {
  await db.query(
    `INSERT INTO incident_timeline (incident_id, event_type, event_data)
     VALUES ($1, $2, $3)`,
    [incidentId, eventType, JSON.stringify(eventData)]
  );
}

const CLUSTER_WINDOW_MINUTES = 15;

/**
 * Risk #10: if another incident at the same building, same issue_category,
 * created within the last CLUSTER_WINDOW_MINUTES, is already pending and not
 * itself a linked child, link this incident to it. wakeupEngine.js's tick
 * query only pages the primary (linked_incident_id IS NULL) of a cluster —
 * see that file's WHERE clause — so 3 tenants calling about one burst pipe
 * pages the worker once, not 3 times, while still preserving every
 * individual call's own incident row/transcript for the worker to review.
 * Matching on category (not just building) is deliberate: an unrelated
 * second emergency in the same building in the same window must NOT be
 * silently swallowed into an earlier, different incident.
 */
async function linkToClusterIfMatch(incidentId, buildingId, issueCategory) {
  if (!buildingId || !issueCategory) return;

  const match = await db.query(
    `SELECT id FROM incident
     WHERE building_id = $1
       AND issue_category = $2
       AND linked_incident_id IS NULL
       AND decision = 'pending'
       AND id != $3
       AND created_at > NOW() - INTERVAL '${CLUSTER_WINDOW_MINUTES} minutes'
     ORDER BY created_at ASC
     LIMIT 1`,
    [buildingId, issueCategory, incidentId]
  );

  if (match.rows.length === 0) return;

  const primaryId = match.rows[0].id;
  await db.query(
    `UPDATE incident SET linked_incident_id = $1, linked_reason = $2 WHERE id = $3`,
    [primaryId, `Same building + issue (${issueCategory}) as an incident reported within the last ${CLUSTER_WINDOW_MINUTES} minutes`, incidentId]
  );
  await addTimelineEntry(incidentId, 'linked_to_existing_incident', { primaryIncidentId: primaryId });
  await addTimelineEntry(primaryId, 'additional_caller_linked', { linkedIncidentId: incidentId });
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Is it currently after-hours for the pm_company this call resolved to?
 *
 * callData carries the LEFT JOIN'd pm_company/fm_company columns from
 * classifyAndDecide's query — all can be NULL if the caller never matched a
 * known tenant/building (verification failed or no match at all), since at
 * that point we don't know which pm_company's schedule would even apply.
 *
 * Two client-configurable fail-open defaults (both opt-out, not opt-in,
 * because turning away a real emergency is the worse failure mode):
 * - No pm_company resolved at all -> governed by
 *   fm_company.unknown_caller_always_emergency (default true).
 * - pm_company resolved but has no schedule configured -> treat as
 *   after-hours (same reasoning, narrower case).
 */
function isCurrentlyAfterHours(callData) {
  if (!callData.building_id) {
    return callData.unknown_caller_always_emergency !== false;
  }

  if (!callData.afterhours_start || !callData.afterhours_end) {
    return true;
  }

  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 8); // 'HH:MM:SS'

  let startTime = callData.afterhours_start;
  let endTime = callData.afterhours_end;

  if (callData.same_hours_all_days === false && callData.afterhours_by_day) {
    const dayConfig = callData.afterhours_by_day[DAY_NAMES[now.getDay()]];
    if (!dayConfig || dayConfig.enabled === false) {
      return false; // explicitly disabled for today = business hours all day
    }
    startTime = dayConfig.start;
    endTime = dayConfig.end;
  }

  if (!startTime || !endTime) return true;

  // Overnight window (e.g. 18:00 -> 07:00) wraps past midnight; same-day
  // window (e.g. 00:00 -> 23:59, used for "all day") does not.
  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  }
  return currentTime >= startTime || currentTime <= endTime;
}

/**
 * Simple fuzzy match
 */
function fuzzyMatch(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  // Simple word overlap scoring
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);

  let matches = 0;
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2 || (w1.length > 3 && w2.includes(w1)) || (w2.length > 3 && w1.includes(w2))) {
        matches++;
        break;
      }
    }
  }

  return matches / Math.max(words1.length, words2.length);
}

export default {
  handleIncomingCall,
  handleLanguageSelection,
  handleVerification,
  handleQuestionResponse,
  handleTransferStatus,
  handleTransferMessage,
};
