import { expect, test } from '@playwright/test';

const QB_ID = process.env.E4_TEST_QB_ID ?? '00-0039851'; // Drake Maye

test.describe('E4 smoke', () => {
  test('QB page renders hero stats + starter toggle', async ({ page }) => {
    await page.goto(`/players/qb/${QB_ID}`);
    await expect(page.getByTestId('player-header')).toBeVisible();
    await expect(page.getByTestId('qb-hero-stats')).toBeVisible();
    await expect(page.getByRole('button', { pressed: true, name: /primary starter/i })).toBeVisible();
  });

  test('QB starter toggle flips pressed state', async ({ page }) => {
    await page.goto(`/players/qb/${QB_ID}`);
    const primary = page.getByRole('button', { name: /primary starter/i });
    const all = page.getByRole('button', { name: /all games/i });
    await expect(primary).toHaveAttribute('aria-pressed', 'true');
    await all.click();
    await expect(primary).toHaveAttribute('aria-pressed', 'false');
    await expect(all).toHaveAttribute('aria-pressed', 'true');
  });

  test('defense unit page renders with methodology callout', async ({ page }) => {
    await page.goto('/team/units/defense');
    await expect(page.getByTestId('unit-hero')).toBeVisible();
    await expect(page.getByText(/individual defender ratings/i)).toBeVisible();
  });

  test('OL and DL unit pages render', async ({ page }) => {
    await page.goto('/team/units/offensive-line');
    await expect(page.getByTestId('unit-hero')).toBeVisible();
    await page.goto('/team/units/defensive-line');
    await expect(page.getByTestId('unit-hero')).toBeVisible();
  });

  test('unknown unit slug 404s', async ({ page }) => {
    const res = await page.goto('/team/units/nonsense');
    expect(res?.status()).toBe(404);
  });

  test('unknown QB id 404s', async ({ page }) => {
    const res = await page.goto('/players/qb/not-a-real-id');
    expect(res?.status()).toBe(404);
  });

  test('phase page shows real contributor cards (not placeholder)', async ({ page }) => {
    await page.goto('/phases/pass_offense');
    const cards = page.locator('[data-testid^="contributor-card-"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });
});
