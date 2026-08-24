import { expect, test } from '@playwright/test';

// E11: historical season browsing (plan §5). Runs against the real DB —
// 2023 is a completed season (4-13) that the archive must serve.

test.describe('E11 historical season browsing', () => {
  test('switching to 2023 from home shows 2023 data + marker + URL', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('season-switcher').click();
    await page
      .getByTestId('season-switcher-menu')
      .getByRole('link', { name: /2023/ })
      .click();
    await expect(page).toHaveURL(/\?season=2023/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('2023');
    await expect(page.getByTestId('historical-marker')).toBeVisible();
    await expect(page.getByTestId('season-switcher')).toContainText('2023');
  });

  test('direct load of /?season=2023 renders the shared view', async ({ page }) => {
    await page.goto('/?season=2023');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('2023');
    await expect(page.getByTestId('historical-marker')).toBeVisible();
  });

  test('back to current returns to the clean URL', async ({ page }) => {
    await page.goto('/?season=2023');
    await page.getByTestId('historical-marker').getByRole('link').click();
    await expect(page).not.toHaveURL(/season=/);
    await expect(page.getByTestId('historical-marker')).toHaveCount(0);
  });

  test('nav links carry the season; Draft detour ignores it and Team restores it', async ({ page }) => {
    await page.goto('/?season=2023');
    const nav = page.locator('nav[aria-label="Primary"]');
    await expect(nav.getByRole('link', { name: 'Coaching' })).toHaveAttribute(
      'href',
      '/coaching?season=2023',
    );
    // Detour: Draft ignores the param (no marker), but keeps carrying it.
    await nav.getByRole('link', { name: 'Draft' }).click();
    await expect(page.getByTestId('historical-marker')).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Team' })).toHaveAttribute(
      'href',
      '/?season=2023',
    );
    await nav.getByRole('link', { name: 'Team' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('2023');
  });

  test('phase card from historical home keeps the season', async ({ page }) => {
    await page.goto('/?season=2023');
    await page.getByTestId('phase-card-pass_offense').click();
    await expect(page).toHaveURL(/\/phases\/pass_offense\?season=2023/);
    await expect(page.getByTestId('historical-marker')).toBeVisible();
  });

  test('invalid params render the current season cleanly', async ({ page }) => {
    for (const q of ['abc', '1999', '2023x']) {
      await page.goto(`/?season=${q}`);
      await expect(page.getByTestId('historical-marker')).toHaveCount(0);
      await expect(
        page.locator('nav[aria-label="Primary"]').getByRole('link', { name: 'Team' }),
      ).toHaveAttribute('href', '/');
    }
  });

  test('current-season param redirects to the clean URL', async ({ page }) => {
    const response = await page.goto('/?season=2099');
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId('historical-marker')).toHaveCount(0);
  });

  test('direct /s hit redirects to the public form', async ({ request }) => {
    const res = await request.get('/s/2023/coaching', { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers()['location']).toContain('/coaching?season=2023');
  });

  test('historical phase page renders real season data', async ({ page }) => {
    await page.goto('/phases/pass_offense?season=2021');
    await expect(page.getByTestId('phase-rank-card')).toBeVisible();
    await expect(page.locator('body')).toContainText('2021');
  });
});
