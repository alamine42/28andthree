import { expect, test } from '@playwright/test';

// E11-08: header SeasonSwitcher (fixture data — sandbox current season is
// 2025). Menu items must be real links (open-in-new-tab is the
// era-comparison affordance), the pill must expose expanded state, Escape
// closes with focus returned to the pill, and an invalid ?season= must
// never light up the historical state (review CRITICAL: split-brain
// validation).

test.describe('season switcher', () => {
  test('pill renders in the header with the current season', async ({ page }) => {
    await page.goto('/');
    const pill = page.getByTestId('season-switcher');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText('2025');
    await expect(pill).toHaveAttribute('aria-expanded', 'false');
  });

  test('menu items are links carrying ?season=', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('season-switcher').click();
    const menu = page.getByTestId('season-switcher-menu');
    await expect(menu).toBeVisible();
    // Options are <a> elements — middle-click / cmd-click must work.
    const link2023 = menu.getByRole('link', { name: /2023/ });
    await expect(link2023).toHaveAttribute('href', '/?season=2023');
    // Newest first: first link is the current season, marked CURRENT.
    const first = menu.getByRole('link').first();
    await expect(first).toContainText('2025');
    await expect(first).toContainText('CURRENT');
  });

  test('escape closes the menu and returns focus to the pill', async ({ page }) => {
    await page.goto('/');
    const pill = page.getByTestId('season-switcher');
    await pill.click();
    await expect(page.getByTestId('season-switcher-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('season-switcher-menu')).toHaveCount(0);
    await expect(pill).toBeFocused();
  });

  test('invalid season param does not light up the historical state', async ({ page }) => {
    await page.goto('/?season=2023x');
    const pill = page.getByTestId('season-switcher');
    await expect(pill).toContainText('2025');
    await expect(page.getByTestId('historical-marker')).toHaveCount(0);
    // Nav links must not propagate the junk param.
    const teamLink = page.locator('nav[aria-label="Primary"] a', { hasText: 'Team' });
    await expect(teamLink).toHaveAttribute('href', '/');
  });

  test('switcher on a season-agnostic page targets the home page', async ({ page }) => {
    await page.goto('/draft-roi');
    await page.getByTestId('season-switcher').click();
    const menu = page.getByTestId('season-switcher-menu');
    const link2023 = menu.getByRole('link', { name: /2023/ });
    await expect(link2023).toHaveAttribute('href', '/?season=2023');
  });

  test('mobile 375px: wordmark, pill, and hamburger fit without overlap', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 700 } });
    const page = await ctx.newPage();
    await page.goto('/');
    const pill = page.getByTestId('season-switcher');
    const burger = page.getByTestId('mobile-nav-toggle');
    const mark = page.getByTestId('wordmark');
    for (const el of [pill, burger, mark]) await expect(el).toBeVisible();
    const [p, b, m] = await Promise.all([
      pill.boundingBox(),
      burger.boundingBox(),
      mark.boundingBox(),
    ]);
    // No horizontal overlap between the three header pieces.
    expect(m!.x + m!.width).toBeLessThanOrEqual(p!.x + 1);
    expect(p!.x + p!.width).toBeLessThanOrEqual(b!.x + 1);
    // No page-level horizontal scroll.
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollW).toBeLessThanOrEqual(375);
    await ctx.close();
  });
});
