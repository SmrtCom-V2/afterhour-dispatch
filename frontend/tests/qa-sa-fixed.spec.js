import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ORIGIN = 'https://afterhour.smrthour.com';
const DIST = path.resolve('dist');
const MIME = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };

// Finding 2: SuperAdmin portal called http://localhost:3001/sa in production
// (ERR_CONNECTION_REFUSED). Backend was fine all along — it's live at
// /sa/* on the public API host, correctly 401-gated. Only the frontend
// env var was missing. This proves the fixed bundle reaches the real host.
test('FIXED bundle: SuperAdmin login hits the real API host, not localhost', async ({ page }) => {
  await page.route(`${ORIGIN}/**`, (route) => {
    const url = new URL(route.request().url());
    let file = path.join(DIST, url.pathname);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    const ext = path.extname(file);
    return route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: fs.readFileSync(file) });
  });

  const saCalls = [];
  const localhostCalls = [];
  page.on('request', r => {
    const u = r.url();
    if (/localhost|127\.0\.0\.1/.test(u)) localhostCalls.push(u);
  });
  page.on('response', async r => {
    if (r.url().includes('/sa/auth/login')) saCalls.push({ url: r.url(), status: r.status(), body: await r.text().catch(() => '') });
  });

  await page.goto(`${ORIGIN}/sa/login`);
  await page.waitForTimeout(1500);

  // The cookie consent overlay intercepts pointer events (see Finding 6).
  const accept = page.getByRole('button', { name: /accept all/i });
  if (await accept.count()) { await accept.first().click(); await page.waitForTimeout(500); }

  const emailInput = page.locator('input[type="email"], input[type="text"]').first();
  await emailInput.fill('qa-probe@example.com');
  await page.locator('input[type="password"]').first().fill('wrongpassword123');
  await page.getByRole('button', { name: /sign in to super admin/i }).click();
  await page.waitForTimeout(4000);

  console.log(`  -> /sa/auth/login calls: ${JSON.stringify(saCalls)}`);
  console.log(`  -> localhost requests attempted: ${localhostCalls.length}`);

  expect(localhostCalls).toEqual([]);
  expect(saCalls.length).toBeGreaterThan(0);
  expect(saCalls[0].url).toContain('api-afterhour.smrtcom.com');
  expect(saCalls[0].status).toBe(401); // real backend rejecting bad creds
  await page.screenshot({ path: 'qa-fixed-sa-login.png' });
});
