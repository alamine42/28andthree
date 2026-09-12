import { expect, test } from '@playwright/test';

// bd patsbythenumbers-3ww: the awaiting-data shell. From February to
// September the site shows a season with no rows: the notice renders, the
// phase grid still renders as cards with em-dash ranks, the phase detail
// page renders a placeholder instead of a 404, and nothing shows a number
// it does not have. PR #20 pinned the data specs to a completed season, so
// this state had no positive assertion anywhere.
//
// Driven through the `x-sandbox-season-state` header, read by
// lib/sandbox/season-state.ts and honoured by every data stub.
// Run with: pnpm playwright test -c playwright.sandbox.config.ts

const AWAITING = { extraHTTPHeaders: { 'x-sandbox-season-state': 'awaiting' } };

test.describe('awaiting-data shell', () => {
  test('home renders the notice, countdown eyebrow, and empty phase cards', async ({ browser }) => {
    const ctx = await browser.newContext(AWAITING);
    const page = await ctx.newPage();
    await page.goto('/');

    const notice = page.getByTestId('season-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('2026');
    await expect(notice).toContainText("haven't taken a regular-season snap yet");

    const eyebrow = page.getByTestId('season-eyebrow');
    await expect(eyebrow).toContainText('2026');
    await expect(eyebrow).toContainText('KICKOFF IN 12 DAYS');

    // Every phase still gets a card; none carries a rank or a sparkline.
    const cards = page.locator('[data-testid^="phase-card-"]');
    await expect(cards).toHaveCount(11);
    for (const card of await cards.all()) {
      await expect(card).toContainText('—');
      await expect(card.locator('svg')).toHaveCount(0);
    }
    await expect(page.getByTestId('hero-stats')).toBeVisible();
    await expect(page.getByTestId('week-results')).toHaveCount(0);

    await ctx.close();
  });

  test('phase detail renders the placeholder, not a 404', async ({ browser }) => {
    const ctx = await browser.newContext(AWAITING);
    const page = await ctx.newPage();
    const res = await page.goto('/phases/rush_offense');
    expect(res?.status()).toBe(200);

    await expect(page.getByTestId('season-notice')).toBeVisible();
    const placeholder = page.getByTestId('no-season-data');
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toContainText('No 2026 stats for this view yet');
    await expect(page.getByTestId('distribution-plot')).toHaveCount(0);

    await ctx.close();
  });

  test('control: without the header the live season renders as before', async ({ page }) => {
    await page.goto('/phases/rush_offense');
    await expect(page.getByTestId('season-notice')).toHaveCount(0);
    await expect(page.getByTestId('no-season-data')).toHaveCount(0);
    await expect(page.getByTestId('distribution-plot')).toBeVisible();
  });
});
