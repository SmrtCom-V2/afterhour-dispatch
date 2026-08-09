/**
 * API base URLs — single source of truth.
 *
 * There is deliberately NO localhost fallback here. A `|| 'http://localhost:3001'`
 * default is what shipped the SuperAdmin portal to production pointing at a
 * machine that doesn't exist for customers (QA 2026-08-09, Finding 2): the env
 * var was never set at build time, the fallback silently absorbed it, and the
 * bundle looked fine until a real browser tried to use it.
 *
 * Missing config must fail loudly — but it must fail *where it is used*, not at
 * module load. The first version of this file validated at module scope and
 * exported plain consts. Vite inlines `import.meta.env` at build time but does
 * NOT evaluate this module during the build, so the throw never fired in CI —
 * it fired in the customer's browser, during module evaluation, before React
 * mounted. A missing VITE_SA_API_URL (SuperAdmin-only config) therefore took
 * down the entire customer-facing app with a blank white page, on every route,
 * while the server still returned HTTP 200 so uptime checks stayed green.
 * (QA 2026-08-09 — observed live on afterhour.smrthour.com.)
 *
 * Two rules follow, and both matter:
 *   1. Validate lazily, on first access. A broken SuperAdmin URL breaks /sa,
 *      not /login.
 *   2. Never let a bad value through silently. Accessing a misconfigured URL
 *      still throws, and the surrounding UI is responsible for catching it.
 *
 * For local development set VITE_API_URL / VITE_SA_API_URL in `.env` — the same
 * mechanism production uses.
 */

function validate(name, rawValue, segment) {
  if (!rawValue || typeof rawValue !== 'string' || rawValue.trim() === '') {
    throw new Error(
      `[config] ${name} is not set. Define it in the build environment ` +
      `(Vercel project env vars for deploys, .env for local dev). ` +
      `There is no default — see src/utils/apiConfig.js.`
    );
  }

  const trimmed = rawValue.trim();

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

  // Ensure the base URL ends with the given path segment, without doubling it.
  // The old hardcoded fallbacks baked the path in ('.../api', '.../sa'), so
  // whether the env var carried it was never tested. VITE_SA_API_URL is set to
  // a bare host, so owning the segment here makes both spellings work.
  const clean = trimmed.replace(/\/+$/, '');
  return clean.endsWith(`/${segment}`) ? clean : `${clean}/${segment}`;
}

function lazyUrl(name, segment) {
  let cached;
  return () => {
    if (cached === undefined) {
      cached = validate(name, import.meta.env[name], segment);
    }
    return cached;
  };
}

export const getApiUrl = lazyUrl('VITE_API_URL', 'api');
export const getSaApiUrl = lazyUrl('VITE_SA_API_URL', 'sa');

/**
 * Non-throwing probe for surfacing a config problem in the UI instead of as an
 * unhandled error. Returns null when the URL is usable.
 */
export function getConfigError(which) {
  try {
    which === 'sa' ? getSaApiUrl() : getApiUrl();
    return null;
  } catch (err) {
    return err.message;
  }
}

/**
 * Back-compat string-like accessors.
 *
 * Existing call sites do `${API_URL}/foo`. These proxies resolve (and validate)
 * only when interpolated, preserving the lazy behaviour above while leaving
 * those call sites untouched.
 */
function urlProxy(resolve) {
  return {
    toString: resolve,
    [Symbol.toPrimitive]: resolve,
    valueOf: resolve,
  };
}

export const API_URL = urlProxy(() => getApiUrl());
export const SA_API_URL = urlProxy(() => getSaApiUrl());
