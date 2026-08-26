import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

// E6-10: legal + disclaimer audit.
// (1) Footer disclaimer present on every public route.
// (2) No NFL / Patriots / Revolution logos, wordmarks, or uniform imagery
//     anywhere on the site — tested by scanning <img>/<source> URLs + every
//     file under public/ for restricted keywords.
// (3) nflverse attribution rendered on /methodology.

const QB_ID = process.env.E4_TEST_QB_ID ?? '00-0039851';

const ROUTES = [
  '/',
  '/players',
  '/draft-roi',
  '/coaching',
  '/trends',
  '/methodology',
  '/phases/pass_offense',
  '/phases/run_defense',
  `/players/qb/${QB_ID}`,
  '/team/units/defense',
] as const;

// Keywords that indicate a restricted asset. Case-insensitive match. These
// are substrings, not whole words, so "patriots" catches "new-england-
// patriots.svg" and so on. Common-English words (e.g., "nfl", "new-england")
// that could false-positive in prose are intentionally scoped to URLs/filenames.
const RESTRICTED_KEYWORDS = [
  'patriots',
  'flying-elvis',
  'pat-patriot',
  'nfl-logo',
  'nfl-shield',
];

const DISCLAIMER =
  '28 and Three — Independent fan project. Not affiliated with, endorsed by, or sponsored by the New England Patriots, the NFL, or any of its teams.';

test.describe('E6-10 disclaimer + legal audit', () => {
  for (const route of ROUTES) {
    test(`footer disclaimer present on ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByText(DISCLAIMER)).toBeVisible();
    });
  }

  test('nflverse attribution renders on /methodology', async ({ page }) => {
    await page.goto('/methodology');
    const attributions = page.getByTestId('methodology-section-attributions');
    await expect(attributions).toBeAttached();
    await expect(
      attributions.getByRole('link', { name: /nflverse/i }).first(),
    ).toBeVisible();
  });

  test('no <img>/<source> URLs reference restricted keywords on any route', async ({
    page,
  }) => {
    for (const route of ROUTES) {
      await page.goto(route);
      const srcs = await page.evaluate(() => {
        const nodes = document.querySelectorAll<HTMLElement>('img, source');
        return Array.from(nodes)
          .map((n) => {
            const src = n.getAttribute('src') ?? '';
            const srcset = n.getAttribute('srcset') ?? '';
            return `${src} ${srcset}`.toLowerCase();
          })
          .filter(Boolean);
      });
      for (const src of srcs) {
        for (const kw of RESTRICTED_KEYWORDS) {
          expect(
            src.includes(kw),
            `${route}: image URL "${src}" contains restricted keyword "${kw}"`,
          ).toBe(false);
        }
      }
    }
  });

  test('public/ contains no files matching restricted keywords', async () => {
    const root = path.resolve(process.cwd(), 'public');
    const matches: string[] = [];

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          await walk(full);
          continue;
        }
        const lower = ent.name.toLowerCase();
        for (const kw of RESTRICTED_KEYWORDS) {
          if (lower.includes(kw)) {
            matches.push(path.relative(root, full));
          }
        }
      }
    }

    await walk(root);
    expect(
      matches,
      `public/ contains file(s) matching restricted keywords: ${matches.join(', ')}`,
    ).toEqual([]);
  });
});
