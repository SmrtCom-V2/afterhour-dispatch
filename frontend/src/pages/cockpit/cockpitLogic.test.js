import test from 'node:test';
import assert from 'node:assert/strict';
import {
  urgencyKeyFor,
  isOverrideOfAiSuggestion,
  aiHasImpliedAction,
  relativeTime,
  msRemaining,
  formatMs,
} from './cockpitLogic.js';

test('urgencyKeyFor — AI brief "unsure" always wins', () => {
  assert.equal(
    urgencyKeyFor({ decision: 'emergency_dispatch', aiBrief: { emergency_assessment: { is_emergency: 'unsure' } } }),
    'unclear',
  );
});

test('urgencyKeyFor — legacy aiUrgency respected', () => {
  assert.equal(urgencyKeyFor({ aiUrgency: 'critical' }), 'critical');
  assert.equal(urgencyKeyFor({ aiUrgency: 'low' }), 'low');
});

test('urgencyKeyFor — derives from decision when no aiUrgency / brief', () => {
  assert.equal(urgencyKeyFor({ decision: 'emergency_dispatch' }), 'critical');
  assert.equal(urgencyKeyFor({ decision: 'not_emergency' }), 'low');
  assert.equal(urgencyKeyFor({ decision: 'unclear_escalated' }), 'unclear');
  assert.equal(urgencyKeyFor({ decision: 'pending' }), 'unclear');
});

test('urgencyKeyFor — brief "yes" on a not_emergency decision reads as urgent, not critical', () => {
  assert.equal(
    urgencyKeyFor({ decision: 'not_emergency', aiBrief: { emergency_assessment: { is_emergency: 'yes' } } }),
    'urgent',
  );
});

test('isOverrideOfAiSuggestion', () => {
  // critical → AI implies send_company
  assert.equal(isOverrideOfAiSuggestion('critical', 'send_company'), false);
  assert.equal(isOverrideOfAiSuggestion('critical', 'send_company_manual'), false);
  assert.equal(isOverrideOfAiSuggestion('critical', 'defer_morning'), true);
  // low → AI implies defer_morning
  assert.equal(isOverrideOfAiSuggestion('low', 'defer_morning'), false);
  assert.equal(isOverrideOfAiSuggestion('low', 'send_company'), true);
  // unclear → no implied action, never an override
  assert.equal(isOverrideOfAiSuggestion('unclear', 'send_company'), false);
});

test('aiHasImpliedAction', () => {
  assert.equal(aiHasImpliedAction('critical'), true);
  assert.equal(aiHasImpliedAction('low'), true);
  assert.equal(aiHasImpliedAction('unclear'), false);
  assert.equal(aiHasImpliedAction('urgent'), false);
});

test('relativeTime', () => {
  const now = new Date('2026-09-02T03:00:00Z').getTime();
  assert.equal(relativeTime('2026-09-02T02:59:40Z', now), 'just now');
  assert.equal(relativeTime('2026-09-02T02:56:00Z', now), '4 minutes ago');
  assert.equal(relativeTime('2026-09-02T02:59:00Z', now), '1 minute ago');
  assert.equal(relativeTime('2026-09-02T01:00:00Z', now), '2 hours ago');
  assert.equal(relativeTime(null, now), '');
});

test('msRemaining / formatMs — the T+10 countdown', () => {
  const now = new Date('2026-09-02T03:00:00Z').getTime();
  // call at 02:54 → failsafe at 03:04 → 4 min left
  assert.equal(msRemaining('2026-09-02T03:04:00Z', now), 4 * 60 * 1000);
  // failsafe already passed
  assert.equal(msRemaining('2026-09-02T02:55:00Z', now), 0);
  assert.equal(msRemaining(null, now), null);

  assert.equal(formatMs(4 * 60 * 1000 + 7000), '4:07');
  assert.equal(formatMs(0), '0:00');
  assert.equal(formatMs(-5000), '0:00');
  assert.equal(formatMs(59_000), '0:59');
});
