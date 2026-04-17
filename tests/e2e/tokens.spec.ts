import { expect, test } from '@playwright/test';

// Visual-regression baseline for DESIGN.md tokens. Dark mode only in E1 (light
// mode deferred per SPEC §11). Intentional changes to tokens must update the
// baseline image on purpose — snapshot diff will fail otherwise.
test.describe('DESIGN.md tokens visual regression', () => {
  test('dark-mode token grid matches baseline', async ({ page }) => {
    await page.goto('/tokens');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('tokens-dark.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    });
  });
});
