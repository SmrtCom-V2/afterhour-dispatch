/**
 * Plain-node test for getFrontendUrl().
 *
 * Deliberately NOT a jest test: the jest suite in this repo cannot currently
 * run at all (all 6 suites fail with "Cannot use import statement outside a
 * module" — jest is not configured for ESM, pre-existing as of 2026-08-09).
 * Run with:  node src/tests/frontendUrl.test.mjs
 */
import { getFrontendUrl, __resetFrontendUrlCache } from '../utils/frontendUrl.js';

const REAL_PROD = 'https://frontend-dun-one-70.vercel.app,https://afterhour.smrtcom.com,https://after-hour-ron-s-projects-0803a77d.vercel.app,https://afterhour.smrthour.com';

const cases = [
  ['real production value', { FRONTEND_URL: REAL_PROD }, 'https://afterhour.smrthour.com'],
  ['single value', { FRONTEND_URL: 'https://afterhour.smrthour.com' }, 'https://afterhour.smrthour.com'],
  ['trailing slash stripped', { FRONTEND_URL: 'https://afterhour.smrthour.com/' }, 'https://afterhour.smrthour.com'],
  ['explicit override wins', { FRONTEND_URL: 'https://a.com,https://b.com', PUBLIC_FRONTEND_URL: 'https://chosen.com' }, 'https://chosen.com'],
  ['only vercel urls -> last', { FRONTEND_URL: 'https://a.vercel.app,https://b.vercel.app' }, 'https://b.vercel.app'],
  ['unset -> localhost', {}, 'http://localhost:5175'],
  ['whitespace tolerated', { FRONTEND_URL: ' https://x.com , https://afterhour.smrthour.com ' }, 'https://afterhour.smrthour.com'],
];

let failed = 0;
for (const [label, env, expected] of cases) {
  delete process.env.FRONTEND_URL;
  delete process.env.PUBLIC_FRONTEND_URL;
  Object.assign(process.env, env);
  __resetFrontendUrlCache();

  const actual = getFrontendUrl();
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(26)} -> ${actual}`);
  if (!ok) console.log(`      expected: ${expected}`);
}

// The whole point: the produced link must be a single valid URL.
delete process.env.PUBLIC_FRONTEND_URL;
process.env.FRONTEND_URL = REAL_PROD;
__resetFrontendUrlCache();
const link = new URL(`${getFrontendUrl()}/reset-password?token=abc`);
const hostOk = link.host === 'afterhour.smrthour.com';
if (!hostOk) failed++;
console.log(`${hostOk ? 'PASS' : 'FAIL'}  ${'reset link parses cleanly'.padEnd(26)} -> ${link.host}${link.pathname}`);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
