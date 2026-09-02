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
import { hashPhone, encryptPhone } from '../utils/piiCrypto.js';

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
  return String(s || '')
    .toLowerCase()
    .trim()
    // Strip a spoken lead-in phrase ("my name is X", "ich heiße X", "this is
    // X", "I'm X") so a clean name given conversationally still scores against
    // the bare record name (2026-08-31 — "my name is thomas bauer" vs "thomas
    // bauer" was scoring 0.5, under the 0.55 verify threshold). Belt-and-
    // braces: the voice brain now also passes the extracted name, this
    // catches anything that slips through.
    .replace(/^(?:my name('s| is)?|i am|i'm|this is|it'?s|mein name ist|ich hei(ß|ss)e|ich bin|hier ist|hier spricht)\s+/i, '')
    .replace(/\b(herr|frau|mr|mrs|ms|dr)\b\.?/g, '')
    .replace(/[.,!?]+$/, '')
    .trim();
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
// Anglo Soundex, 4-char code. "Dahmer" -> D560, "Dummer" -> D560 (phonetically
// equal). Good enough as a fallback for STT vowel garble on surnames; German
// names mostly survive it too (umlauts folded to base vowel first).
function soundex(s) {
  const str = String(s || '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 's')
    .replace(/[^a-z]/g, '');
  if (!str) return '';
  const code = { b: '1', f: '1', p: '1', v: '1', c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2', d: '3', t: '3', l: '4', m: '5', n: '5', r: '6' };
  const first = str[0];
  let prev = code[first] || '';
  let out = first.toUpperCase();
  for (let i = 1; i < str.length && out.length < 4; i++) {
    const c = str[i];
    const d = code[c] || '';
    if (d && d !== prev) out += d;
    // h/w don't reset the "previous code" gate; vowels do
    if (c !== 'h' && c !== 'w') prev = d;
  }
  return (out + '000').slice(0, 4);
}

// Last whitespace-delimited token = surname (good enough for "First Last" and
// "First Middle Last"; single-token names return the whole thing).
function surnameOf(name) {
  const parts = normalizeName(name).split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function similarity(a, b) {
  const na = normalizeName(a), nb = normalizeName(b);
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  let sim = 1 - dist / Math.max(na.length, nb.length);

  // Phonetic fallback (2026-09-02): STT vowel garble on a surname ("Dahmer" ->
  // "Dummer", "Meier" -> "Mayer") drags the Levenshtein ratio just under the
  // verify thresholds even when the given name matches perfectly. If the
  // GIVEN name(s) match well and the surnames are phonetically equal (same
  // Soundex), floor the score at 0.82 so it can clear the 0.80 verified gate.
  // Only fires when the non-surname part already lines up — a wrong first name
  // with a phonetically-close surname stays low.
  if (sim < 0.85) {
    const sa = surnameOf(na), sb = surnameOf(nb);
    if (sa && sb && sa !== sb && soundex(sa) === soundex(sb)) {
      const preA = na.slice(0, na.length - sa.length).trim();
      const preB = nb.slice(0, nb.length - sb.length).trim();
      const givenSim = (!preA && !preB)
        ? 1 // both single-token names, surname-only comparison
        : (preA && preB ? 1 - levenshtein(preA, preB) / Math.max(preA.length, preB.length) : 0);
      if (givenSim >= 0.8) sim = Math.max(sim, 0.82);
    }
  }
  return sim;
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
  // STT mishearing aliases (2026-08-31): Deepgram nova-3 renders a spoken
  // "ten" as "Teen" / "zen" often enough to strand a real house number.
  ['teen', 10], ['zen', 10],
]);

// Single-digit words only (0-9 EN/DE) plus "oh"/"o" for zero. Used to detect a
// caller reading a house number or postcode DIGIT BY DIGIT ("nine nine",
// "one zero one one five", "oh nine nine") and concatenate the run into one
// numeral (2026-09-02 — real transcripts: "Torstraße 99" came through as
// "ninety nine" but also as "nine nine"; postcodes are almost always spoken
// digit-by-digit). Deliberately NOT the full 0-99 map — merging must only fire
// on true single-digit tokens so "nine minutes" or "seven flights" never fuse.
const SINGLE_DIGIT_WORD = new Map([
  ['zero', 0], ['oh', 0], ['o', 0], ['nought', 0],
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
  ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9],
  // German single digits
  ['null', 0], ['eins', 1], ['ein', 1], ['zwei', 2], ['zwo', 2], ['drei', 3],
  ['vier', 4], ['fünf', 5], ['fuenf', 5], ['sechs', 6], ['sieben', 7],
  ['acht', 8], ['neun', 9],
]);

// Collapses a run of 2+ consecutive single-digit words into one numeral.
// "nine nine berlin" -> "99 berlin"; "one zero one one five" -> "10115".
// Splits on whitespace, buffers consecutive digit words, flushes the buffer
// as a joined numeral when it held 2+ (else emits the original words).
function collapseDigitRuns(text) {
  const str = String(text || '');
  if (!str.trim()) return str;
  const tokens = str.trim().split(/\s+/);
  const out = [];
  let buf = []; // [{word, digit}]
  const flush = () => {
    if (buf.length >= 2) out.push(buf.map((b) => b.digit).join(''));
    else if (buf.length === 1) out.push(buf[0].word);
    buf = [];
  };
  for (const tok of tokens) {
    const bare = tok.toLowerCase().replace(/[.,!?;:]+$/, '');
    if (SINGLE_DIGIT_WORD.has(bare)) {
      buf.push({ word: tok, digit: SINGLE_DIGIT_WORD.get(bare) });
    } else {
      flush();
      out.push(tok);
    }
  }
  flush();
  return out.join(' ');
}

// Collapses a run of 3+ single-letter tokens ("T o r s t r") into one word
// ("torstr") — a caller spelling out a street name letter by letter, common
// when STT keeps failing on the street (2026-09-02, real transcript:
// "Tor StraÃŸe T o r s t r"). Only fires on 3+ so ordinary initials
// ("J P Morgan") aren't fused into gibberish.
function collapseLetterRuns(text) {
  const str = String(text || '');
  if (!str) return str;
  return str.replace(/\b([a-zäöüß])(\s+[a-zäöüß]){2,}\b/gi, (match) => match.replace(/\s+/g, ''));
}

// Replaces recognized EN/DE number words with their numeral form, e.g.
// "Hauptstraße ten" -> "Hauptstraße 10", "Hauptstraße einundzwanzig" -> "Hauptstraße 21".
// Word-boundary match, case-insensitive, so it doesn't clobber substrings inside
// real street names. Runs digit-run and letter-run collapsing first so
// "nine nine" / "T o r s t r" are handled before the word map.
function normalizeSpokenNumbers(text) {
  let str = String(text || '');
  if (!str) return str;
  str = collapseLetterRuns(str);
  str = collapseDigitRuns(str);
  // STT often renders a compound number as two space-separated words
  // ("ninety nine", "einund zwanzig") instead of the hyphenated / joined form
  // the word map keys on. Re-join an EN "<tens> <ones>" pair and a DE
  // "<ones>und <tens>" / "<ones> und <tens>" pair before mapping.
  str = str.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/gi,
    (_m, t, o) => `${t}-${o}`);
  str = str.replace(/\b(ein|eins|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun)\s*und\s*(zwanzig|dreißig|dreissig|vierzig|fünfzig|fuenfzig|sechzig|siebzig|achtzig|neunzig)\b/gi,
    (_m, o, t) => `${o === 'eins' ? 'ein' : o}und${t.replace('dreissig', 'dreißig').replace('fuenfzig', 'fünfzig')}`);
  // Longest words first so "seventeen" isn't partially matched by "seven" etc.
  const words = [...NUMBER_WORD_MAP.keys()].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`\\b(${words.join('|')})\\b`, 'gi');
  return str.replace(pattern, (match) => String(NUMBER_WORD_MAP.get(match.toLowerCase())));
}

function extractHouseNumber(address) {
  const m = normalizeSpokenNumbers(address).match(/\d+/);
  return m ? m[0] : null;
}

// --- Street-token extraction + fuzzy matching (2026-09-02) -------------------
// The old buildingScore ran raw normalized-Levenshtein on the whole stripped
// address string. On STT-garbled input that tanks: real transcripts had
// "TorstraÃŸe 99, Berlin" delivered as "tolstock at ninety nine in berlin" /
// "por street ninety nine" — similarity("tolstock at ninety nine in berlin",
// "torstr") ~ 0 after digit strip, so a legitimate tenant got hard-rejected
// with "this building isn't managed by us". Fix: isolate the STREET TOKEN on
// each side, strip filler, and score it with Levenshtein OR a bigram-dice /
// shared-prefix bonus so "torstr" vs "Torstr" and "tolstock" vs "torstrasse"
// get partial credit. House number stays a hard 0.5 weight.

const STREET_SUFFIX_RE =
  /(stra(ß|ss)e|str|platz|allee|weg|gasse|ring|damm|ufer|chaussee|steig|pfad|hof|markt|street|road|avenue|lane|drive|court)$/i;

// Filler tokens that are never the street name: prepositions, articles, filler
// nouns, city names, and anything that's just digits (house no / postcode).
const ADDR_STOPWORDS = new Set([
  'at', 'in', 'on', 'the', 'a', 'an', 'number', 'no', 'nr', 'house', 'building',
  'apartment', 'apt', 'flat', 'floor', 'and', 'of', 'near', 'by', 'to',
  'an', 'der', 'die', 'das', 'im', 'am', 'bei', 'nummer', 'haus', 'hausnummer',
  'wohnung', 'stock', 'etage', 'und',
  'berlin', 'hamburg', 'münchen', 'muenchen', 'köln', 'koeln', 'frankfurt',
  'stuttgart', 'düsseldorf', 'duesseldorf', 'leipzig', 'dortmund', 'essen',
  'bremen', 'dresden', 'hannover', 'nuremberg', 'nürnberg', 'nuernberg',
  'germany', 'deutschland', 'mitte', 'kreuzberg', 'neukölln', 'neukoelln',
  'charlottenburg', 'prenzlauer', 'berg', 'friedrichshain', 'wedding',
]);

// Normalize a token for comparison: lowercase, drop ß/umlaut distinctions and
// punctuation. "Torstraße" -> "torstrasse", "Torstr." -> "torstr".
function normStreetToken(tok) {
  return String(tok || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/[^a-z0-9]/g, '');
}

// Pull the street token out of an address string. Priority:
//  1. a token that ends in a known street suffix (straÃŸe|str|platz|...)
//  2. a token that CONTAINS a suffix as a substring (STT: "torstr" inside a blob)
//  3. otherwise the longest non-stopword alpha token
// Returns a normalized (ascii, no-space) form ready for fuzzy comparison.
function extractStreetToken(address) {
  const collapsed = normalizeSpokenNumbers(String(address || '')); // letter-run collapse, digit-run collapse
  const rawTokens = collapsed.split(/[\s,]+/).filter(Boolean);
  const alphaTokens = rawTokens.filter((t) => /[a-zäöüß]/i.test(t));
  const meaningful = alphaTokens.filter((t) => !ADDR_STOPWORDS.has(t.toLowerCase().replace(/[.]/g, '')));

  // 1: exact suffix match (on the normalized token so "Torstraße" / "Torstr." hit)
  for (const t of meaningful) {
    if (STREET_SUFFIX_RE.test(normStreetToken(t))) return normStreetToken(t);
  }
  // 1b: a two-word "Tor Straße" — join adjacent meaningful tokens where the 2nd is a bare suffix
  for (let i = 0; i < meaningful.length - 1; i++) {
    const joined = normStreetToken(meaningful[i]) + normStreetToken(meaningful[i + 1]);
    if (STREET_SUFFIX_RE.test(joined)) return joined;
  }
  // 2: suffix appears as a substring inside a token
  for (const t of meaningful) {
    const n = normStreetToken(t);
    if (/(strasse|str|platz|allee|weg|gasse|ring|damm|ufer|chaussee|street|road|avenue|lane)/.test(n) && n.length >= 4) {
      return n;
    }
  }
  // 3: longest meaningful token, else longest alpha token, else ''
  const pool = meaningful.length ? meaningful : alphaTokens;
  if (!pool.length) return '';
  return normStreetToken(pool.reduce((a, b) => (b.length > a.length ? b : a)));
}

// Sørensen–Dice coefficient on character bigrams — robust to insertions/
// transpositions that wreck Levenshtein ratio ("tolstock" vs "torstrasse"
// share "to","st" -> ~0.3; "torstr" vs "torstrasse" -> ~0.73).
function diceBigram(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bg = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };
  const ma = bg(a), mb = bg(b);
  let overlap = 0;
  for (const [g, ca] of ma) {
    const cb = mb.get(g) || 0;
    overlap += Math.min(ca, cb);
  }
  return (2 * overlap) / (a.length - 1 + b.length - 1);
}

// Longest shared prefix length between two strings.
function sharedPrefixLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

// Fuzzy street-token score in [0,1]: the best of
//  (a) normalized Levenshtein similarity,
//  (b) Dice bigram coefficient,
//  (c) a shared-prefix bonus (one being a prefix of the other -> strong;
//      3+ shared leading chars -> partial credit),
//  (d) full containment (one token fully inside the other).
function streetTokenScore(stated, candidate) {
  const a = normStreetToken(stated);
  const b = normStreetToken(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  const dice = diceBigram(a, b);

  const pfx = sharedPrefixLen(a, b);
  const shorter = Math.min(a.length, b.length);
  let prefixScore = 0;
  if (pfx === shorter) prefixScore = 0.9;            // "torstr" is a prefix of "torstrasse"
  else if (pfx >= 4) prefixScore = 0.55 + Math.min(0.3, (pfx - 4) * 0.08);
  else if (pfx === 3) prefixScore = 0.45;

  let containScore = 0;
  if (a.length >= 4 && b.includes(a)) containScore = 0.85;
  else if (b.length >= 4 && a.includes(b)) containScore = 0.85;

  return Math.max(lev, dice, prefixScore, containScore);
}

// Building-address similarity, same shape as name similarity — used for the
// company-wide building match (Ron's correction 2026-08-20: one after-hours
// number serves every building a company manages, so the stated address must
// first resolve to WHICH of the company's buildings, not just score tenants
// within one pre-assumed building).
//
// score = streetTokenScore * 0.5 + houseMatch * 0.5, with one guard: a matching
// house number must NOT by itself carry a building over the 0.5 gate when the
// street name is clearly a different one. Berlin has many "<something>straße 99"
// buildings; without this guard any same-number building in the company's
// portfolio would falsely resolve as "your building". So if the house number
// matches but the street score is below a weak-similarity floor (0.30 — enough
// to admit STT garble like "tolstock"/"por street" ~0.36-0.40 vs "torstr", but
// not an unrelated street ~0.13-0.27), the street contribution is zeroed,
// dropping the total to 0.5-ε and forcing a re-ask rather than a false match.
const STREET_GARBLE_FLOOR = 0.30;

function buildingScore(statedAddress, candidateAddress) {
  const houseA = extractHouseNumber(statedAddress);
  const houseB = extractHouseNumber(candidateAddress);
  const houseMatch = houseA && houseB && houseA === houseB ? 1 : 0;

  let streetSim = streetTokenScore(
    extractStreetToken(statedAddress),
    extractStreetToken(candidateAddress),
  );

  if (houseMatch && streetSim < STREET_GARBLE_FLOOR) {
    // house number coincides but the street is not even a garbled version of
    // this one -> don't let the number alone clear the gate. Scale the street
    // score into [0, 0.49) so ordering between candidates is still meaningful
    // but none of them can clear the 0.5 building_not_managed threshold.
    return (streetSim / STREET_GARBLE_FLOOR) * 0.49;
  }

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

// POST /api/internal/bind-phone — remember a first-time caller's number so
// their NEXT call takes the recognized path (2026-08-31, Ron's request:
// "after his name and address were verified once, the next time he calls he
// won't have to go through the whole verification again").
//
// Called by the voice POC ONLY on a high-confidence name+address match
// (identify-by-name-address returned state:'verified', score >= 0.80). Never
// on verified_partial / unverified — a weak match must not bind a phone
// number to the wrong tenant record.
//
// Deliberately narrow: only fills an EMPTY phone_hash. It never overwrites a
// number already on the tenant record (the company's own onboarding data is
// authoritative — if the caller ID doesn't match what the company entered,
// that's a data question for a human, not something to auto-correct), and it
// only touches phone_hash / phone, not secondary_phone (identify-by-phone
// only matches against phone_hash, so writing anywhere else would be a
// no-op for recognition anyway).
//
// Safety rules, in order:
//  - tenant must exist, be active, and belong to this fmCompanyId
//  - tenant's phone_hash already == this        -> no-op (already remembered)
//  - this number-hash already recognizes a DIFFERENT active tenant in the
//    company                                     -> refuse (wrong bind > no bind)
//  - tenant already has ANY phone_hash on file   -> leave it, do nothing
//  - tenant has no phone_hash                     -> set phone + phone_hash
// Body: { fmCompanyId, tenantId, fromNumber }
router.post('/bind-phone', requireInternalAuth, async (req, res) => {
  const { fmCompanyId, tenantId, fromNumber } = req.body || {};
  if (!fmCompanyId || !tenantId || !fromNumber) {
    return res.status(400).json({ error: 'fmCompanyId, tenantId and fromNumber are required' });
  }

  try {
    const hash = hashPhone(fromNumber);

    const tRes = await db.query(
      `SELECT t.id, t.phone_hash
         FROM tenant t
         JOIN building b ON b.id = t.building_id
         JOIN pm_company pm ON pm.id = b.pm_company_id
        WHERE t.id = $1 AND pm.fm_company_id = $2 AND t.status = 'active'`,
      [tenantId, fmCompanyId],
    );
    if (tRes.rows.length !== 1) {
      logger.warn('bind-phone: tenant not found / not in company / inactive', { tenantId, fmCompanyId });
      return res.json({ bound: false, reason: 'tenant_not_eligible' });
    }
    const tenant = tRes.rows[0];

    if (tenant.phone_hash === hash) {
      return res.json({ bound: false, reason: 'already_bound' });
    }

    // Collision: this number already recognizes a different active tenant in
    // the company. Binding again would make the next call ambiguous
    // (semi_recognized) at best, or greet the wrong person at worst.
    const collision = await db.query(
      `SELECT t.id FROM tenant t
         JOIN building b ON b.id = t.building_id
         JOIN pm_company pm ON pm.id = b.pm_company_id
        WHERE pm.fm_company_id = $1 AND t.phone_hash = $2 AND t.status = 'active' AND t.id <> $3`,
      [fmCompanyId, hash, tenantId],
    );
    if (collision.rows.length > 0) {
      logger.warn('bind-phone: number already bound to another tenant, refusing', { tenantId, fmCompanyId });
      return res.json({ bound: false, reason: 'number_belongs_to_another_tenant' });
    }

    if (tenant.phone_hash) {
      // A different number is already on file — company data wins, leave it.
      return res.json({ bound: false, reason: 'tenant_already_has_a_number' });
    }

    await db.query(
      'UPDATE tenant SET phone = $1, phone_hash = $2, updated_at = NOW() WHERE id = $3',
      [encryptPhone(fromNumber), hash, tenantId],
    );
    logger.info('bind-phone: number remembered for tenant', { tenantId, fmCompanyId });
    return res.json({ bound: true, reason: 'primary_set' });
  } catch (error) {
    logger.error('bind-phone failed', { error: error.message, tenantId, fmCompanyId });
    // Never surface as an error to the caller flow — this is a nice-to-have.
    res.json({ bound: false, reason: 'error' });
  }
});

// Named exports of the pure scoring helpers (no db/express dependency) so they
// can be unit-tested directly — added 2026-08-26 alongside the spoken-house-number
// fix so the exact repro (score before/after) is verifiable without standing up
// the full route + a mocked db.
export {
  normalizeSpokenNumbers, extractHouseNumber, buildingScore, similarity,
  collapseDigitRuns, collapseLetterRuns, extractStreetToken, streetTokenScore,
  diceBigram, soundex,
};

export default router;
