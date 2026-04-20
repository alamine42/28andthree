import { devices, expect, test } from '@playwright/test';

// E6-05c: mobile pass for the remaining public + internal routes —
// /draft-roi, /coaching, /methodology, /status. Gates: no horizontal scroll
// at Pixel 5, interactive targets in <main> meet 44x44.

const PIXEL_5 = devices['Pixel 5'];
const MIN_TAP = 44;

const ROUTES = ['/draft-roi', '/coaching', '/methodology', '/status'];

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
      // Inline body-prose links (a link whose nearest block ancestor is a
      // <p> or <li> containing flowing text) are exempt from the 44x44
      // target-size rule per WCAG 2.5.5 / iOS HIG. We only audit
      // navigational / control-style interactive elements.
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
        // Inline-prose exemption per WCAG 2.5.5: body text and list-item
        // prose links don't need 44x44. Navigational links inside <nav>
        // (the methodology TOC, the site header) still get audited.
        const inProse = !!el.closest('p') || !!el.closest('li');
        const inNav = !!el.closest('nav');
        if (inProse && !inNav) continue;
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

test('nav drawer opens, lists primary links, closes on Escape', async ({
  page,
}) => {
  await page.goto('/draft-roi');
  const toggle = page.getByTestId('mobile-nav-toggle');
  const panel = page.getByTestId('mobile-nav-panel');

  await expect(panel).toBeHidden();
  await toggle.click();
  await expect(panel).toBeVisible();

  // Drawer contains all five primary links.
  const links = panel.getByRole('link');
  await expect(links).toHaveCount(5);

  // Escape closes the drawer per existing SiteHeader behavior.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});
