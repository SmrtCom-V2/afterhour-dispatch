import { defineConfig, devices } from '@playwright/test';

/**
 * Standalone config for the on-call cockpit funnel spec. No global login
 * (the cockpit token is the auth) and it serves a local production build —
 * every API call in the spec is mocked via page.route(), so the app only
 * needs to render.
 *
 *   VITE_API_URL=https://mocked.local npm run build
 *   npx playwright test --config playwright.cockpit.config.js
 */
export default defineConfig({
  testDir: './tests',
  testMatch: /cockpit\.spec\.js/,
  fullyParallel: true,
  // One local preview server backs all workers — 4 saturates it and flakes.
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
