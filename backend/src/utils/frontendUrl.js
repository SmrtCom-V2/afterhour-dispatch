/**
 * Canonical public frontend URL.
 *
 * FRONTEND_URL is a comma-separated *list* of allowed origins — index.js splits
 * it to build the CORS allowlist, and it currently holds four entries in
 * production. Everywhere else in the codebase it was interpolated whole into
 * customer-facing links:
 *
 *   `${process.env.FRONTEND_URL}/reset-password?token=…`
 *
 * which produces
 *
 *   https://a.vercel.app,https://b.com,https://c.app,https://d.com/reset-password?token=…
 *
 * — a single malformed URL whose host parses as "a.vercel.app,https". That
 * affected password-reset links, email-verification links, Stripe checkout
 * success/cancel redirects, and every trial-conversion email (10 call sites,
 * found 2026-08-09).
 *
 * The canonical URL is the LAST entry, because entries are appended as domains
 * are added and the newest is the current public one. Override explicitly with
 * PUBLIC_FRONTEND_URL when that heuristic is not what you want — that is the
 * preferred long-term fix, since it does not depend on list ordering.
 */

let cached;

export function getFrontendUrl() {
  if (cached !== undefined) return cached;

  // Explicit wins over any heuristic.
  const explicit = (process.env.PUBLIC_FRONTEND_URL || '').trim();
  if (explicit) {
    cached = explicit.replace(/\/+$/, '');
    return cached;
  }

  const candidates = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (candidates.length === 0) {
    cached = 'http://localhost:5175';
    return cached;
  }

  // Prefer a non-vercel.app custom domain if one is present — those are the
  // branded URLs customers are meant to see. Otherwise take the last entry.
  const custom = candidates.filter((u) => !/\.vercel\.app(?::\d+)?$/i.test(u));
  const chosen = custom.length > 0 ? custom[custom.length - 1] : candidates[candidates.length - 1];

  cached = chosen.replace(/\/+$/, '');
  return cached;
}

// Test seam — lets a test change the env and re-read it.
export function __resetFrontendUrlCache() {
  cached = undefined;
}

export default getFrontendUrl;
