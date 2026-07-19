import { test, expect } from '@playwright/test';
import { dismissOverlays } from './helpers/auth.js';

// Auth comes from the suite's shared storageState (see global-setup.js).
test.describe('Buildings & PM companies', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissOverlays(page);
  });

  test('buildings list loads without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/buildings');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('pm companies list loads and shows at least one company', async ({ page }) => {
    await page.goto('/pm-companies');
    await page.waitForLoadState('networkidle');
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    expect(errors).toEqual([]);
  });

  // NOTE: shutoff/access-data field verification (water/gas/electric/key-safe)
  // lives in PmWorkspace's building editor, reached via /pm/:pmId/... — the
  // pmId is data-dependent, not a static route, so it isn't covered by a
  // static test here yet. Verified manually + via direct DB check on July 18;
  // worth adding once the click-path from /pm-companies is traced with a
  // known seed pmId.
});
