/**
 * API base URLs — single source of truth.
 *
 * There is deliberately NO localhost fallback here. A `|| 'http://localhost:3001'`
 * default is what shipped the SuperAdmin portal to production pointing at a
 * machine that doesn't exist for customers (QA 2026-08-09, Finding 2): the env
 * var was never set at build time, the fallback silently absorbed it, and the
 * bundle looked fine until a real browser tried to use it.
 *
 * Missing config must fail loudly at build/startup, not degrade into a dev URL.
 * For local development set VITE_API_URL / VITE_SA_API_URL in `.env` — the same
 * mechanism production uses, so dev and prod fail the same way.
 */

function required(name) {
  const value = import.meta.env[name];

  if (!value || typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `[config] ${name} is not set. Define it in the build environment ` +
      `(Vercel project env vars for deploys, .env for local dev). ` +
      `There is no default — see src/utils/apiConfig.js.`
    );
  }

  const trimmed = value.trim();

  // A production build must never talk to a developer's machine. If this ever
  // fires in CI/Vercel it means a dev value leaked into the deploy environment.
  if (import.meta.env.PROD && /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(trimmed)) {
    throw new Error(
      `[config] ${name} points at "${trimmed}" in a production build. ` +
      `Set it to the public API host.`
    );
  }

  // Plain HTTP leaks tokens in transit. Allowed only for local dev.
  if (import.meta.env.PROD && trimmed.startsWith('http://')) {
    throw new Error(
      `[config] ${name} must use https:// in a production build (got "${trimmed}").`
    );
  }

  return trimmed.replace(/\/+$/, '');
}

/**
 * Ensure a base URL ends with the given path segment, without doubling it.
 *
 * The old hardcoded fallbacks baked the path in ('.../api', '.../sa'), so
 * whether the env var carried it was never tested. Removing the fallbacks
 * surfaced that VITE_SA_API_URL is set to a bare host — the SA client then
 * posted to /auth/login instead of /sa/auth/login and got a 404. Owning the
 * segment here makes both spellings of the env var work.
 */
function withSegment(base, segment) {
  const clean = base.replace(/\/+$/, '');
  return clean.endsWith(`/${segment}`) ? clean : `${clean}/${segment}`;
}

export const API_URL = withSegment(required('VITE_API_URL'), 'api');
export const SA_API_URL = withSegment(required('VITE_SA_API_URL'), 'sa');
