import { expect, test } from '@playwright/test';

// E6-04: sitemap.xml + robots.txt. Acceptance: sitemap returns valid XML
// with >= 25 URLs (19 fixed + roster additions). Robots disallows internal
// routes and points at the sitemap.

test.describe('E6-04 sitemap + robots', () => {
  test('/sitemap.xml returns valid XML with >= 25 <url> entries', async ({
    request,
  }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/xml');

    const xml = await res.text();
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<urlset');

    const urls = xml.match(/<loc>[^<]+<\/loc>/g) ?? [];
    expect(urls.length, `sitemap has ${urls.length} URLs, need >= 25`).toBeGreaterThanOrEqual(25);
  });

  test('/sitemap.xml covers the load-bearing fixed routes', async ({
    request,
  }) => {
    const res = await request.get('/sitemap.xml');
    const xml = await res.text();
    const required = [
      '/',
      '/players',
      '/draft-roi',
      '/coaching',
      '/methodology',
      '/phases/pass_offense',
      '/phases/overall',
      '/team/units/defense',
    ];
    for (const path of required) {
      // Exact URL match (domain + path) — avoids matching /players inside
      // /players/qb/ prefix when path is `/players`.
      const re = new RegExp(`<loc>[^<]+${escapeRe(path)}</loc>`);
      expect(
        re.test(xml),
        `sitemap missing ${path}`,
      ).toBe(true);
    }
  });

  test('/robots.txt disallows internal routes and points at the sitemap', async ({
    request,
  }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/User-Agent: \*/i);
    expect(body).toMatch(/Disallow:\s*\/status/);
    expect(body).toMatch(/Disallow:\s*\/tokens/);
    expect(body).toMatch(/Disallow:\s*\/api\//);
    expect(body).toMatch(/Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/);
  });
});

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
