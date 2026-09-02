import test from 'node:test';
import assert from 'node:assert/strict';
import STRINGS, { getStrings, missingKeys } from './cockpitStrings.js';

test('de mirrors en key-for-key', () => {
  assert.deepEqual(missingKeys(), {}, 'de is missing keys present in en');
  // and no stray keys in de that en lacks
  const enKeys = new Set(Object.keys(STRINGS.en));
  const extra = Object.keys(STRINGS.de).filter((k) => !enKeys.has(k));
  assert.deepEqual(extra, [], 'de has keys en does not');
});

test('nested objects (outcomeLabel, overrideReasons) have matching keys', () => {
  for (const nested of ['outcomeLabel', 'overrideReasons']) {
    assert.deepEqual(
      Object.keys(STRINGS.de[nested]).sort(),
      Object.keys(STRINGS.en[nested]).sort(),
      `${nested} keys differ between en and de`,
    );
  }
});

test('function-valued strings stay functions in de', () => {
  for (const [k, v] of Object.entries(STRINGS.en)) {
    if (typeof v === 'function') {
      assert.equal(typeof STRINGS.de[k], 'function', `de.${k} should be a function`);
    }
  }
});

test('getStrings falls back to en for an unknown locale', () => {
  assert.equal(getStrings('fr'), STRINGS.en);
  assert.equal(getStrings(undefined), STRINGS.en);
  assert.equal(getStrings('de'), STRINGS.de);
});

test('key formatters produce sane output', () => {
  const de = getStrings('de');
  assert.equal(de.aiConfidenceInProblem(88), 'AI ist zu 88% sicher, das Problem richtig verstanden zu haben');
  assert.equal(de.actionEscalateFm('Frank'), 'An Frank eskalieren');
  assert.equal(de.actionEscalateFm(null), 'An FM-Bereitschaft eskalieren');
  assert.equal(de.rankTag(1), '1. Wahl des Objekts');
  assert.match(de.recurringIssue(2, 'Wasserschaden'), /2\. Wasserschaden-Vorfall/);
});
