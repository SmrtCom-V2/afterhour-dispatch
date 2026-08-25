/**
 * Client for the shared identity-service (SmrtCom-V2 monorepo,
 * packages/identity-service). Every call here is best-effort from this
 * product's point of view — a failure logs and returns a safe default,
 * it never throws into a caller that has its own job to finish regardless
 * (a login, a Stripe webhook ack) — same fail-open contract as
 * routes/auth.js's fetchEntitlements, which this module could eventually
 * replace/absorb once the pattern is proven out.
 */
import { logger } from '../utils/logger.js';

const IDENTITY_SERVICE_TIMEOUT_MS = 3000;

function identityServiceUrl() {
  return process.env.IDENTITY_SERVICE_URL;
}

// Grants the 'afterhour' entitlement for the company tied to a real Stripe
// subscription event. Called from stripeWebhook.js's checkout-completed
// handler — Sprint 4's "one click" moment for this product. Idempotent on
// the identity-service side (EntitlementsService.grant upserts), so Stripe's
// own webhook retries are safe to call this again.
export async function grantAfterHourEntitlement(afterHourCompanyId, grantedVia) {
  const baseUrl = identityServiceUrl();
  if (!baseUrl || !afterHourCompanyId) return false;

  try {
    const response = await fetch(`${baseUrl}/v1/entitlements/grant-by-afterhour-company`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.IDENTITY_SERVICE_SERVICE_TOKEN ?? ''}`,
      },
      body: JSON.stringify({ afterHourCompanyId, grantedVia }),
      signal: AbortSignal.timeout(IDENTITY_SERVICE_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn('Identity-service grant call returned non-OK', {
        afterHourCompanyId,
        status: response.status,
      });
      return false;
    }
    return true;
  } catch (error) {
    // Deliberately does not throw: a failed cross-product entitlement grant
    // must never fail the Stripe webhook ack itself — Stripe would otherwise
    // retry a checkout-completed event that already succeeded in this
    // product's own database, which is a worse failure mode than a delayed
    // entitlement sync (this call can be safely retried by re-running the
    // Sprint 3 reconciliation script if it's ever missed).
    logger.error('Identity-service grant call failed', {
      afterHourCompanyId,
      error: error.message,
    });
    return false;
  }
}

export async function revokeAfterHourEntitlement(afterHourCompanyId) {
  const baseUrl = identityServiceUrl();
  if (!baseUrl || !afterHourCompanyId) return false;

  try {
    const response = await fetch(`${baseUrl}/v1/entitlements/revoke-by-afterhour-company`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.IDENTITY_SERVICE_SERVICE_TOKEN ?? ''}`,
      },
      body: JSON.stringify({ afterHourCompanyId }),
      signal: AbortSignal.timeout(IDENTITY_SERVICE_TIMEOUT_MS),
    });
    return response.ok;
  } catch (error) {
    logger.error('Identity-service revoke call failed', {
      afterHourCompanyId,
      error: error.message,
    });
    return false;
  }
}
