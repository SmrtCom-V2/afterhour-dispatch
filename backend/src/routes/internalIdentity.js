/**
 * Internal Identity Route — implements spec §3.2-§3.5
 * (AFTERHOUR_VOICE_BRAIN_COMPLETE_PRODUCTION_SPEC_2026-08-14.md).
 *
 * Lets the direct-Twilio voice POC (a separate Node process) look up a
 * caller against real tenant/building records without ever handling
 * plaintext phone numbers or PII decryption itself — that logic (hashPhone,
 * decryptPiiFields) already exists in this repo and must not be duplicated.
 * Same trust model as internalNotify.js: shared-secret header, not a Twilio
 * signature, because the caller is our own POC, not Twilio.
 *
 * §3.1 principle enforced here, not in the POC: "verification is by
 * knowledge, not revelation" — these endpoints return only a match
 * state + minimal fields needed to greet/bind a ticket (name, id, building
 * address for repeat-back per §3.6c). They never return another tenant's
 * data, access codes, or anything not in the spec's disclosure table (§3.6).
 */
import { Router } from 'express';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { hashPhone } from '../utils/piiCrypto.js';

const router = Router();

function requireInternalAuth(req, res, next) {
  const expected = process.env.INTERNAL_NOTIFY_TOKEN; // shared with internalNotify.js — same trust boundary
  if (!expected) {
    logger.error('INTERNAL_NOTIFY_TOKEN not set — refusing all internal-identity requests (fail closed)');
    return res.status(503).json({ error: 'Internal identity not configured' });
  }
  if (req.get('X-Internal-Token') !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// POST /api/internal/identify-by-phone — spec §3.3 call-start decision tree.
// Reworked 2026-08-20: searches across ALL of the company's buildings by
// phone hash, not one pre-assumed building — one after-hours number serves
// every building a company manages (Ron's correction), so a phone match has
// to find WHICH building the tenant belongs to, same as the name+address path.
// Body: { fmCompanyId, fromNumber }
router.post('/identify-by-phone', requireInternalAuth, async (req, res) => {
  const { fmCompanyId, fromNumber } = req.body || {};
  if (!fmCompanyId || !fromNumber) {
    return res.status(400).json({ error: 'fmCompanyId and fromNumber are required' });
  }

  try {
    const hash = hashPhone(fromNumber);
    const result = await db.query(
      `SELECT t.id, t.name, t.title, t.building_id FROM tenant t
       JOIN building b ON b.id = t.building_id
       JOIN pm_company pm ON pm.id = b.pm_company_id
       WHERE pm.fm_company_id = $1 AND t.phone_hash = $2 AND t.status = 'active'`,
      [fmCompanyId, hash],
    );

    if (result.rows.length === 1) {
      // §3.3: exactly 1 active tenant on this From-number -> RECOGNIZED (§3.4)
      return res.json({ state: 'recognized', tenantId: result.rows[0].id, buildingId: result.rows[0].building_id, name: result.rows[0].name, title: result.rows[0].title });
    }
    if (result.rows.length > 1) {
      // §3.3: >1 tenants (shared/household) -> SEMI-RECOGNIZED, ask "who am I speaking with"
      return res.json({
        state: 'semi_recognized',
        candidates: result.rows.map((r) => ({ tenantId: r.id, buildingId: r.building_id, name: r.name, title: r.title })),
      });
    }
    // §3.3: no tenant match on this company's phone book -> UNKNOWN path
    // (falls through to identify-by-name-address, which handles the
    // building_not_managed hard-stop if the stated address isn't ours either).
    return res.json({ state: 'unknown' });
  } catch (error) {
    logger.error('identify-by-phone failed', { error: error.message, fmCompanyId });
    // Fail open to unknown-path, never block intake on a lookup error (§3.1: an
    // emergency/report is never blocked on verification).
    res.json({ state: 'unknown', lookupError: true });
  }
});

// Deterministic name/address scoring per spec §3.5. Small pragmatic stand-in
// for the spec's full Kölner-Phonetik/Double-Metaphone scorer — normalized
// Levenshtein similarity on the surname plus exact house-number/street match.
// Same weight shape as §3.5 (surname similarity dominant, house number
// second) so behavior direction matches even though the phonetic algorithm
// itself is simplified; revisit with a real German phonetic library if match
// quality on live calls proves this insufficient.
function normalizeName(s) {
  return String(s || '').toLowerCase().trim().replace(/\b(herr|frau|mr|mrs|ms|dr)\b\.?/g, '').trim();
}
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
function similarity(a, b) {
  const na = normalizeName(a), nb = normalizeName(b);
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}
// Bug fix 2026-08-26: two real live calls + a standalone repro proved that a
// caller saying their house number as a WORD ("Hauptstraße ten") instead of a
// numeral ("Hauptstraße 10") made extractHouseNumber() return null (its regex
// is pure-digit), which forces houseMatch to 0 in buildingScore() below and
// caps the score at streetSim * 0.5 — always under the 0.5 building_not_managed
// threshold regardless of how well the street name matches. Saying a house
// number as a word is completely normal spoken German/English, so this was
// silently rejecting a large fraction of legitimate callers. Fix: normalize
// spoken number words (English + German, 1-99 — covers the vast majority of
// real house numbers; tens/twenties/etc. compound the same way in both
// languages, e.g. "twenty-one" / "einundzwanzig") to their numeral form
// BEFORE running the digit regex. Street-name similarity logic below is
// untouched — this is scoped only to house-number extraction.
const ONES_EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS_EN = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const ONES_DE = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
  'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const TENS_DE = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
// German ones-words used as the prefix in compound numbers (21 = "einundzwanzig",
// not "einsundzwanzig") — "eins" shortens to "ein" everywhere except standalone.
const ONES_DE_PREFIX = ONES_DE.map((w, i) => (i === 1 ? 'ein' : w));

// Builds a word -> numeral lookup for 0-99 in one language. `compound(tensWord,
// onesWord)` controls word order since English and German compound differently:
// English is "tens-ones" ("twenty-one"), German is "ones-und-tens"
// ("einundzwanzig").
function buildNumberWordMap(ones, tens, tensPrefixOnes, compound) {
  const map = new Map();
  ones.forEach((w, i) => { if (w) map.set(w, i); });
  tens.forEach((w, i) => { if (w) map.set(w, i * 10); });
  for (let t = 2; t <= 9; t++) {
    if (!tens[t]) continue;
    for (let o = 1; o <= 9; o++) {
      map.set(compound(tens[t], tensPrefixOnes[o]), t * 10 + o);
    }
  }
  return map;
}

const NUMBER_WORD_MAP = new Map([
  ...buildNumberWordMap(ONES_EN, TENS_EN, ONES_EN, (tensWord, onesWord) => `${tensWord}-${onesWord}`),
  ...buildNumberWordMap(ONES_DE, TENS_DE, ONES_DE_PREFIX, (tensWord, onesWord) => `${onesWord}und${tensWord}`),
]);

// Replaces recognized EN/DE number words with their numeral form, e.g.
// "Hauptstraße ten" -> "Hauptstraße 10", "Hauptstraße einundzwanzig" -> "Hauptstraße 21".
// Word-boundary match, case-insensitive, so it doesn't clobber substrings inside
// real street names.
function normalizeSpokenNumbers(text) {
  const str = String(text || '');
  if (!str) return str;
  // Longest words first so "seventeen" isn't partially matched by "seven" etc.
  const words = [...NUMBER_WORD_MAP.keys()].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`\\b(${words.join('|')})\\b`, 'gi');
  return str.replace(pattern, (match) => String(NUMBER_WORD_MAP.get(match.toLowerCase())));
}

function extractHouseNumber(address) {
  const m = normalizeSpokenNumbers(address).match(/\d+/);
  return m ? m[0] : null;
}

// Building-address similarity, same shape as name similarity — used for the
// company-wide building match (Ron's correction 2026-08-20: one after-hours
// number serves every building a company manages, so the stated address must
// first resolve to WHICH of the company's buildings, not just score tenants
// within one pre-assumed building).
function buildingScore(statedAddress, candidateAddress) {
  const houseA = extractHouseNumber(statedAddress);
  const houseB = extractHouseNumber(candidateAddress);
  const houseMatch = houseA && houseB && houseA === houseB ? 1 : 0;
  const streetSim = similarity(
    String(statedAddress || '').replace(/\d+/g, '').trim(),
    String(candidateAddress || '').replace(/\d+/g, '').trim(),
  );
  return streetSim * 0.5 + houseMatch * 0.5;
}

// POST /api/internal/identify-by-name-address — spec §3.5 unknown-path matching,
// reworked 2026-08-20 to be address-first and company-wide (see buildingScore
// comment above). Body: { fmCompanyId, statedName, statedAddress }
router.post('/identify-by-name-address', requireInternalAuth, async (req, res) => {
  const { fmCompanyId, statedName, statedAddress } = req.body || {};
  if (!fmCompanyId || !statedName || !statedAddress) {
    return res.status(400).json({ error: 'fmCompanyId, statedName and statedAddress are required' });
  }

  try {
    // Step 1: which of THIS company's buildings does the stated address match?
    // fm_company -> pm_company -> building is the real hierarchy (see After
    // hour/CLAUDE.md's PM/FM note) — building has no direct fm_company_id.
    const buildings = await db.query(
      `SELECT b.id, b.address FROM building b
       JOIN pm_company pm ON pm.id = b.pm_company_id
       WHERE pm.fm_company_id = $1 AND b.status = 'active'`,
      [fmCompanyId],
    );

    let bestBuilding = null;
    for (const row of buildings.rows) {
      const score = buildingScore(statedAddress, row.address);
      if (!bestBuilding || score > bestBuilding.score) bestBuilding = { score, buildingId: row.id, address: row.address };
    }

    // Hard gate (Ron 2026-08-20): if the stated address doesn't match ANY
    // building this company manages, this is not a report we can act on —
    // no ticket, no incident, distinct from "unverified" (which still takes
    // the report). 0.5 threshold on the building match only, deliberately
    // looser than the tenant-name threshold below since a caller reading a
    // real street name/number off a real building is usually not lying about
    // the address itself, even if they misstate who they are.
    if (!bestBuilding || bestBuilding.score < 0.5) {
      return res.json({ state: 'building_not_managed' });
    }

    // Step 2: within that building, match the stated name against tenants.
    const tenants = await db.query(
      `SELECT id, name, title FROM tenant WHERE building_id = $1 AND status = 'active'`,
      [bestBuilding.buildingId],
    );

    let best = null;
    for (const row of tenants.rows) {
      const nameScore = similarity(statedName, row.name);
      if (!best || nameScore > best.score) best = { score: nameScore, tenantId: row.id, name: row.name, title: row.title };
    }

    if (!best || best.score < 0.55) {
      // §3.5 step 4: below 0.55 -> unverified intake, not hangup — the
      // BUILDING is real and managed by us, we just couldn't confirm which
      // tenant this is. Report is still taken (Ron: "we always take a report").
      return res.json({ state: 'unverified', buildingId: bestBuilding.buildingId, bestScore: best ? best.score : 0 });
    }
    if (best.score >= 0.80) {
      return res.json({ state: 'verified', tenantId: best.tenantId, buildingId: bestBuilding.buildingId, name: best.name, title: best.title, score: best.score });
    }
    return res.json({ state: 'verified_partial', tenantId: best.tenantId, buildingId: bestBuilding.buildingId, name: best.name, title: best.title, score: best.score });
  } catch (error) {
    logger.error('identify-by-name-address failed', { error: error.message, fmCompanyId });
    // Fail open to unverified (never block a report on a lookup error, §3.1) —
    // but this can't assert building_not_managed on an error, since we
    // genuinely don't know; unverified is the safe default here.
    res.json({ state: 'unverified', lookupError: true });
  }
});

// Named exports of the pure scoring helpers (no db/express dependency) so they
// can be unit-tested directly — added 2026-08-26 alongside the spoken-house-number
// fix so the exact repro (score before/after) is verifiable without standing up
// the full route + a mocked db.
export { normalizeSpokenNumbers, extractHouseNumber, buildingScore, similarity };

export default router;
