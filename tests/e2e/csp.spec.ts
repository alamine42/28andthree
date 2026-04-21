import { expect, test } from '@playwright/test';

// E6-09: CSP present + no browser-console violations on representative routes.
// Run against the dev server; dev profile allows 'unsafe-eval' + ws: for HMR
// but still enforces the envelope (no inline scripts from unknown origins,
// no object, no frame, narrow connect-src).

const ROUTES = ['/', '/draft-roi', '/coaching', '/methodology'];

test.describe('E6-09 CSP', () => {
  for (const path of ROUTES) {
    test(`${path} returns Content-Security-Policy header`, async ({ request }) => {
      const res = await request.get(path);
      const csp = res.headers()['content-security-policy'];
      expect(csp, `${path} missing CSP header`).toBeTruthy();

      // Core envelope directives must be present on every response.
      expect(csp).toMatch(/default-src 'self'/);
      expect(csp).toMatch(/script-src/);
      expect(csp).toMatch(/frame-ancestors 'none'/);
      expect(csp).toMatch(/object-src 'none'/);
      expect(csp).toMatch(/base-uri 'self'/);

      // Must NOT ship the Report-Only header — we've graduated to enforced.
      expect(
        res.headers()['content-security-policy-report-only'],
        `${path} still emits Report-Only`,
      ).toBeFalsy();
    });

    test(`${path} loads without CSP console violations`, async ({ page }) => {
      const violations: string[] = [];
      page.on('console', (msg) => {
        const text = msg.text();
        if (/Content Security Policy|CSP/i.test(text)) {
          violations.push(text);
        }
      });
      page.on('pageerror', (err) => {
        if (/Content Security Policy|CSP/i.test(err.message)) {
          violations.push(err.message);
        }
      });
      await page.goto(path, { waitUntil: 'networkidle' });
      expect(
        violations,
        `CSP violations on ${path}:\n  ${violations.join('\n  ')}`,
      ).toEqual([]);
    });
  }

  test('/og is exempted from the middleware CSP rewrite', async ({ request }) => {
    // The image route handler writes its own image/png response. The
    // middleware matcher explicitly skips /og, so the response should not
    // carry our document CSP (which would be meaningless for a binary).
    const res = await request.get('/og?title=Smoke');
    expect(res.headers()['content-security-policy']).toBeFalsy();
  });
});
