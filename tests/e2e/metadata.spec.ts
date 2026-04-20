import { expect, test } from '@playwright/test';

// E6-03: metadata audit. Every public route must export a unique <title>
// and <meta description>, and must emit a valid OG image URL pointing at
// the /og generator. Internal routes (/status, /tokens) must noindex.

const QB_ID = process.env.E4_TEST_QB_ID ?? '00-0039851';

type RouteSpec = {
  path: string;
  /** Skip uniqueness assertion if the page returns empty-state metadata
   *  (e.g., a dynamic page whose DB row is missing locally). */
  softIfEmpty?: boolean;
};

const ROUTES: ReadonlyArray<RouteSpec> = [
  { path: '/' },
  { path: '/players' },
  { path: '/draft-roi' },
  { path: '/coaching' },
  { path: '/methodology' },
  { path: '/phases/pass_offense' },
  { path: '/phases/run_defense' },
  { path: `/players/qb/${QB_ID}`, softIfEmpty: true },
  { path: '/team/units/defense' },
];

async function fetchMetadata(request: import('@playwright/test').APIRequestContext, path: string) {
  const res = await request.get(path);
  const html = await res.text();
  return {
    status: res.status(),
    title: html.match(/<title>([^<]*)<\/title>/)?.[1] ?? null,
    description:
      html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? null,
    ogImage:
      html.match(/<meta property="og:image" content="([^"]*)"/)?.[1] ?? null,
    robots: html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? null,
  };
}

test.describe('E6-03 metadata audit', () => {
  test('every public route exports a non-empty unique title', async ({ request }) => {
    const seen = new Map<string, string>();
    for (const r of ROUTES) {
      const m = await fetchMetadata(request, r.path);
      expect(m.status, `${r.path} not 200`).toBe(200);
      expect(m.title, `${r.path} missing <title>`).not.toBeNull();
      expect(m.title!.length, `${r.path} empty <title>`).toBeGreaterThan(0);
      const prior = seen.get(m.title!);
      if (prior && prior !== r.path) {
        throw new Error(
          `title collision: "${m.title}" used by both ${prior} and ${r.path}`,
        );
      }
      seen.set(m.title!, r.path);
    }
  });

  test('every public route exports a non-empty unique description', async ({ request }) => {
    const seen = new Map<string, string>();
    for (const r of ROUTES) {
      const m = await fetchMetadata(request, r.path);
      expect(m.description, `${r.path} missing description`).not.toBeNull();
      expect(m.description!.length, `${r.path} empty description`).toBeGreaterThan(0);
      const prior = seen.get(m.description!);
      if (prior && prior !== r.path) {
        throw new Error(
          `description collision: "${m.description}" used by both ${prior} and ${r.path}`,
        );
      }
      seen.set(m.description!, r.path);
    }
  });

  test('every public route emits an og:image pointing at /og', async ({ request }) => {
    for (const r of ROUTES) {
      const m = await fetchMetadata(request, r.path);
      expect(m.ogImage, `${r.path} missing og:image`).not.toBeNull();
      expect(m.ogImage, `${r.path} og:image not using /og generator`).toMatch(
        /\/og(\?|$)/,
      );
    }
  });

  test('internal routes declare noindex', async ({ request }) => {
    for (const path of ['/status', '/tokens']) {
      const m = await fetchMetadata(request, path);
      expect(m.status, `${path} not 200`).toBe(200);
      expect(m.robots, `${path} missing robots noindex`).toMatch(/noindex/);
    }
  });
});
