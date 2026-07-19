const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'ap@demo.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || '1234demo';

export async function login(page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await dismissOverlays(page);
}

// A fresh session (no localStorage) can show a first-run onboarding modal
// and/or the cookie consent banner, both of which block clicks on the page
// beneath them — same as a real new user would hit, so tests dismiss them
// the same way a person would.
export async function dismissOverlays(page) {
  const skipTour = page.getByRole('button', { name: /skip tour/i });
  if (await skipTour.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipTour.click();
  }

  const acceptCookies = page.getByRole('button', { name: /accept all/i });
  if (await acceptCookies.isVisible({ timeout: 3000 }).catch(() => false)) {
    await acceptCookies.click();
  }
}
