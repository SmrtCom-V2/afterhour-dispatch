import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  globalSetup: './tests/global-setup.js',
  use: {
    baseURL: process.env.TEST_BASE_URL || 'https://frontend-dun-one-70.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    storageState: 'tests/.auth/state.json',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
