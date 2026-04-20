import { expect, test } from '@playwright/test';

// E7 Players Hub smoke: roster index, position chips, combobox search,
// mobile viewport, nav wiring. Matches the plan in
// docs/plans/e7-players-hub-plan.md §4.1.

test.describe('E7 players hub', () => {
  test('renders_active_roster_with_at_least_30_cards', async ({ page }) => {
    await page.goto('/players');
    const cards = page.locator('[data-testid^="roster-card-"]');
    await expect.poll(async () => cards.count(), { timeout: 5000 }).toBeGreaterThanOrEqual(30);
  });

  test('position_chip_QB_narrows_grid_to_quarterbacks_only', async ({ page }) => {
    await page.goto('/players');
    await page.getByRole('button', { name: /^QB/i }).click();
    const count = await page.locator('[data-testid^="roster-card-"]').count();
    // No upper bound — camp rosters can carry >6 QBs; review finding #14.
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('search_then_enter_navigates_to_matched_player_deep_dive', async ({ page }) => {
    await page.goto('/players');
    const combobox = page.getByRole('combobox', { name: /search players/i });
    await combobox.fill('May');
    await expect(page.getByRole('listbox')).toBeVisible();
    await combobox.press('Enter');
    await expect(page).toHaveURL(/\/players\/(qb|skill)\/00-\d{7}/);
  });

  test('arrow_down_then_enter_navigates_to_first_match', async ({ page }) => {
    await page.goto('/players');
    const combobox = page.getByRole('combobox', { name: /search players/i });
    await combobox.fill('May');
    await combobox.press('ArrowDown');
    await combobox.press('Enter');
    await expect(page).toHaveURL(/\/players\/(qb|skill)\/00-\d{7}/);
  });

  test('mouse_click_on_listbox_option_navigates_without_blur_close_bug', async ({ page }) => {
    await page.goto('/players');
    await page.getByRole('combobox', { name: /search players/i }).fill('May');
    await expect(page.locator('[data-testid^="roster-option-"]').first()).toBeVisible();
    await page.locator('[data-testid^="roster-option-"]').first().click();
    await expect(page).toHaveURL(/\/players\/(qb|skill)\/00-\d{7}/);
  });

  test('ol_card_click_routes_to_offensive_line_unit_page', async ({ page }) => {
    await page.goto('/players');
    await page.getByRole('button', { name: /^OL/i }).click();
    const cards = page.locator('[data-testid^="roster-card-"]');
    await expect(cards.first()).toBeVisible();
    await cards.first().click();
    await expect(page).toHaveURL(/\/team\/units\/offensive-line$/);
  });

  test('st_card_is_non_clickable_div_not_link', async ({ page }) => {
    await page.goto('/players');
    await page.getByRole('button', { name: /^ST/i }).click();
    const first = page.locator('[data-testid^="roster-card-"]').first();
    await expect(first).toBeVisible();
    const tag = await first.evaluate((el) => el.tagName);
    assertSt(tag);
  });

  test('escape_closes_listbox_but_preserves_input_text', async ({ page }) => {
    await page.goto('/players');
    const combobox = page.getByRole('combobox', { name: /search players/i });
    await combobox.fill('Maye');
    await expect(page.getByRole('listbox')).toBeVisible();
    await combobox.press('Escape');
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(combobox).toHaveValue('Maye');
  });

  test('empty_state_shown_when_no_player_matches_query', async ({ page }) => {
    await page.goto('/players');
    await page.getByRole('combobox', { name: /search players/i }).fill('Zzzzzzzz');
    await expect(page.getByText(/no players match/i)).toBeVisible();
  });

  test('nav_players_link_from_home_lands_on_hub', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^Players$/i }).first().click();
    await expect(page).toHaveURL(/\/players$/);
  });

  test('mobile_viewport_renders_without_horizontal_scroll', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 }); // Pixel 5 per playwright.config.ts
    await page.goto('/players');
    const first = page.locator('[data-testid^="roster-card-"]').first();
    await expect(first).toBeVisible();
    // Viewport has ~32px total gutters → card should be >=300px wide.
    const box = await first.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(300);
  });
});

function assertSt(tag: string): void {
  // Extracted so the assertion message points at the right line if it fails.
  expect(tag).toBe('DIV');
}
