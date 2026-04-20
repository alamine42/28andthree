import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// E3-14: axe-core scan on representative routes. WCAG 2.1 AA. Fails on any
// serious/critical violation. Minor/moderate issues are surfaced in the
// report but don't fail the test — catching the worst offenders first.

const QB_ID = process.env.E4_TEST_QB_ID ?? '00-0039851';

const ROUTES = [
  '/',
  '/players',
  '/draft-roi',
  '/coaching',
  '/phases/pass_offense',
  `/players/qb/${QB_ID}`,
  '/team/units/defense',
] as const;

test.describe('a11y — axe scan', () => {
  for (const route of ROUTES) {
    test(`no serious or critical violations on ${route}`, async ({ page }) => {
      await page.goto(route);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );

      if (blocking.length > 0) {
        // Surface a concise list of problems so CI output is readable.
        const summary = blocking
          .map((v) => `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'})`)
          .join('\n');
        throw new Error(`axe found ${blocking.length} blocking issue(s) on ${route}:\n${summary}`);
      }

      expect(blocking.length).toBe(0);
    });
  }
});
