import { test, expect } from '@playwright/test';
import { login, dismissOverlays } from './helpers/auth.js';

test.describe('Authentication', () => {
  // These two tests exercise the login flow itself, so they need a genuinely
  // logged-out context rather than the suite's shared pre-authenticated state.
  test.describe('logged out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('login with valid credentials succeeds and reaches dashboard', async ({ page }) => {
      await login(page);
      await expect(page).not.toHaveURL(/\/login/);
    });

    test('login with invalid credentials shows an error, does not navigate away', async ({ page }) => {
      await page.goto('/login');
      await dismissOverlays(page);
      await page.locator('input[type="email"]').fill('nonexistent@example.com');
      await page.locator('input[type="password"]').fill('wrongpassword');
      await page.locator('button[type="submit"]').click();
      await expect(page.locator('.login-error')).toBeVisible({ timeout: 10000 });
      await expect(page).toHaveURL(/\/login/);
    });

    test('protected route redirects to login when logged out', async ({ page }) => {
      await page.goto('/buildings');
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test('legal pages are linked from the login footer', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await expect(page.locator('a[href="/impressum"]')).toBeVisible();
    await expect(page.locator('a[href="/privacy"]')).toBeVisible();
    await expect(page.locator('a[href="/terms"]')).toBeVisible();
  });
});
