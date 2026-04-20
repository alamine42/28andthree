import { expect, test } from '@playwright/test';
import { PHASES } from '../../lib/constants/phases';

// Crawls every user-facing route and asserts no rendered element with
// data-numeric="true" contains a bad-number string (NaN, null, undefined,
// bare 0.0-style). Em-dash (U+2014) is the only acceptable "no data" output.

const BAD_NUMBER = /\bNaN\b|\bundefined\b|\bnull\b|^0\.0+$|^-?\.?Infinity$/;
const EM_DASH = '\u2014';

const ROUTES = [
  '/',
  '/players',
  '/draft-roi',
  '/coaching',
  '/status',
  ...PHASES.map((p) => `/phases/${p}`),
];

test.describe('no-bad-numbers crawler', () => {
  for (const route of ROUTES) {
    test(`no NaN/null/undefined/0.0 on ${route}`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      // Some routes (e.g. /status/data) return non-HTML; skip.
      const headers = response?.headers() ?? {};
      if (!(headers['content-type'] ?? '').includes('text/html')) {
        test.skip(true, 'non-HTML response');
      }

      const metrics = page.locator('[data-numeric="true"]');
      const count = await metrics.count();
      for (let i = 0; i < count; i++) {
        const text = (await metrics.nth(i).textContent())?.trim() ?? '';
        if (text === '' || text === EM_DASH) continue;
        expect(
          BAD_NUMBER.test(text),
          `"${text}" on ${route} violates bad-number rule`,
        ).toBe(false);
      }
    });
  }

  test('home page has at least 12 numeric elements (phase rank grid)', async ({ page }) => {
    await page.goto('/');
    const count = await page.locator('[data-numeric="true"]').count();
    expect(count).toBeGreaterThanOrEqual(12);
  });

  test('phase detail page has at least 3 numeric elements (rank + EPA + success)', async ({ page }) => {
    await page.goto('/phases/pass_offense');
    const count = await page.locator('[data-numeric="true"]').count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
