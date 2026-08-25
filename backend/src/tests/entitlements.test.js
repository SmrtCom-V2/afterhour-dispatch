import { jest } from '@jest/globals';
import { fetchEntitlements } from '../routes/auth.js';

// Real behavior of the Sprint 3 retrofit against a mocked global fetch — not
// asserting against the implementation's internals, asserting the contract:
// never throws, always resolves, empty array on any failure mode.
describe('fetchEntitlements (Sprint 3 identity-service retrofit)', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.IDENTITY_SERVICE_URL;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.IDENTITY_SERVICE_URL = originalEnv;
    jest.restoreAllMocks();
  });

  it('returns [] without calling fetch when IDENTITY_SERVICE_URL is unset', async () => {
    delete process.env.IDENTITY_SERVICE_URL;
    global.fetch = jest.fn();
    const result = await fetchEntitlements('42');
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns [] without calling fetch when fmCompanyId is missing', async () => {
    process.env.IDENTITY_SERVICE_URL = 'http://localhost:3400';
    global.fetch = jest.fn();
    const result = await fetchEntitlements(null);
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns the products array on a successful lookup', async () => {
    process.env.IDENTITY_SERVICE_URL = 'http://localhost:3400';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products: ['afterhour', 'shield'] }),
    });
    const result = await fetchEntitlements('42');
    expect(result).toEqual(['afterhour', 'shield']);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3400/v1/entitlements/by-afterhour-company/42',
      expect.any(Object),
    );
  });

  it('returns [] on a non-OK response instead of throwing', async () => {
    process.env.IDENTITY_SERVICE_URL = 'http://localhost:3400';
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const result = await fetchEntitlements('42');
    expect(result).toEqual([]);
  });

  it('returns [] when fetch itself throws (network error, timeout)', async () => {
    process.env.IDENTITY_SERVICE_URL = 'http://localhost:3400';
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    await expect(fetchEntitlements('42')).resolves.toEqual([]);
  });
});
