import { expect, test } from '@playwright/test';

// E6-07: styled 404 + error boundary.
// Acceptance: hitting a nonexistent path returns a styled 404 that keeps
// the site chrome (header/footer + disclaimer) and carries its own
// noindex + informative heading.

const NOT_FOUND_PATHS = [
  '/does-not-exist',
  '/phases/not_a_phase',
  '/players/qb/not-a-gsis-id',
  '/team/units/not-a-unit',
];

test.describe('E6-07 404 page', () => {
  for (const path of NOT_FOUND_PATHS) {
    test(`${path} renders the styled 404`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(404);
      await expect(page.getByTestId('not-found')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /Play not in the book/ }),
      ).toBeVisible();

      // Header + footer chrome still present.
      await expect(page.getByTestId('wordmark')).toBeVisible();
      await expect(
        page.getByText(/Independent fan project/),
      ).toBeVisible();

      // Three "pick a landing spot" nav cards each linking to a real page.
      const cards = page.getByLabel('Pick a landing spot').getByRole('link');
      await expect(cards).toHaveCount(3);
    });
  }

  test('404 page declares robots=noindex via metadata', async ({ request }) => {
    const res = await request.get('/does-not-exist');
    expect(res.status()).toBe(404);
    const html = await res.text();
    expect(html).toMatch(/name="robots"\s+content="noindex/);
  });
});
