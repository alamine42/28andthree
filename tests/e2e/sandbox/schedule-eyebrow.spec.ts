import { expect, test } from '@playwright/test';

// E9 / bd-8rd.6: schedule-aware eyebrow + footer e2e. Drives the
// home page through all three schedule phases via the
// `x-sandbox-schedule-phase` header (read by lib/sandbox/stubs/schedule.ts).
// Run with: pnpm playwright test -c playwright.sandbox.config.ts

test.describe('schedule-aware eyebrow + footer', () => {
  test('regular phase renders IN PROGRESS eyebrow + live-dot footer', async ({ browser }) => {
    const ctx = await browser.newContext({
      extraHTTPHeaders: { 'x-sandbox-schedule-phase': 'regular' },
    });
    const page = await ctx.newPage();
    await page.goto('/');

    const eyebrow = page.getByTestId('season-eyebrow');
    await expect(eyebrow).toContainText('SEASON');
    await expect(eyebrow).toContainText('IN PROGRESS');

    const refresh = page.getByTestId('footer-refresh-line');
    await expect(refresh).toContainText('Last refresh');

    await ctx.close();
  });

  test('playoffs phase renders PLAYOFFS · WILD CARD eyebrow', async ({ browser }) => {
    const ctx = await browser.newContext({
      extraHTTPHeaders: { 'x-sandbox-schedule-phase': 'playoffs' },
    });
    const page = await ctx.newPage();
    await page.goto('/');

    const eyebrow = page.getByTestId('season-eyebrow');
    await expect(eyebrow).toContainText('PLAYOFFS');
    await expect(eyebrow).toContainText('WILD CARD');

    await ctx.close();
  });

  test('offseason phase renders FINAL · NEXT GAME IN N DAYS eyebrow + dimmed footer', async ({ browser }) => {
    const ctx = await browser.newContext({
      extraHTTPHeaders: { 'x-sandbox-schedule-phase': 'offseason' },
    });
    const page = await ctx.newPage();
    await page.goto('/');

    const eyebrow = page.getByTestId('season-eyebrow');
    await expect(eyebrow).toContainText('FINAL');
    await expect(eyebrow).toContainText(/NEXT GAME IN \d+ DAYS/);

    const refresh = page.getByTestId('footer-refresh-line');
    await expect(refresh).toContainText(/Next refresh after .+ kickoff/);

    await ctx.close();
  });
});
