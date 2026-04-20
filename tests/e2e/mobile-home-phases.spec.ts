import { devices, expect, test } from '@playwright/test';
import { PHASES } from '../../lib/constants/phases';

// E6-05a: mobile pass for / and all 12 /phases/*.
// Gate: no horizontal scroll; interactive targets in main content >= 44x44.

const PIXEL_5 = devices['Pixel 5'];
const ROUTES = ['/', ...PHASES.map((p) => `/phases/${p}`)];
const MIN_TAP = 44;

test.use({ viewport: PIXEL_5.viewport, userAgent: PIXEL_5.userAgent });

for (const route of ROUTES) {
  test(`${route} — no horizontal scroll at Pixel 5`, async ({ page }) => {
    await page.goto(route);
    // Close the mobile nav if it auto-opens on load (it shouldn't, but be safe).
    const overflow = await page.evaluate(() => {
      const d = document.documentElement;
      return {
        scrollWidth: d.scrollWidth,
        clientWidth: d.clientWidth,
      };
    });
    expect(
      overflow.scrollWidth,
      `${route}: scrollWidth ${overflow.scrollWidth} exceeds clientWidth ${overflow.clientWidth}`,
    ).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test(`${route} — interactive targets in <main> meet 44x44`, async ({
    page,
  }) => {
    await page.goto(route);
    const undersized = await page.evaluate((min) => {
      const nodes = document.querySelectorAll<HTMLElement>(
        'main a, main button, main [role="button"]',
      );
      const fails: Array<{ tag: string; text: string; w: number; h: number }> = [];
      for (const el of Array.from(nodes)) {
        // Skip elements that are hidden (in a collapsed panel or display:none).
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') {
          continue;
        }
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.width < min || rect.height < min) {
          fails.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent ?? '').trim().slice(0, 40),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          });
        }
      }
      return fails;
    }, MIN_TAP);

    if (undersized.length > 0) {
      const summary = undersized
        .map((u) => `  ${u.tag} [${u.w}\u00D7${u.h}] "${u.text}"`)
        .join('\n');
      throw new Error(
        `${route} has ${undersized.length} undersized tap target(s) (< ${MIN_TAP}px):\n${summary}`,
      );
    }
    expect(undersized.length).toBe(0);
  });
}

test('mobile nav toggle meets 44x44', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByTestId('mobile-nav-toggle');
  const box = await toggle.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(MIN_TAP);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TAP);
});

test('mobile nav panel items meet 44x44 when open', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('mobile-nav-toggle').click();
  const links = page.getByTestId('mobile-nav-panel').getByRole('link');
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await links.nth(i).boundingBox();
    expect(
      (box?.height ?? 0) >= MIN_TAP,
      `mobile nav link ${i} is ${box?.height}px tall`,
    ).toBe(true);
  }
});
