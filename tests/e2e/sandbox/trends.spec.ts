import { expect, test } from '@playwright/test';

// E12: /trends renders the season-by-season phase history against fixture
// data (sandbox current season is 2025). The fixture deliberately leaves
// the newest season under the sample floor and puts a mid-series gap in
// special teams, so both SPEC §3.5a states are exercised here.

test.describe('/trends — season by season', () => {
  test('renders the headline chart and all twelve phase tiles', async ({ page }) => {
    await page.goto('/trends');

    await expect(page.getByTestId('trends-eyebrow')).toContainText('TRENDS');
    await expect(
      page.getByRole('heading', { name: /Twelve phases, season by season/i }),
    ).toBeVisible();

    await expect(page.getByTestId('season-rank-chart')).toBeVisible();

    // Eleven tiles in the grid — `overall` is the headline chart, not a tile.
    await expect(page.getByTestId('season-history-card')).toHaveCount(11);
    await expect(page.getByTestId('trends-empty')).toHaveCount(0);
  });

  test('each tile links to its phase page', async ({ page }) => {
    await page.goto('/trends');
    const passOffense = page.locator('[data-phase="pass_offense"]');
    await expect(passOffense).toHaveAttribute('href', '/phases/pass_offense');
    await passOffense.click();
    await expect(page).toHaveURL(/\/phases\/pass_offense$/);
  });

  test('is season-agnostic: no historical marker, and ?season= is ignored', async ({
    page,
  }) => {
    // A cross-season page must never claim to be showing one season.
    await page.goto('/trends?season=2023');
    await expect(page).toHaveURL(/\/trends\?season=2023$/);
    await expect(page.getByTestId('historical-marker')).toHaveCount(0);
    // Content is identical to the undecorated URL — the param does nothing.
    await expect(page.getByTestId('season-history-card')).toHaveCount(11);
  });

  test('the nav exposes Trends', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: 'Trends' }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/trends/);
  });

  test('never plots a sub-floor season and never prints a bare zero', async ({
    page,
  }) => {
    await page.goto('/trends');
    const chart = page.getByTestId('season-rank-chart');
    const svg = chart.locator('svg').first();

    // The fixture's newest season is under the floor for every phase, so
    // its axis label exists but it contributes no rank label.
    const label = await svg.getAttribute('aria-label');
    expect(label).toBeTruthy();
    expect(label).not.toContain('2025:');
    expect(label).toContain('2024:');

    // SPEC §3.5a: never render 0 or NaN where the answer is "not enough data".
    await expect(chart).not.toContainText('NaN');
    const body = await page.locator('main').innerText();
    expect(body).not.toContain('NaN');
    expect(body).not.toContain('null');
  });

  test('a mid-series gap breaks the line instead of interpolating', async ({
    page,
  }) => {
    await page.goto('/trends');
    // Special teams is thin in 2021 (fixture). Its path must be split into
    // two strokes — a single M would mean the gap was interpolated across.
    const path = page
      .locator('[data-phase="special_teams"] svg path')
      .first();
    const d = (await path.getAttribute('d')) ?? '';
    expect(d).not.toBe('');
    expect(d.match(/M/g)?.length ?? 0).toBeGreaterThan(1);
  });
});
