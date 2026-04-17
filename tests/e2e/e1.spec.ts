import { expect, test } from '@playwright/test';

// E1 epic smoke suite — the automated half of the Sprint 1 exit criteria.
// Authored BEFORE implementation (TDD) per /build-it. Tests start red and flip
// green as each E1 task lands. See docs/plans/e1-foundation-plan.md §4.

test.describe('E1 smoke: home + chrome', () => {
  test('home renders with wordmark, nav, and footer disclaimer', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/28 and Three/i);

    const wordmark = page.getByTestId('wordmark');
    await expect(wordmark).toBeVisible();

    const navLinks = page.getByRole('navigation').getByRole('link');
    await expect(navLinks).toHaveCount(5);

    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText(/Not affiliated with/i);
    await expect(footer).toContainText(/nflverse/i);

    expect(consoleErrors).toEqual([]);
  });
});

test.describe('E1 smoke: /status', () => {
  test('renders without raw DB errors when no ETL has run', async ({ page }) => {
    await page.goto('/status');
    await expect(page).toHaveURL(/\/status$/);
    const body = page.locator('body');
    await expect(body).toContainText(/never run|last run/i);
    await expect(body).not.toContainText(/ECONNREFUSED|role .* does not exist|password authentication failed/i);
  });

  test('sets Cache-Control: no-store', async ({ request }) => {
    const res = await request.get('/status');
    const cc = res.headers()['cache-control'] ?? '';
    expect(cc).toMatch(/no-store/);
  });
});

test.describe('E1 smoke: security headers', () => {
  test('home carries CSP, HSTS, XFO, Referrer-Policy', async ({ request }) => {
    const res = await request.get('/');
    const h = res.headers();
    const csp = h['content-security-policy-report-only'] ?? h['content-security-policy'];
    expect(csp).toBeTruthy();
    expect(h['strict-transport-security']).toBeTruthy();
    expect(h['x-frame-options']).toMatch(/DENY/i);
    expect(h['referrer-policy']).toBeTruthy();
  });
});

test.describe('E1 smoke: debug-trigger gating', () => {
  test('debug=boom never returns 500 in prod-like envs', async ({ request }) => {
    if (process.env.ALLOW_DEBUG_TRIGGER === 'true') {
      test.skip(true, 'debug trigger is enabled in this env');
    }
    const res = await request.get('/status?debug=boom');
    expect([200, 404]).toContain(res.status());
  });
});

test.describe('E1 smoke: DESIGN.md tokens', () => {
  test('/tokens exposes at least 14 resolvable dark-mode swatches', async ({ page }) => {
    await page.goto('/tokens');
    const swatches = page.getByTestId(/^token-/);
    await expect(swatches.first()).toBeVisible();

    const count = await swatches.count();
    expect(count).toBeGreaterThanOrEqual(14);

    for (const el of await swatches.all()) {
      const color = await el.evaluate((n) => getComputedStyle(n).backgroundColor);
      expect(color).not.toEqual('');
      expect(color).not.toEqual('rgba(0, 0, 0, 0)');
    }
  });
});

test.describe('E1 smoke: font isolation', () => {
  test('no external font requests at runtime (self-hosted + next/font)', async ({ page }) => {
    const fontRequests: string[] = [];
    page.on('request', (req) => {
      if (req.resourceType() === 'font') fontRequests.push(req.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const origin = new URL(page.url()).origin;
    const externalFonts = fontRequests.filter(
      (u) => !u.startsWith(origin) && !u.includes('/_next/'),
    );
    expect(externalFonts).toEqual([]);
  });
});
