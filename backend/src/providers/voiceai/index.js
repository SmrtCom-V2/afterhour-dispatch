/**
 * Voice AI Provider Abstraction Layer
 * Supports multiple AI providers for voice understanding
 * MVP: OpenAI implementation with guided question flow
 */

import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

// Emergency classification categories
export const IssueCategories = {
  WATER_LEAK: 'water_leak',
  FIRE: 'fire',
  SMOKE: 'smoke',
  GAS_SMELL: 'gas_smell',
  TOTAL_POWER_OUTAGE: 'total_power_outage',
  LOCKOUT: 'lockout',
  OTHER: 'other',
};

// Guided questions flow (in order)
export const GuidedQuestions = {
  de: [
    {
      id: 'problem',
      question: 'Was ist das Problem?',
      required: true,
    },
    {
      id: 'danger_type',
      question: 'Gibt es Wasser, Feuer, Gasgeruch oder keinen Strom?',
      required: true,
    },
    {
      id: 'immediate_danger',
      question: 'Ist jemand in unmittelbarer Gefahr?',
      required: true,
    },
  ],
  en: [
    {
      id: 'problem',
      question: 'What is the problem?',
      required: true,
    },
    {
      id: 'danger_type',
      question: 'Is there water, fire, gas smell, or no electricity?',
      required: true,
    },
    {
      id: 'immediate_danger',
      question: 'Is anyone in danger right now?',
      required: true,
    },
  ],
};

// Tenant verification prompts
export const VerificationPrompts = {
  de: {
    askName: 'Bitte nennen Sie Ihren vollständigen Namen.',
    askAddress: 'Bitte nennen Sie Ihre Adresse.',
    askUnit: 'Welche Wohnungsnummer?',
    clarifyAddress: 'Die Adresse stimmt nicht überein. Können Sie die Adresse bitte wiederholen?',
    verificationFailed: 'Leider konnten wir Ihre Identität nicht verifizieren. Ein Mitarbeiter wird sich bei Ihnen melden.',
    verificationSuccess: 'Vielen Dank. Ihre Identität wurde bestätigt.',
  },
  en: {
    askName: 'Please state your full name.',
    askAddress: 'Please state your address.',
    askUnit: 'What is your unit number?',
    clarifyAddress: 'The address does not match. Can you please repeat the address?',
    verificationFailed: 'Unfortunately, we could not verify your identity. A representative will contact you.',
    verificationSuccess: 'Thank you. Your identity has been verified.',
  },
};

// Played and the call hung up when a call arrives during business hours
// (outside the pm_company's after-hours window) and the client hasn't
// opted into always-triage behavior.
export const BusinessHoursMessages = {
  de: 'Diese Leitung ist für Notfälle außerhalb der Geschäftszeiten. Bitte kontaktieren Sie Ihre Hausverwaltung während der Geschäftszeiten. Auf Wiederhören.',
  en: 'This line is for after-hours emergencies. Please contact your property management directly during business hours. Goodbye.',
};

// OpenAI Provider Implementation
class OpenAIVoiceProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.client = null;
  }

  async init() {
    const OpenAI = await import('openai');
    this.client = new OpenAI.default({ apiKey: this.apiKey });
  }

  /**
   * Classify the issue based on conversation
   * Returns: { category, isEmergency, confidence, reason }
   */
  async classifyIssue(conversationContext, guidedAnswers) {
    if (!this.client) await this.init();

    const systemPrompt = `You are an emergency classification AI for a facilities management company.
Based on the conversation and answers provided, classify the issue.

HARD RULES (always emergency):
- Water leak = EMERGENCY
- Fire = EMERGENCY
- Smoke = EMERGENCY
- Gas smell = EMERGENCY
- Total power outage (entire apartment or building) = EMERGENCY

NOT EMERGENCY (by default):
- Lockout (unless specifically overridden)
- Minor maintenance issues
- Noise complaints

Analyze the conversation and return a JSON object with:
- category: one of [water_leak, fire, smoke, gas_smell, total_power_outage, lockout, other]
- isEmergency: boolean
- confidence: number 0-100
- reason: brief explanation (1-2 sentences)

If unclear or conflicting information, lower the confidence score.`;

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Conversation context: ${conversationContext}\n\nGuided answers:\n${JSON.stringify(guidedAnswers, null, 2)}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Low temperature for consistent classification
      });

      const result = JSON.parse(response.choices[0].message.content);
      logger.info('Issue classified', { result });

      return {
        category: result.category || IssueCategories.OTHER,
        isEmergency: result.isEmergency || false,
        confidence: result.confidence || 50,
        reason: result.reason || 'Unable to determine',
      };
    } catch (error) {
      logger.error('Classification failed', { error: error.message });
      // Fail safe: escalate to FM
      return {
        category: IssueCategories.OTHER,
        isEmergency: false,
        confidence: 0,
        reason: 'Classification error - requires human review',
      };
    }
  }

  /**
   * Verify tenant based on provided information
   * Returns: { status: 'verified' | 'partial_match' | 'failed', matchDetails }
   */
  async verifyTenant(providedInfo, tenantRecord) {
    // Simple verification logic - no AI needed for this
    const nameMatch = this.fuzzyMatch(
      providedInfo.name?.toLowerCase(),
      tenantRecord.name?.toLowerCase()
    );
    const phoneMatch = this.normalizePhone(providedInfo.phone) ===
                       this.normalizePhone(tenantRecord.phone);
    const addressMatch = this.fuzzyMatch(
      providedInfo.address?.toLowerCase(),
      tenantRecord.address?.toLowerCase()
    );

    if (phoneMatch && nameMatch >= 0.8) {
      if (addressMatch >= 0.7) {
        return { status: 'verified', matchDetails: { nameMatch, phoneMatch, addressMatch } };
      } else {
        return { status: 'partial_match', matchDetails: { nameMatch, phoneMatch, addressMatch } };
      }
    }

    return { status: 'failed', matchDetails: { nameMatch, phoneMatch, addressMatch } };
  }

  /**
   * Determine recommended trade for the issue
   */
  determineRequiredTrade(issueCategory) {
    const tradeMapping = {
      [IssueCategories.WATER_LEAK]: 'plumber',
      [IssueCategories.FIRE]: 'general', // Call emergency services first
      [IssueCategories.SMOKE]: 'general',
      [IssueCategories.GAS_SMELL]: 'general', // Call emergency services first
      [IssueCategories.TOTAL_POWER_OUTAGE]: 'electrician',
      [IssueCategories.LOCKOUT]: 'locksmith',
      [IssueCategories.OTHER]: 'general',
    };

    return tradeMapping[issueCategory] || 'general';
  }

  // Helper: Fuzzy string matching (Levenshtein-based similarity)
  fuzzyMatch(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 1;

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - distance / maxLen;
  }

  levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/[^0-9+]/g, '');
  }
}

// Mock Provider for development
class MockVoiceAIProvider {
  async init() {}

  async classifyIssue(conversationContext, guidedAnswers) {
    // Simple keyword-based mock classification
    const context = (conversationContext + JSON.stringify(guidedAnswers)).toLowerCase();

    if (context.includes('water') || context.includes('wasser') || context.includes('leak')) {
      return { category: IssueCategories.WATER_LEAK, isEmergency: true, confidence: 90, reason: 'Water leak detected' };
    }
    if (context.includes('fire') || context.includes('feuer')) {
      return { category: IssueCategories.FIRE, isEmergency: true, confidence: 95, reason: 'Fire reported' };
    }
    if (context.includes('gas')) {
      return { category: IssueCategories.GAS_SMELL, isEmergency: true, confidence: 90, reason: 'Gas smell reported' };
    }
    if (context.includes('power') || context.includes('strom') || context.includes('electricity')) {
      return { category: IssueCategories.TOTAL_POWER_OUTAGE, isEmergency: true, confidence: 85, reason: 'Power outage' };
    }
    if (context.includes('lock') || context.includes('schlüssel')) {
      return { category: IssueCategories.LOCKOUT, isEmergency: false, confidence: 80, reason: 'Lockout - not emergency' };
    }

    return { category: IssueCategories.OTHER, isEmergency: false, confidence: 50, reason: 'Unable to classify' };
  }

  async verifyTenant(providedInfo, tenantRecord) {
    // Mock: always verify for testing
    return { status: 'verified', matchDetails: { nameMatch: 1, phoneMatch: true, addressMatch: 1 } };
  }

  determineRequiredTrade(issueCategory) {
    return new OpenAIVoiceProvider('').determineRequiredTrade(issueCategory);
  }
}

// Factory function
export function createVoiceAIProvider() {
  const providerName = config.voiceAi.provider;

  switch (providerName) {
    case 'openai':
      return new OpenAIVoiceProvider(config.voiceAi.openai.apiKey);

    case 'mock':
    default:
      if (config.nodeEnv === 'production' && providerName !== 'mock') {
        logger.warn(`Unknown voice AI provider: ${providerName}, using mock`);
      }
      return new MockVoiceAIProvider();
  }
}

// Singleton instance
let voiceAIProvider = null;

export function getVoiceAIProvider() {
  if (!voiceAIProvider) {
    voiceAIProvider = createVoiceAIProvider();
  }
  return voiceAIProvider;
}

export default getVoiceAIProvider;
