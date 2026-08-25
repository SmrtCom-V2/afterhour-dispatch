import { jest } from '@jest/globals';
import { grantAfterHourEntitlement, revokeAfterHourEntitlement } from '../services/identityService.js';

describe('identityService (Sprint 4 webhook-to-identity-service client)', () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.IDENTITY_SERVICE_URL;
  const originalToken = process.env.IDENTITY_SERVICE_SERVICE_TOKEN;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.IDENTITY_SERVICE_URL = originalUrl;
    process.env.IDENTITY_SERVICE_SERVICE_TOKEN = originalToken;
    jest.restoreAllMocks();
  });

  describe('grantAfterHourEntitlement', () => {
    it('returns false without calling fetch when IDENTITY_SERVICE_URL is unset', async () => {
      delete process.env.IDENTITY_SERVICE_URL;
      global.fetch = jest.fn();
      const result = await grantAfterHourEntitlement('company-1', 'stripe:sub_1');
      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('posts to the grant-by-afterhour-company route with the service token', async () => {
      process.env.IDENTITY_SERVICE_URL = 'http://localhost:3400';
      process.env.IDENTITY_SERVICE_SERVICE_TOKEN = 'secret-token';
      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      const result = await grantAfterHourEntitlement('company-1', 'stripe:sub_1');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3400/v1/entitlements/grant-by-afterhour-company',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
          body: JSON.stringify({ afterHourCompanyId: 'company-1', grantedVia: 'stripe:sub_1' }),
        }),
      );
    });

    it('never throws when the identity-service call fails — a webhook ack must not depend on this', async () => {
      process.env.IDENTITY_SERVICE_URL = 'http://localhost:3400';
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(grantAfterHourEntitlement('company-1', 'stripe:sub_1')).resolves.toBe(false);
    });

    it('returns false on a non-OK response without throwing', async () => {
      process.env.IDENTITY_SERVICE_URL = 'http://localhost:3400';
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
      const result = await grantAfterHourEntitlement('company-1');
      expect(result).toBe(false);
    });
  });

  describe('revokeAfterHourEntitlement', () => {
    it('returns false without calling fetch when companyId is missing', async () => {
      process.env.IDENTITY_SERVICE_URL = 'http://localhost:3400';
      global.fetch = jest.fn();
      const result = await revokeAfterHourEntitlement(undefined);
      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('never throws on a network error', async () => {
      process.env.IDENTITY_SERVICE_URL = 'http://localhost:3400';
      global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
      await expect(revokeAfterHourEntitlement('company-1')).resolves.toBe(false);
    });
  });
});
