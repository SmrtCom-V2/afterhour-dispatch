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
import { getVoiceAIProvider, GuidedQuestions, VerificationPrompts, IssueCategories } from '../providers/voiceai/index.js';
import { getTelephonyProvider } from '../providers/telephony/index.js';
import { config } from '../config/index.js';
import { startDispatch } from './dispatch.js';

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

  // Create call record
  const callRecord = await db.query(
    `INSERT INTO call (fm_company_id, caller_phone, call_provider_id, language)
     VALUES ($1, $2, $3, 'de')
     RETURNING id`,
    [fmCompany.id, from, callId]
  );
  const internalCallId = callRecord.rows[0].id;

  // Try to find tenant by phone
  const tenantResult = await db.query(
    `SELECT t.*, b.id as building_id, b.name as building_name, b.address as building_address,
            b.ai_confidence_override
     FROM tenant t
     JOIN building b ON t.building_id = b.id
     JOIN pm_company pm ON b.pm_company_id = pm.id
     WHERE t.phone = $1 AND pm.fm_company_id = $2 AND t.status = 'active'`,
    [from, fmCompany.id]
  );

  const possibleTenant = tenantResult.rows[0] || null;

  // Create incident record
  const incidentResult = await db.query(
    `INSERT INTO incident (call_id, building_id, tenant_id, tenant_phone_given, verification_status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      internalCallId,
      possibleTenant?.building_id || null,
      possibleTenant?.id || null,
      from,
      possibleTenant ? 'pending' : 'pending',
    ]
  );
  const incidentId = incidentResult.rows[0].id;

  // Add timeline entry
  await addTimelineEntry(incidentId, 'call_received', { from, to, callId });

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
            b.ai_confidence_override, fm.ai_confidence_threshold
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

  await addTimelineEntry(callData.incident_id, 'classified', {
    category: classification.category,
    isEmergency: classification.isEmergency,
    confidence: classification.confidence,
    reason: classification.reason,
  });

  // Make decision
  if (classification.isEmergency && classification.confidence >= threshold) {
    // Clear emergency - dispatch SP
    await db.query(
      `UPDATE incident SET decision = 'emergency_dispatch' WHERE id = $1`,
      [callData.incident_id]
    );

    await addTimelineEntry(callData.incident_id, 'decision_emergency', {});

    // Get required trade
    const requiredTrade = voiceAI.determineRequiredTrade(classification.category);

    // Start dispatch (async)
    startDispatch(callData.incident_id, requiredTrade).catch((err) => {
      logger.error('Dispatch failed', { incidentId: callData.incident_id, error: err.message });
    });

    const emergencyMessage = language === 'de'
      ? 'Wir haben einen Notfall erkannt. Ein Techniker wird umgehend kontaktiert. Bitte bleiben Sie ruhig.'
      : 'We have identified an emergency. A technician is being contacted immediately. Please stay calm.';

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
    // Unclear - escalate to FM
    await db.query(
      `UPDATE incident SET decision = 'unclear_escalated', status = 'escalated_to_fm' WHERE id = $1`,
      [callData.incident_id]
    );

    await addTimelineEntry(callData.incident_id, 'decision_unclear', { confidence: classification.confidence });

    // Notify FM on-call
    await escalateUnclear(callData.incident_id, classification);

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

Phone: ${incident.tenant_phone_given || 'Unknown'}
Name given: ${incident.tenant_name_given || 'Unknown'}
Address given: ${incident.tenant_address_given || 'Unknown'}

Caller could not be verified. Please call back to assess.`;

  await telephony.sendSms(incident.fm_oncall_phone, message);
}

/**
 * Escalate unclear classification to FM
 */
async function escalateUnclear(incidentId, classification) {
  const incidentResult = await db.query(
    `SELECT i.*, fm.fm_oncall_phone, b.name as building_name, b.address as building_address
     FROM incident i
     LEFT JOIN building b ON i.building_id = b.id
     LEFT JOIN pm_company pm ON b.pm_company_id = pm.id
     LEFT JOIN fm_company fm ON pm.fm_company_id = fm.id
     WHERE i.id = $1`,
    [incidentId]
  );

  const incident = incidentResult.rows[0];

  if (!incident.fm_oncall_phone) {
    logger.error('No FM on-call phone for escalation', { incidentId });
    return;
  }

  const telephony = getTelephonyProvider();

  const message = `UNCLEAR INCIDENT - REVIEW NEEDED

Building: ${incident.building_name || 'Unknown'}
Address: ${incident.building_address || 'Unknown'}
Tenant: ${incident.tenant_name_given || 'Unknown'}

Issue: ${classification.category}
AI Confidence: ${classification.confidence}%
Reason: ${classification.reason}

Description: ${incident.guided_answers?.problem || 'No description'}

Please call tenant to assess: ${incident.tenant_phone_given || 'Unknown'}`;

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
async function addTimelineEntry(incidentId, eventType, eventData) {
  await db.query(
    `INSERT INTO incident_timeline (incident_id, event_type, event_data)
     VALUES ($1, $2, $3)`,
    [incidentId, eventType, JSON.stringify(eventData)]
  );
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
};
