import { devices, expect, test } from '@playwright/test';
import { UNIT_SLUGS } from '../../lib/constants/units';

// E6-05b: mobile pass for /players hub, QB/skill deep dives, and the three
// team-unit pages. Gates: no horizontal scroll at Pixel 5, interactive
// targets in main content >= 44x44.

const PIXEL_5 = devices['Pixel 5'];
const MIN_TAP = 44;

const QB_ID = process.env.E4_TEST_QB_ID ?? '00-0039851';
const SKILL_ID = process.env.E4_TEST_SKILL_ID ?? '00-0031588';

const ROUTES = [
  '/players',
  `/players/qb/${QB_ID}`,
  `/players/skill/${SKILL_ID}`,
  ...UNIT_SLUGS.map((slug) => `/team/units/${slug}`),
];

test.use({ viewport: PIXEL_5.viewport, userAgent: PIXEL_5.userAgent });

for (const route of ROUTES) {
  test(`${route} — no horizontal scroll at Pixel 5`, async ({ page }) => {
    await page.goto(route);
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      overflow.scrollWidth,
      `${route}: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`,
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
