import { expect, test } from '@playwright/test';

// E6-09: CSP envelope validation.
//
// Local `next dev` cannot ship a nonce-based CSP without breaking Next's
// inline hydration scripts (Next doesn't propagate the nonce to them).
// So the middleware only attaches CSP on Vercel deploys, signalled by the
// `x-vercel-deployment-url` request header. Tests hitting localhost don't
// carry that header, so CSP isn't emitted — that's the expected dev shape.
//
// On Vercel (preview + prod) the CSP *is* present and blocks nothing; the
// full assertion suite from this file should be re-run against a preview
// URL before a release (TODO: wire into land-and-deploy).

test.describe('E6-09 CSP (dev shape)', () => {
  test('dev server does NOT attach CSP (Vercel-only by design)', async ({
    request,
  }) => {
    const res = await request.get('/');
    expect(res.headers()['content-security-policy']).toBeFalsy();
  });

  test('dev / loads without any CSP console violations', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (msg) => {
      if (/Content Security Policy|CSP/i.test(msg.text())) violations.push(msg.text());
    });
    page.on('pageerror', (err) => {
      if (/Content Security Policy|CSP/i.test(err.message)) violations.push(err.message);
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    expect(violations).toEqual([]);
  });

  test('/og is excluded from the middleware matcher regardless of env', async ({
    request,
  }) => {
    const res = await request.get('/og?title=Smoke');
    expect(res.headers()['content-security-policy']).toBeFalsy();
  });
});
