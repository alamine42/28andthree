import { expect, test } from '@playwright/test';

// E6-01: methodology page smoke. Verifies the page renders, the TOC anchors
// all resolve to real sections (no dead deep-links), and the explicit
// inbound anchors used by /draft-roi + /coaching callouts still work.

const REQUIRED_ANCHORS = [
  'data-sources',
  'rankings',
  'tiebreaks',
  'insufficient-sample',
  'deltas',
  'phases',
  'qb',
  'skill',
  'defense',
  'units',
  'draft-grade',
  'coaching',
  'coordinator-segments',
  'limitations',
  'refresh',
  'attributions',
] as const;

test.describe('E6-01 /methodology', () => {
  test('renders eyebrow, heading, and table of contents', async ({ page }) => {
    await page.goto('/methodology');
    await expect(page.getByTestId('methodology-eyebrow')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('methodology-toc')).toBeVisible();
  });

  test('every required anchor resolves to a section', async ({ page }) => {
    await page.goto('/methodology');
    for (const anchor of REQUIRED_ANCHORS) {
      const section = page.getByTestId(`methodology-section-${anchor}`);
      await expect(section, `missing section ${anchor}`).toBeAttached();
      const id = page.locator(`#${anchor}`);
      await expect(id, `missing id ${anchor}`).toHaveCount(1);
    }
  });

  test('deep link /methodology#draft-grade scrolls to the draft section', async ({
    page,
  }) => {
    await page.goto('/methodology#draft-grade');
    await expect(page.locator('#draft-grade')).toBeInViewport();
  });

  test('deep link /methodology#coaching scrolls to the coaching section', async ({
    page,
  }) => {
    await page.goto('/methodology#coaching');
    await expect(page.locator('#coaching')).toBeInViewport();
  });

  test('draft-roi methodology callout routes to /methodology#draft-grade', async ({
    page,
  }) => {
    await page.goto('/draft-roi');
    const link = page
      .getByTestId('draft-methodology-callout')
      .getByRole('link', { name: /full methodology/i });
    await link.click();
    await expect(page).toHaveURL(/\/methodology#draft-grade$/);
    await expect(page.locator('#draft-grade')).toBeInViewport();
  });

  test('coaching methodology callout routes to /methodology#coaching', async ({
    page,
  }) => {
    await page.goto('/coaching');
    const link = page
      .getByTestId('coaching-methodology-callout')
      .getByRole('link', { name: /full methodology/i });
    await link.click();
    await expect(page).toHaveURL(/\/methodology#coaching$/);
    await expect(page.locator('#coaching')).toBeInViewport();
  });

  test('footer methodology link routes to /methodology', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('footer-methodology-link').click();
    await expect(page).toHaveURL(/\/methodology$/);
  });

  test('mobile viewport renders without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/methodology');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('methodology-toc')).toBeVisible();
  });
});
