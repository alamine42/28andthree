import { expect, test } from '@playwright/test';

// E2 smoke: /status shows ETL data once loaded; /status/data enforces auth +
// rate limit; bad params → 400. Tests that need STATUS_ADMIN_TOKEN skip when
// it isn't in the env (so CI stays green before the secret lands).

test.describe('E2 smoke', () => {
  test('home still renders after E2 changes', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page).toHaveTitle(/28 and Three/i);
    expect(errors).toEqual([]);
  });

  test('/status renders every row count as a formatted number', async ({ page }) => {
    await page.goto('/status');
    const rowCounts = page.getByTestId('row-counts');
    // Only asserts presence when data has loaded — lets the test pass in a
    // pristine env without gating on the ETL having run.
    if (!(await rowCounts.isVisible())) return;

    // The grid mirrors the latest etl_runs row, and a heartbeat run records
    // only {heartbeat: 1}. Asserting a specific table ("plays") assumed the
    // last run was a full ingest, so this went red for every week the
    // freshness gate short-circuited. Assert the render contract instead:
    // at least one count, each a formatted integer.
    const values = rowCounts.locator('dl > div > span:last-child');
    const count = await values.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      expect((await values.nth(i).textContent())?.trim() ?? '').toMatch(/^\d{1,3}(,\d{3})*$/);
    }
  });

  test('/status/data unauthenticated returns 401', async ({ request }) => {
    const res = await request.get('/status/data?phase=pass_offense&season=2025');
    expect([401, 404, 503]).toContain(res.status());
    // 404 is acceptable during the preview-only gate; 503 if token not set.
  });

  test('/status/data with unknown phase returns 400 (when token is set)', async ({ request }) => {
    const token = process.env.STATUS_ADMIN_TOKEN;
    test.skip(!token, 'STATUS_ADMIN_TOKEN not set — skipping auth-gated test');
    const res = await request.get('/status/data?phase=nonsense&season=2025', {
      headers: { 'x-admin-token': token! },
    });
    // 400 for bad params, or 404 if preview-only gate active in prod.
    expect([400, 404]).toContain(res.status());
  });

  test('/status/data rejects season below 2020 (when token is set)', async ({ request }) => {
    const token = process.env.STATUS_ADMIN_TOKEN;
    test.skip(!token, 'STATUS_ADMIN_TOKEN not set — skipping auth-gated test');
    const res = await request.get('/status/data?phase=pass_offense&season=2019', {
      headers: { 'x-admin-token': token! },
    });
    expect([400, 404]).toContain(res.status());
  });

  test('/status/data happy path returns JSON array (when fully provisioned)', async ({
    request,
  }) => {
    const token = process.env.STATUS_ADMIN_TOKEN;
    const allowProd = process.env.STATUS_DATA_ALLOW_PROD === 'true';
    test.skip(!token, 'STATUS_ADMIN_TOKEN not set — skipping end-to-end test');
    const res = await request.get('/status/data?phase=pass_offense&season=2025', {
      headers: { 'x-admin-token': token! },
    });
    if (!allowProd && res.status() === 404) {
      test.skip(true, 'preview-only gate active — set STATUS_DATA_ALLOW_PROD=true post-cutover');
    }
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
