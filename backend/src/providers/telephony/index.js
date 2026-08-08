/**
 * Telephony Provider Abstraction Layer
 * Supports multiple providers: Twilio, Vonage, etc.
 * MVP: Twilio implementation
 */

import twilio from 'twilio';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

// Provider interface - all providers must implement these methods
const TelephonyInterface = {
  // Make an outbound call
  makeCall: async (to, webhookUrl, metadata) => {},

  // Send SMS
  sendSms: async (to, message) => {},

  // Parse incoming webhook (provider-specific format)
  parseIncomingCall: (req) => {},

  // Parse DTMF response
  parseDtmfResponse: (req) => {},

  // Generate TwiML/response for call flow
  generateCallResponse: (actions) => {},
};

// Twilio Provider Implementation
class TwilioProvider {
  constructor(accountSid, authToken, phoneNumber) {
    this.phoneNumber = phoneNumber;
    // Dynamic import to avoid issues if twilio not installed
    this.client = null;
    this.accountSid = accountSid;
    this.authToken = authToken;
  }

  async init() {
    this.client = twilio(this.accountSid, this.authToken);
  }

  async makeCall(to, webhookUrl, metadata = {}) {
    if (!this.client) await this.init();

    try {
      const call = await this.client.calls.create({
        to,
        from: this.phoneNumber,
        url: webhookUrl,
        statusCallback: `${webhookUrl}/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        timeout: 30, // 30 seconds to answer
        machineDetection: 'Enable',
      });

      logger.info('Outbound call initiated', { callSid: call.sid, to });
      return { success: true, callId: call.sid };
    } catch (error) {
      logger.error('Failed to make call', { error: error.message, to });
      return { success: false, error: error.message };
    }
  }

  async sendSms(to, message) {
    if (!this.client) await this.init();

    try {
      const sms = await this.client.messages.create({
        to,
        from: this.phoneNumber,
        body: message,
      });

      logger.info('SMS sent', { messageSid: sms.sid, to });
      return { success: true, messageId: sms.sid };
    } catch (error) {
      logger.error('Failed to send SMS', { error: error.message, to });
      return { success: false, error: error.message };
    }
  }

  parseIncomingCall(req) {
    return {
      callId: req.body.CallSid,
      from: req.body.From,
      to: req.body.To,
      direction: req.body.Direction,
      status: req.body.CallStatus,
    };
  }

  parseDtmfResponse(req) {
    return {
      callId: req.body.CallSid,
      digits: req.body.Digits,
    };
  }

  generateCallResponse(actions) {
    // Static top-level `twilio` import (not the dynamic import() used for
    // the client) — this method is called synchronously by webhook routes
    // that never awaited init(), so it cannot depend on lazy-initialized
    // instance state the way makeCall/sendSms can.
    const response = new twilio.twiml.VoiceResponse();

    for (const action of actions) {
      switch (action.type) {
        case 'say':
          response.say(
            {
              language: action.language === 'de' ? 'de-DE' : 'en-US',
              voice: 'Polly.Vicki', // or Polly.Hans for German male
            },
            action.text
          );
          break;

        case 'gather':
          const gather = response.gather({
            input: 'dtmf',
            numDigits: action.numDigits || 1,
            timeout: action.timeout || 10,
            action: action.webhookUrl,
            method: 'POST',
          });
          if (action.prompt) {
            gather.say(
              { language: action.language === 'de' ? 'de-DE' : 'en-US' },
              action.prompt
            );
          }
          break;

        case 'hangup':
          response.hangup();
          break;

        case 'redirect':
          response.redirect(action.url);
          break;

        case 'pause':
          response.pause({ length: action.seconds || 1 });
          break;

        case 'dial': {
          // Bridges the on-call worker's real number into this same live call.
          // callerId stays the FM company's After Hour number, not the tenant's
          // real number and not the worker's — so neither side ever sees the
          // other's actual phone number (masked transfer, per Ron's Aug 8 spec).
          const dial = response.dial({
            timeout: action.timeoutSeconds || 20,
            callerId: this.phoneNumber,
            action: action.statusWebhookUrl, // hit when the dial completes/fails, drives the no-answer fallback
            method: 'POST',
          });
          dial.number(action.to);
          break;
        }
      }
    }

    return response.toString();
  }
}

// Mock Provider for development/testing
class MockTelephonyProvider {
  constructor() {
    this.calls = [];
    this.messages = [];
  }

  async init() {}

  async makeCall(to, webhookUrl, metadata = {}) {
    const callId = `mock_call_${Date.now()}`;
    this.calls.push({ callId, to, webhookUrl, metadata, timestamp: new Date() });
    logger.info('[MOCK] Outbound call', { callId, to });
    return { success: true, callId };
  }

  async sendSms(to, message) {
    const messageId = `mock_sms_${Date.now()}`;
    this.messages.push({ messageId, to, message, timestamp: new Date() });
    logger.info('[MOCK] SMS sent', { messageId, to, message });
    return { success: true, messageId };
  }

  parseIncomingCall(req) {
    return {
      callId: req.body?.callId || 'mock_incoming',
      from: req.body?.from || '+1234567890',
      to: req.body?.to || '+0987654321',
      direction: 'inbound',
      status: 'ringing',
    };
  }

  parseDtmfResponse(req) {
    return {
      callId: req.body?.callId || 'mock_call',
      digits: req.body?.digits || '1',
    };
  }

  generateCallResponse(actions) {
    for (const action of actions) {
      if (action.type === 'dial') {
        logger.info('[MOCK] Dial (live transfer)', { to: action.to, timeoutSeconds: action.timeoutSeconds });
      }
    }
    return JSON.stringify({ actions }, null, 2);
  }
}

// Factory function
export function createTelephonyProvider() {
  const providerName = config.telephony.provider;

  switch (providerName) {
    case 'twilio':
      return new TwilioProvider(
        config.telephony.twilio.accountSid,
        config.telephony.twilio.authToken,
        config.telephony.twilio.phoneNumber
      );

    case 'mock':
    default:
      if (config.nodeEnv === 'production' && providerName !== 'mock') {
        logger.warn(`Unknown telephony provider: ${providerName}, using mock`);
      }
      return new MockTelephonyProvider();
  }
}

// Singleton instance
let telephonyProvider = null;

export function getTelephonyProvider() {
  if (!telephonyProvider) {
    telephonyProvider = createTelephonyProvider();
  }
  return telephonyProvider;
}

export default getTelephonyProvider;
