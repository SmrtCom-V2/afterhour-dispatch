/**
 * Webhook Routes
 * Handles callbacks from telephony providers
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { getTelephonyProvider } from '../providers/telephony/index.js';
import {
  handleIncomingCall,
  handleLanguageSelection,
  handleVerification,
  handleQuestionResponse,
} from '../services/callFlow.js';
import { handleSpResponse } from '../services/dispatch.js';

const router = Router();

// Incoming call webhook (from telephony provider)
router.post('/incoming-call', async (req, res) => {
  try {
    const telephony = getTelephonyProvider();
    const callData = telephony.parseIncomingCall(req);

    logger.info('Incoming call webhook', { callData });

    const response = await handleIncomingCall(callData);

    res.type('text/xml').send(response);
  } catch (error) {
    logger.error('Incoming call webhook error', { error: error.message });
    res.status(500).send('Error processing call');
  }
});

// Language selection webhook
router.post('/call/:callId/language', async (req, res) => {
  try {
    const { callId } = req.params;
    const telephony = getTelephonyProvider();
    const { digits } = telephony.parseDtmfResponse(req);

    logger.info('Language selection', { callId, digits });

    const response = await handleLanguageSelection(callId, digits);

    res.type('text/xml').send(response);
  } catch (error) {
    logger.error('Language selection error', { error: error.message });
    res.status(500).send('Error processing selection');
  }
});

// Verification webhooks
router.post('/call/:callId/verify-name', async (req, res) => {
  try {
    const { callId } = req.params;
    const spokenInput = req.body.SpeechResult || req.body.speechResult || '';

    const response = await handleVerification(callId, 'verify-name', spokenInput);

    res.type('text/xml').send(response);
  } catch (error) {
    logger.error('Verify name error', { error: error.message });
    res.status(500).send('Error');
  }
});

router.post('/call/:callId/collect-name', async (req, res) => {
  try {
    const { callId } = req.params;
    const spokenInput = req.body.SpeechResult || req.body.speechResult || '';

    const response = await handleVerification(callId, 'collect-name', spokenInput);

    res.type('text/xml').send(response);
  } catch (error) {
    logger.error('Collect name error', { error: error.message });
    res.status(500).send('Error');
  }
});

router.post('/call/:callId/verify-address', async (req, res) => {
  try {
    const { callId } = req.params;
    const spokenInput = req.body.SpeechResult || req.body.speechResult || '';

    const response = await handleVerification(callId, 'verify-address', spokenInput);

    res.type('text/xml').send(response);
  } catch (error) {
    logger.error('Verify address error', { error: error.message });
    res.status(500).send('Error');
  }
});

router.post('/call/:callId/collect-address', async (req, res) => {
  try {
    const { callId } = req.params;
    const spokenInput = req.body.SpeechResult || req.body.speechResult || '';

    const response = await handleVerification(callId, 'collect-address', spokenInput);

    res.type('text/xml').send(response);
  } catch (error) {
    logger.error('Collect address error', { error: error.message });
    res.status(500).send('Error');
  }
});

router.post('/call/:callId/verify-address-retry', async (req, res) => {
  try {
    const { callId } = req.params;
    const spokenInput = req.body.SpeechResult || req.body.speechResult || '';

    const response = await handleVerification(callId, 'verify-address-retry', spokenInput);

    res.type('text/xml').send(response);
  } catch (error) {
    logger.error('Verify address retry error', { error: error.message });
    res.status(500).send('Error');
  }
});

// Guided question webhooks
router.post('/call/:callId/question/:questionIndex', async (req, res) => {
  try {
    const { callId, questionIndex } = req.params;
    const spokenInput = req.body.SpeechResult || req.body.speechResult || '';

    const response = await handleQuestionResponse(callId, parseInt(questionIndex), spokenInput);

    res.type('text/xml').send(response);
  } catch (error) {
    logger.error('Question response error', { error: error.message });
    res.status(500).send('Error');
  }
});

// SP Call webhooks
router.post('/sp-call/:attemptId', async (req, res) => {
  try {
    const { attemptId } = req.params;
    const telephony = getTelephonyProvider();

    // Generate the call prompt
    const attemptResult = await db.query(
      `SELECT da.*, i.issue_category, b.address as building_address, sp.company_name
       FROM dispatch_attempt da
       JOIN incident i ON da.incident_id = i.id
       LEFT JOIN building b ON i.building_id = b.id
       JOIN service_provider sp ON da.service_provider_id = sp.id
       WHERE da.id = $1`,
      [attemptId]
    );

    if (attemptResult.rows.length === 0) {
      return res.status(404).send('Attempt not found');
    }

    const attempt = attemptResult.rows[0];

    const response = telephony.generateCallResponse([
      {
        type: 'say',
        language: 'en',
        text: `Hello, this is an automated emergency dispatch call for ${attempt.company_name}. ` +
              `There is a ${attempt.issue_category?.replace('_', ' ') || 'service'} issue at ${attempt.building_address || 'a building'}. ` +
              `Press 1 to accept this job. Press 2 to decline. Remember: no report means no payment.`,
      },
      {
        type: 'gather',
        numDigits: 1,
        timeout: 15,
        webhookUrl: `/api/webhooks/sp-call/${attemptId}/response`,
      },
      {
        type: 'say',
        language: 'en',
        text: 'We did not receive a response. Goodbye.',
      },
      { type: 'hangup' },
    ]);

    res.type('text/xml').send(response);
  } catch (error) {
    logger.error('SP call webhook error', { error: error.message });
    res.status(500).send('Error');
  }
});

// SP Call DTMF response
router.post('/sp-call/:attemptId/response', async (req, res) => {
  try {
    const { attemptId } = req.params;
    const telephony = getTelephonyProvider();
    const { digits } = telephony.parseDtmfResponse(req);

    logger.info('SP call response', { attemptId, digits });

    await handleSpResponse(attemptId, null, digits);

    let responseText;
    if (digits === '1') {
      responseText = 'Thank you. You have accepted the job. You will receive a link to submit your report. Remember: no report means no payment. Goodbye.';
    } else {
      responseText = 'You have declined the job. Goodbye.';
    }

    const response = telephony.generateCallResponse([
      { type: 'say', language: 'en', text: responseText },
      { type: 'hangup' },
    ]);

    res.type('text/xml').send(response);
  } catch (error) {
    logger.error('SP call response error', { error: error.message });
    res.status(500).send('Error');
  }
});

// SP Call status callback
router.post('/sp-call/:attemptId/status', async (req, res) => {
  try {
    const { attemptId } = req.params;
    const status = req.body.CallStatus || req.body.callStatus;

    logger.info('SP call status update', { attemptId, status });

    // If call was not answered, mark as no_answer
    if (status === 'no-answer' || status === 'busy' || status === 'failed') {
      await handleSpResponse(attemptId, 'no_answer', null);
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error('SP call status error', { error: error.message });
    res.status(500).send('Error');
  }
});

// SMS response webhook (for SP acceptance via SMS)
router.post('/sms-response', async (req, res) => {
  try {
    const from = req.body.From || req.body.from;
    const body = req.body.Body || req.body.body || '';

    logger.info('SMS response received', { from, body });

    // Find pending dispatch attempt for this phone number
    const attemptResult = await db.query(
      `SELECT da.id FROM dispatch_attempt da
       JOIN service_provider sp ON da.service_provider_id = sp.id
       WHERE sp.phone = $1
         AND da.method = 'sms'
         AND da.response = 'pending'
       ORDER BY da.created_at DESC
       LIMIT 1`,
      [from]
    );

    if (attemptResult.rows.length > 0) {
      const attemptId = attemptResult.rows[0].id;
      await handleSpResponse(attemptId, body, null);
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error('SMS response error', { error: error.message });
    res.status(500).send('Error');
  }
});

export default router;
