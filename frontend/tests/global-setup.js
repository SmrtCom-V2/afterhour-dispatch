import { chromium } from '@playwright/test';
import { login } from './helpers/auth.js';

// Logs in once for the whole test run and saves the session, so parallel
// tests reuse it instead of each hitting /auth/login separately — the app's
// own rate limiter (10 attempts/15min, added July 18) will otherwise block
// the test suite itself when several workers log in at once.
export default async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL;
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await login(page);
  await page.context().storageState({ path: 'tests/.auth/state.json' });
  await browser.close();
}
