import { test, expect } from '@playwright/test';

/**
 * On-call cockpit decision funnel — UI behaviour, API mocked via page.route()
 * so the funnel is exercised deterministically without a seeded DB. The real
 * end-to-end path (a live call → real AI brief → real dispatch) is covered by
 * the manual phone walkthrough in
 * AFTERHOUR_ONCALL_COCKPIT_DECISION_FUNNEL_REBUILD_2026-09-02.md §5.4.
 *
 * No auth: the cockpit token IS the auth. These tests don't use storageState.
 */

test.use({ storageState: { cookies: [], origins: [] } });

const TOKEN = 'e2e-token';
const now = new Date();

function incidentPayload(overrides = {}) {
  const base = {
    incident: {
      id: 'inc-e2e',
      category: 'water_leak',
      description: 'Water coming through the ceiling',
      aiConfidence: 88,
      aiUrgency: null,
      verificationStatus: 'verified',
      callLanguage: 'en',
      createdAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
      failsafeAt: new Date(now.getTime() + 6 * 60 * 1000).toISOString(),
      decision: 'pending',
      nightOutcome: null,
      dispatchMode: null,
      callbackCount: 0,
      transcript: 'AI: After Hour, how can I help?\nCaller: Water is pouring through my bathroom ceiling.',
      guidedAnswers: [],
      aiBrief: {
        headline: 'Active water leak through bathroom ceiling, upstairs source',
        reported: 'Water is pouring through the bathroom ceiling, getting worse.',
        story_summary: '',
        qa: [
          { q: 'How fast is the water coming in?', a: 'Flooding, not a drip' },
          { q: 'Do you know where it starts?', a: 'From the flat upstairs' },
        ],
        emergency_assessment: {
          is_emergency: 'yes',
          confidence_percent: 88,
          one_liner: 'Active flooding with an inaccessible shut-off — send a plumber now.',
          reasoning: 'Continuous flow, worsening, shut-off not reachable.',
        },
        suggested_actions: ['Dispatch a plumber', 'Contact the upstairs unit'],
        narrative: 'An active water leak was reported through a bathroom ceiling.',
      },
      aiBriefMissing: false,
    },
    caller: { name: 'Thomas Bauer', phone: '+491700000000', nameGiven: 'Thomas Bauer', nameOnFile: 'Thomas Bauer' },
    building: {
      id: 'bld-e2e',
      name: 'Hauptstrasse 10',
      address: 'Hauptstrasse 10, 10115 Berlin',
      waterShutoff: 'Basement, behind the boiler',
      keySafeCode: '4417',
      gateCode: '2200',
      mainEntranceCode: '1590',
      janitorName: 'Herr Klein',
      janitorPhone: '+491755555555',
    },
    history: [
      { id: 'h1', issue_category: 'water_leak', created_at: new Date(now.getTime() - 20 * 864e5).toISOString(), decision: 'emergency_dispatch', night_outcome: 'stabilized_pending_repair' },
    ],
    recurringPattern: { count: 1, sameCategoryCount: 1 },
    requiredTrade: 'plumber',
    suggestedAction: 'send_company',
    suggestedCompany: { id: 'sp1', companyName: 'AquaFix 24', trade: 'plumber', phone: '+493011111111', priority: 1, usageNote: '24/7 emergency line, ~30 min', available24h: true, availableFrom: null, availableTo: null, openNow: 'always' },
    allCompanies: [
      { id: 'sp1', companyName: 'AquaFix 24', trade: 'plumber', phone: '+493011111111', priority: 1, usageNote: '24/7 emergency line, ~30 min', available24h: true, availableFrom: null, availableTo: null, openNow: 'always' },
      { id: 'sp2', companyName: 'Berlin Rohr GmbH', trade: 'plumber', phone: '+493022222222', priority: 2, usageNote: 'Business hours only', available24h: false, availableFrom: '08:00:00', availableTo: '18:00:00', openNow: 'closed' },
    ],
    wakeupAttempts: [{ stage: 't0', channel: 'voice_call', result: 'answered', created_at: now.toISOString() }],
    fmOnCall: { name: 'Frank (FM)', phone: '+49301234567' },
    viewer: { role: 'primary', name: 'Dana On-Call' },
    alreadyDecided: false,
  };
  return { ...base, ...overrides, incident: { ...base.incident, ...(overrides.incident || {}) } };
}

// The frontend build points VITE_API_URL at https://mocked.local (which
// resolves to .../api). Match ONLY that host so we don't also intercept the
// browser navigating to http://localhost:4173/cockpit/<token>.
const API = 'https://mocked.local/api';

async function mockCockpit(page, payload, { decisionResponse } = {}) {
  await page.route(`${API}/cockpit/${TOKEN}/decision`, (route) =>
    route.fulfill(decisionResponse || { json: { success: true, action: 'send_company', nightOutcome: 'dispatched', dispatchMode: 'auto' } }),
  );
  await page.route(`${API}/cockpit/${TOKEN}/forward`, (route) =>
    route.fulfill({ json: { url: `https://staging.example.com/cockpit/forward/abc123def456`, expiresAt: new Date(now.getTime() + 12 * 3600e3).toISOString() } }),
  );
  await page.route(`${API}/cockpit/${TOKEN}/outcome`, (route) => route.fulfill({ json: { success: true } }));
  await page.route(`${API}/cockpit/${TOKEN}`, (route) => route.fulfill({ json: payload }));
}

test('Zone 1 verdict + countdown render', async ({ page }) => {
  await mockCockpit(page, incidentPayload());
  await page.goto(`/cockpit/${TOKEN}`);

  await expect(page.getByText('EMERGENCY', { exact: true })).toBeVisible();
  await expect(page.getByText(/Active water leak through bathroom ceiling/)).toBeVisible();
  await expect(page.getByText(/Recommended: send a service provider now/)).toBeVisible();
  // countdown re-renders every second — assert on the stable prefix
  await expect(page.getByText(/Auto-dispatch in/)).toBeVisible();
  await page.screenshot({ path: 'qa-evidence-2026-09-02/cockpit-01-verdict.png', fullPage: true });
});

test('T2 unsure — no percentage shown, "could not judge" prominent', async ({ page }) => {
  const p = incidentPayload();
  p.incident.aiUrgency = 'unclear';
  p.suggestedAction = null;
  p.incident.aiBrief.headline = 'UNSURE HOW URGENT — no heat reported, whole building';
  p.incident.aiBrief.reported = 'The heating is off and it is cold.';
  p.incident.aiBrief.emergency_assessment = {
    is_emergency: 'unsure',
    confidence_percent: 100,
    one_liner: 'I could not determine how urgent this is — please make the call.',
    reasoning: 'Caller unsure how long the heating has been off; no vulnerable-occupant info.',
  };
  await mockCockpit(page, p);
  await page.goto(`/cockpit/${TOKEN}`);

  await expect(page.getByText('AI UNSURE — YOUR CALL')).toBeVisible();
  await expect(page.getByText(/could not judge how urgent this is/)).toBeVisible();
  // no send/defer recommendation on an unsure call — just "read and decide"
  await expect(page.getByText(/Read the call below and decide/)).toBeVisible();
  await expect(page.getByText(/Recommended: send a service provider/)).toHaveCount(0);
  // the misleading 100% must not appear anywhere
  await expect(page.getByText('100%')).toHaveCount(0);
  await expect(page.getByText(/UNSURE HOW URGENT/)).toHaveCount(0); // prefix stripped from the verdict line
  await page.screenshot({ path: 'qa-evidence-2026-09-02/cockpit-02-unsure.png', fullPage: true });
});

test('Zone 3 detail expands to show transcript + history outcome', async ({ page }) => {
  await mockCockpit(page, incidentPayload());
  await page.goto(`/cockpit/${TOKEN}`);

  await page.getByRole('button', { name: /Show full call detail/ }).click();
  await expect(page.getByText(/Water is pouring through my bathroom ceiling/)).toBeVisible();
  await expect(page.getByText(/stabilized, repair to follow/)).toBeVisible();
});

test('send a provider — pick non-suggested, "I\'ll call them", confirm', async ({ page }) => {
  await mockCockpit(page, incidentPayload(), {
    decisionResponse: { json: { success: true, action: 'send_company_manual', nightOutcome: 'dispatched_manual', dispatchMode: 'manual' } },
  });
  await page.goto(`/cockpit/${TOKEN}`);

  await page.getByRole('button', { name: /Send a service provider/ }).click();
  await expect(page.getByText('AquaFix 24')).toBeVisible();
  await expect(page.getByText('Berlin Rohr GmbH')).toBeVisible();
  await expect(page.getByText(/Closed now/)).toBeVisible(); // sp2 availability pill

  await page.getByText('Berlin Rohr GmbH').click();
  await page.getByRole('button', { name: /I'll call them myself/ }).click();
  await expect(page.getByText(/Mark Berlin Rohr GmbH as dispatched/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  await expect(page.getByText(/service provider sent \(called directly\)/)).toBeVisible();
  await page.screenshot({ path: 'qa-evidence-2026-09-02/cockpit-03-manual-dispatch.png', fullPage: true });
});

test('call the tenant back — decision stays open, buttons still active', async ({ page }) => {
  await mockCockpit(page, incidentPayload(), {
    decisionResponse: { json: { ok: true, action: 'callback_tenant', callbackCount: 1 } },
  });
  await page.goto(`/cockpit/${TOKEN}`);

  await page.getByRole('button', { name: /Call the tenant back first/ }).click();
  await expect(page.getByText(/You've logged 1 callback/)).toBeVisible();
  await expect(page.getByText(/auto-dispatch clock is running/)).toBeVisible();
  // the primary decision path is still available
  await expect(page.getByRole('button', { name: /Send a service provider/ })).toBeEnabled();
});

test('forward a safe brief — link is offered and copyable', async ({ page }) => {
  await mockCockpit(page, incidentPayload());
  await page.goto(`/cockpit/${TOKEN}`);

  await page.getByRole('button', { name: /Forward a safe brief/ }).click();
  await expect(page.getByText(/Safe brief link ready/)).toBeVisible();
  await expect(page.locator('input[readonly]')).toHaveValue(/\/cockpit\/forward\/abc123def456$/);
});

test('forward view — no access codes on the page', async ({ page }) => {
  await page.route('https://mocked.local/api/cockpit/forward/abc123def456', (route) =>
    route.fulfill({
      json: {
        incident: {
          category: 'water_leak',
          description: 'Water through the ceiling',
          createdAt: now.toISOString(),
          transcript: 'Caller: water everywhere',
          aiBrief: {
            headline: 'Active water leak, bathroom ceiling',
            reported: 'Water pouring through the ceiling',
            story_summary: '',
            qa: [{ q: 'How bad?', a: 'Flooding' }],
            emergency_assessment: { is_emergency: 'yes', one_liner: 'Send a plumber', reasoning: 'worsening' },
            suggested_actions: ['Dispatch a plumber'],
            narrative: 'A leak was reported.',
          },
        },
        building: { name: 'Hauptstrasse 10', address: 'Hauptstrasse 10, Berlin' },
        requiredTrade: 'plumber',
      },
    }),
  );
  await page.goto('/cockpit/forward/abc123def456');

  await expect(page.getByText('SHARED BRIEF · READ-ONLY')).toBeVisible();
  await expect(page.getByText('Hauptstrasse 10, Berlin')).toBeVisible();
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('4417'); // key safe code
  expect(body).not.toContain('2200'); // gate code
  expect(body.toLowerCase()).not.toContain('janitor');
});

test('mobile viewport — no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCockpit(page, incidentPayload());
  await page.goto(`/cockpit/${TOKEN}`);
  await expect(page.getByText('EMERGENCY', { exact: true })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
