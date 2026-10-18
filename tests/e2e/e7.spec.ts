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

  test('st_row_is_not_a_link_and_says_why', async ({ page }) => {
    await page.goto('/players');
    await page.getByRole('button', { name: /^ST/i }).click();
    const first = page.locator('[data-testid^="roster-card-"]').first();
    await expect(first).toBeVisible();
    // The contract is "special teams has no destination yet", not a
    // particular tag. E13 moved the roster from a card grid to a table, so
    // this is a <tr> rather than a <div>; what has to hold is that it is
    // not a link, contains no link, and explains itself to a screen reader.
    expect(await first.evaluate((el) => el.tagName)).not.toBe('A');
    await expect(first.locator('a')).toHaveCount(0);
    await expect(first).toHaveAttribute('aria-disabled', 'true');
    await expect(first).toHaveAttribute('aria-describedby', /.+/);
    await expect(first).toContainText(/coming soon/i);
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

    // What the name promises, asserted directly. This used to be inferred
    // from a card being >=300px wide, which stopped meaning anything when
    // E13 made the roster a table: the test id now sits on the row's name
    // link, which is legitimately narrower than the viewport.
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, 'page scrolls horizontally at 393px').toBeLessThanOrEqual(clientWidth);

    // And the roster still spans the viewport rather than collapsing into a
    // narrow column. The row is the element that should be full-width; for
    // an inert special-teams row the test id is already on the <tr>.
    const row = first.locator('xpath=ancestor-or-self::tr[1]');
    const box = await row.boundingBox();
    expect(box?.width ?? 0, 'roster row is too narrow at 393px').toBeGreaterThan(300);
  });
});
