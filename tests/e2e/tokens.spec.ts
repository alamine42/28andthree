import { expect, test } from '@playwright/test';

// Token contract for DESIGN.md §Color. Dark mode only in E1 (light mode
// deferred per SPEC §11).
//
// Why this is not a screenshot test: this spec used to be a full-page pixel
// diff against `tokens-dark.png`. Playwright names baselines per platform, so
// the committed macOS baseline could never satisfy the Linux CI runner, and the
// test failed on every run. Carrying a second Linux baseline would fix the
// filename but keeps the real problems: the assertion goes red on font and
// renderer changes that have nothing to do with the tokens, it never names
// which token moved, and both images need regeneration on every DESIGN.md
// edit. A pixel diff also sits badly against SPEC §8, which puts the test
// weight on data contracts plus smoke tests rather than render logic.
//
// Asserting the computed custom-property values is platform-independent, names
// the token that drifted, and is strictly stronger: a self-generated baseline
// only proves "unchanged since capture", while the table below proves the CSS
// still matches DESIGN.md. Keep it in sync with DESIGN.md §Color by hand — that
// is the point of the test.
//
// `tests/e2e/e1.spec.ts` keeps a lighter "swatches resolve" smoke check, since
// the nightly cross-browser matrix runs only that file.

const DARK_TOKENS: Record<string, string> = {
  '--bg': '#0b1520',
  '--surface': '#121e2b',
  '--surface-2': '#19273a',
  '--border': '#1f2d3d',
  '--border-strong': '#2c3e55',
  '--text': '#e8e6e1',
  '--text-muted': '#8a96a3',
  '--text-dim': '#5f6e80',
  '--accent': '#c81e36',
  '--accent-dim': '#a23a4a',
  '--positive': '#1abe58',
  '--positive-dim': '#0e5e2a',
  '--negative': '#d9707f',
  '--chart-neutral': '#5f6e80',
};

/** `rgb(11, 21, 32)` → `#0b1520`. Browsers normalize hex to rgb() in getComputedStyle. */
function rgbToHex(value: string): string {
  const match = value.match(/-?\d+(\.\d+)?/g);
  if (!match || match.length < 3) return value.trim().toLowerCase();
  return `#${match
    .slice(0, 3)
    .map((n) => Math.round(Number(n)).toString(16).padStart(2, '0'))
    .join('')}`;
}

test.describe('DESIGN.md tokens', () => {
  test('dark-mode custom properties match DESIGN.md §Color', async ({ page }) => {
    await page.goto('/tokens');

    const actual = await page.evaluate((names: string[]) => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        names.map((name) => [name, style.getPropertyValue(name).trim()]),
      ) as Record<string, string>;
    }, Object.keys(DARK_TOKENS));

    // Compare the whole map at once so a failure lists every token that drifted,
    // not just the first.
    const normalized = Object.fromEntries(
      Object.entries(actual).map(([name, value]) => [name, value.toLowerCase()]),
    );
    expect(normalized).toEqual(DARK_TOKENS);
  });

  test('every /tokens swatch paints its own token value', async ({ page }) => {
    await page.goto('/tokens');

    const swatches = page.getByTestId(/^token-/);
    await expect(swatches.first()).toBeVisible();
    expect(await swatches.count()).toBe(Object.keys(DARK_TOKENS).length);

    for (const swatch of await swatches.all()) {
      const { cssVar, background } = await swatch.evaluate((node) => ({
        // The page renders the variable name as the second label line.
        cssVar: node.textContent?.match(/--[\w-]+/)?.[0] ?? '',
        background: getComputedStyle(node).backgroundColor,
      }));

      expect(DARK_TOKENS, `unknown token on /tokens: ${cssVar}`).toHaveProperty(cssVar);
      expect(rgbToHex(background), `swatch ${cssVar} paints the wrong color`).toBe(
        DARK_TOKENS[cssVar],
      );
    }
  });
});
