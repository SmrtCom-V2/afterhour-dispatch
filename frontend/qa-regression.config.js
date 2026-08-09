import { defineConfig, devices } from '@playwright/test';

// Regression suite for the 2026-08-09 live QA findings.
// Serves the locally built dist/ under the real production origin so the
// live API's CORS allowlist accepts it — see the specs for why that matters.
// Run:  npx vite build && npx playwright test --config=qa-regression.config.js
export default defineConfig({
  testDir: './tests',
  testMatch: /qa-(login-fixed|sa-fixed)\.spec\.js/,
  fullyParallel: false,
  reporter: [['list']],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
