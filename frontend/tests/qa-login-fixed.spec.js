import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Serves the LOCALLY BUILT (fixed) bundle under the real production origin.
// The origin matters: the API's CORS allowlist only accepts
// https://afterhour.smrthour.com, so this is the only way to exercise a
// genuine cross-origin 401 against the live backend with our new code.
const ORIGIN = 'https://afterhour.smrthour.com';
const DIST = path.resolve('dist');

const MIME = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };

test('FIXED bundle: wrong password renders backend error, page does not reload', async ({ page }) => {
  await page.route(`${ORIGIN}/**`, (route) => {
    const url = new URL(route.request().url());
    let file = path.join(DIST, url.pathname);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html'); // SPA fallback
    }
    const ext = path.extname(file);
    return route.fulfill({
      status: 200,
      contentType: MIME[ext] || 'application/octet-stream',
      body: fs.readFileSync(file),
    });
  });

  const responses = [];
  page.on('response', async (r) => {
    if (r.url().includes('/api/auth/login')) {
      responses.push({ status: r.status(), body: await r.text().catch(() => '') });
    }
  });

  await page.goto(`${ORIGIN}/login`);
  await page.evaluate(() => { window.__qaMarker = 'set-before-submit'; });

  await page.fill('input[type="email"]', 'garshit+qa60@gmail.com');
  await page.fill('input[type="password"]', 'definitelyWrongPassword123!');
  await page.click('button[type="submit"]');

  const err = page.locator('.login-error');
  await expect(err).toBeVisible({ timeout: 15000 });
  const errText = (await err.textContent()).trim();

  const marker = await page.evaluate(() => window.__qaMarker ?? null);
  const emailVal = await page.inputValue('input[type="email"]');

  console.log(`  -> /api/auth/login: ${JSON.stringify(responses)}`);
  console.log(`  -> rendered error text: "${errText}"`);
  console.log(`  -> window.__qaMarker after submit: ${JSON.stringify(marker)}`);
  console.log(`  -> email field retained: "${emailVal}"`);

  expect(responses[0].status).toBe(401);          // real backend 401
  expect(errText).toContain('Invalid credentials'); // real message shown to user
  expect(marker).toBe('set-before-submit');        // no hard reload
  expect(emailVal).toBe('garshit+qa60@gmail.com'); // form not wiped

  await page.screenshot({ path: 'qa-fixed-login-error.png' });
});
