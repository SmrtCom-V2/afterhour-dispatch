/**
 * Shared issue-category → trade mapping for dispatch routing.
 *
 * This logic already existed in two other places (providers/voiceai's
 * determineRequiredTrade, and a third inline copy in scheduler.js's
 * pickupExternalEmergencyDispatches) — not touching those, they work.
 * This module exists so wakeupEngine.js's fail-safe dispatch doesn't add a
 * FOURTH copy. Kept in sync by hand until a real shared-package refactor
 * is worth doing.
 */
const TRADE_BY_CATEGORY = {
  water_leak: 'plumber',
  fire: 'general',
  smoke: 'general',
  gas_smell: 'general',
  total_power_outage: 'electrician',
  lockout: 'locksmith',
  other: 'general',
};

export function determineRequiredTrade(issueCategory) {
  return TRADE_BY_CATEGORY[issueCategory] || 'general';
}

export default { determineRequiredTrade };
