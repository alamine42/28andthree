import { expect, test } from '@playwright/test';

// E3 epic smoke: home renders with data, phase detail routes work, toggle
// flips state, unknown slug 404s. Kept focused — the no-bad-numbers spec
// covers the exhaustive numeric-sanity crawl.

test.describe('E3 smoke', () => {
  test('home renders hero stats + 11 phase cards with real data', async ({ page }) => {
    await page.goto('/');

    // Eyebrow + H1 render
    await expect(page.getByTestId('season-eyebrow')).toBeVisible();

    // Phase grid present with 11 cards. `overall` is shown in the hero above
    // the grid; rendering it again as a card would double-count it.
    const cards = page.locator('[data-testid^="phase-card-"]');
    await expect(cards).toHaveCount(11);

    // At least one card shows a real ordinal rank (e.g. "1st", "22nd", "32nd").
    const firstRank = page.getByTestId('phase-card-pass_offense').locator('[data-numeric="true"]').first();
    const text = (await firstRank.textContent())?.trim() ?? '';
    expect(text).toMatch(/^\d{1,2}(st|nd|rd|th)$/);
  });

  test('clicking a phase card navigates to the phase detail page', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('phase-card-pass_offense').click();
    await expect(page).toHaveURL(/\/phases\/pass_offense$/);
    await expect(page.getByRole('heading', { name: /pass offense/i })).toBeVisible();
  });

  test('phase detail shows rank card + trend chart + distribution plot', async ({ page }) => {
    await page.goto('/phases/pass_offense');
    await expect(page.getByTestId('phase-rank-card')).toBeVisible();
    await expect(page.getByTestId('trend-chart')).toBeVisible();
    await expect(page.getByTestId('distribution-plot')).toBeVisible();
  });

  test('distribution plot has the Pats dot with data-team NE', async ({ page }) => {
    await page.goto('/phases/pass_offense');
    const ne = page.locator('[data-testid="distribution-plot"] [data-team="NE"]');
    await expect(ne).toBeVisible();
    await expect(ne).toHaveAttribute('data-tier', /positive|neutral|negative/);
  });

  test('trend chart rolling/raw toggle updates aria-pressed state', async ({ page }) => {
    await page.goto('/phases/pass_offense');
    const rolling = page.getByRole('button', { name: /rolling/i });
    await expect(rolling).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: /raw/i }).click();
    await expect(rolling).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: /raw/i })).toHaveAttribute('aria-pressed', 'true');
  });

  test('unknown phase slug returns 404', async ({ page }) => {
    const res = await page.goto('/phases/nonsense');
    expect(res?.status()).toBe(404);
  });
});
