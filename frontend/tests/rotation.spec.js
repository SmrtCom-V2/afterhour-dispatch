import { test, expect } from '@playwright/test';
import { dismissOverlays } from './helpers/auth.js';

// Regression coverage for the July 18 bugs: the rotation calendar used to be
// a mockup (fake round-robin, save button commented out), and separately had
// a timezone off-by-one that wrote the wrong 7 days when saving "this week".
// Auth comes from the suite's shared storageState (see global-setup.js) —
// logging in per-test would exhaust the app's own login rate limiter.
test.describe('On-call rotation calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/employees');
    await dismissOverlays(page);
  });

  test('current week card is marked and clickable', async ({ page }) => {
    const currentWeek = page.locator('.rotation-week.current');
    await expect(currentWeek).toBeVisible();
    await currentWeek.click();
    // The assignment modal should open
    await expect(page.locator('.modal-pro')).toBeVisible();
  });

  test('assigning the current week persists after reload', async ({ page }) => {
    await page.locator('.rotation-week.current').click();
    await expect(page.locator('.modal-pro')).toBeVisible();

    // Pick the first real employee option (not "No Assignment")
    const employeeOption = page.locator('.modal-pro-body input[type="radio"][value]:not([value=""])').first();
    const hasEmployee = await employeeOption.count();
    test.skip(hasEmployee === 0, 'No employees configured to assign in this environment');

    await employeeOption.check();
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.locator('.modal-pro')).not.toBeVisible({ timeout: 10000 });

    // Reload and confirm the assignment stuck — this is the exact check that
    // would have caught both historical bugs (fake save, and wrong week saved).
    await page.reload();
    await expect(page.locator('.rotation-week.current')).not.toContainText('Not Assigned');
    await expect(page.locator('.rotation-week.current')).not.toContainText('Nicht zugewiesen');
  });

  test('clearing an assignment removes it after reload', async ({ page }) => {
    await page.locator('.rotation-week.current').click();
    await expect(page.locator('.modal-pro')).toBeVisible();

    const clearOption = page.locator('.modal-pro-body input[type="radio"][value=""]');
    await clearOption.check();
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.locator('.modal-pro')).not.toBeVisible({ timeout: 10000 });

    await page.reload();
    const currentWeekText = await page.locator('.rotation-week.current').textContent();
    expect(currentWeekText).toMatch(/not assigned|nicht zugewiesen/i);
  });
});
