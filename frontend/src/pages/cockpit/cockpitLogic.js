/**
 * Pure decision-funnel helpers — no React, no Vite env, no fetch. Kept
 * separate from useCockpitData.js so `node --test cockpitLogic.test.js`
 * can exercise them directly.
 */

/**
 * incident.aiUrgency is written only by the legacy web-system callFlow.js path
 * (`critical`/`unclear`, never `urgent`) and is always NULL for incidents
 * created by the live voice-brain-direct-twilio-poc path, which only writes
 * `decision`/`ai_confidence`. Deriving from `decision` (and the AI brief's
 * own emergency read) means every incident gets a real badge.
 */
export function urgencyKeyFor(incident) {
  const assess = incident?.aiBrief?.emergency_assessment?.is_emergency;
  if (assess === 'unsure') return 'unclear';
  if (incident?.aiUrgency) {
    if (incident.aiUrgency === 'critical') return 'critical';
    if (incident.aiUrgency === 'urgent') return 'urgent';
    if (incident.aiUrgency === 'unclear') return 'unclear';
    if (incident.aiUrgency === 'low') return 'low';
  }
  if (assess === 'yes') return incident.decision === 'not_emergency' ? 'urgent' : 'critical';
  if (assess === 'no') return 'low';
  if (incident?.decision === 'emergency_dispatch') return 'critical';
  if (incident?.decision === 'unclear_escalated' || incident?.decision === 'verification_failed') return 'unclear';
  if (incident?.decision === 'not_emergency') return 'low';
  return 'unclear';
}

const AI_IMPLIED_ACTION = { critical: 'send_company', low: 'defer_morning' };

/** Whether the AI's implied action disagrees with what the human chose. */
export function isOverrideOfAiSuggestion(urgencyKey, chosenAction) {
  const implied = AI_IMPLIED_ACTION[urgencyKey];
  if (!implied) return false;
  if (chosenAction === 'send_company_manual') return implied !== 'send_company';
  return implied !== chosenAction;
}

export function aiHasImpliedAction(urgencyKey) {
  return Boolean(AI_IMPLIED_ACTION[urgencyKey]);
}

/**
 * "4 minutes ago" reads faster under stress than a clock time.
 * `lang` picks the phrasing; unknown → English.
 */
export function relativeTime(isoString, lang = 'en', now = Date.now()) {
  if (!isoString) return '';
  const mins = Math.round((now - new Date(isoString).getTime()) / 60000);
  const hours = Math.round(mins / 60);
  if (lang === 'de') {
    if (mins < 1) return 'gerade eben';
    if (mins < 60) return `vor ${mins} Minute${mins === 1 ? '' : 'n'}`;
    return `vor ${hours} Stunde${hours === 1 ? '' : 'n'}`;
  }
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

/** ms until `iso`, 0 if past, null if missing. */
export function msRemaining(iso, now = Date.now()) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  return ms > 0 ? ms : 0;
}

export function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
