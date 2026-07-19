import { test, expect } from '@playwright/test';

test.describe('Legal pages', () => {
  test('Impressum loads and flags missing entity info', async ({ page }) => {
    await page.goto('/impressum');
    await expect(page.locator('h1')).toContainText('Impressum');
    await expect(page.getByText(/TODO/i).first()).toBeVisible();
  });

  test('Datenschutz loads with real content, not a stub', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('h1')).toContainText('Datenschutzerklärung');
    await expect(page.getByRole('heading', { name: /Auftragsverarbeiter/ })).toBeVisible();
    await expect(page.getByText('Twilio')).toBeVisible();
  });

  test('Terms loads with real content', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('h1')).toContainText('Terms of Service');
    await expect(page.getByText('Emergency Service Limitations')).toBeVisible();
  });

  test('legal pages cross-link to each other', async ({ page }) => {
    await page.goto('/impressum');
    await expect(page.locator('a[href="/privacy"]')).toBeVisible();
    await expect(page.locator('a[href="/terms"]')).toBeVisible();
  });
});
