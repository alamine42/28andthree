import { expect, test } from '@playwright/test';

// E5: Pats Differentiators smoke. Tests are structural + data-tolerant —
// when the ETL hasn't populated the E5 tables yet, the pages render empty
// states and the smoke asserts those; once data exists, the richer
// assertions kick in automatically via the data-testid checks.

test.describe('E5 draft-roi + coaching', () => {
  test('draft_roi_eyebrow_and_heading_render', async ({ page }) => {
    await page.goto('/draft-roi');
    await expect(page.getByTestId('draft-eyebrow')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('draft_roi_shows_data_or_empty_state', async ({ page }) => {
    await page.goto('/draft-roi');
    const classes = page.locator('[data-testid^="draft-class-"]');
    const empty = page.getByTestId('draft-empty-state');
    const nClasses = await classes.count();
    if (nClasses === 0) {
      await expect(empty).toBeVisible();
    } else {
      // At most 5 draft classes + 5 class summaries (test-id^="draft-class-")
      expect(nClasses).toBeLessThanOrEqual(10);
    }
  });

  test('coaching_eyebrow_and_heading_render', async ({ page }) => {
    await page.goto('/coaching');
    await expect(page.getByTestId('coaching-eyebrow')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('coaching_shows_data_or_empty_state', async ({ page }) => {
    await page.goto('/coaching');
    const banner = page.getByTestId('coach-segment-banner');
    const empty = page.getByTestId('coaching-empty-state');
    const hasData = await banner.isVisible().catch(() => false);
    const isEmpty = await empty.isVisible().catch(() => false);
    expect(hasData !== isEmpty).toBe(true);
  });

  test('coaching_fourth_down_either_scatter_or_pending_callout', async ({ page }) => {
    await page.goto('/coaching');
    const empty = page.getByTestId('coaching-empty-state');
    const isEmpty = await empty.isVisible().catch(() => false);
    if (isEmpty) return; // whole-page empty state; skip fourth-down assertion.
    const scatter = page.getByTestId('fourth-down-scatter');
    const pending = page.getByTestId('fourth-down-pending');
    const scatterVisible = await scatter.isVisible().catch(() => false);
    const pendingVisible = await pending.isVisible().catch(() => false);
    expect(scatterVisible !== pendingVisible).toBe(true);
  });

  test('coaching_methodology_callout_visible', async ({ page }) => {
    await page.goto('/coaching');
    await expect(page.getByTestId('coaching-methodology-callout')).toBeVisible();
  });

  test('draft_methodology_callout_visible', async ({ page }) => {
    await page.goto('/draft-roi');
    await expect(page.getByTestId('draft-methodology-callout')).toBeVisible();
  });

  test('nav_draft_link_lands_on_draft_roi', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^Draft$/i }).first().click();
    await expect(page).toHaveURL(/\/draft-roi$/);
  });

  test('nav_coaching_link_lands_on_coaching', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^Coaching$/i }).first().click();
    await expect(page).toHaveURL(/\/coaching$/);
  });

  test('mobile_viewport_draft_roi_renders', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/draft-roi');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('mobile_viewport_coaching_renders', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/coaching');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
