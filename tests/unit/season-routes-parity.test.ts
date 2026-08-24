import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isSeasonScopedPath, resolveSeasonRouting } from '../../lib/season-view';

// E11 (code review pass 2): the season-scoped route set lives in three
// places — the SEASON_SCOPED_PATTERNS allowlist, the app/s/[season]
// wrapper tree, and the sitemap's historical loop. This test ties the
// first two together: every wrapper page must be reachable through the
// middleware rewrite, and every allowlisted pattern must have a wrapper.
// Miss the pattern → ?season= silently serves CURRENT data under a
// historical URL (SPEC §3.5a violation). Miss the wrapper → 404.

const S_TREE_ROOT = join(__dirname, '../../app/s/[season]');

/** Collect route paths (relative to the [season] segment) that own a
 * page.tsx, with dynamic segments replaced by representative values. */
function wrapperRoutes(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      const segment = name === '[slug]'
        ? 'pass_offense'
        : name === '[unit]'
          ? 'defense'
          : name === '[gsisId]'
            ? '00-0039851'
            : name;
      out.push(...wrapperRoutes(full, `${prefix}/${segment}`));
    } else if (name === 'page.tsx') {
      out.push(prefix === '' ? '/' : prefix);
    }
  }
  return out;
}

describe('E11 route-inventory parity', () => {
  const routes = wrapperRoutes(S_TREE_ROOT);

  it('every_s_wrapper_page_is_reachable_via_the_rewrite_allowlist', () => {
    for (const route of routes) {
      assert.equal(
        isSeasonScopedPath(route),
        true,
        `app/s/[season]${route === '/' ? '' : route}/page.tsx exists but ` +
          `SEASON_SCOPED_PATTERNS does not match '${route}' — the rewrite ` +
          `never fires and ?season= silently serves current data`,
      );
      const routing = resolveSeasonRouting(route, '2023');
      assert.equal(routing?.kind, 'rewrite', route);
    }
  });

  it('every_allowlisted_pattern_has_a_wrapper_page', () => {
    // Representative concrete path per pattern; extend when adding a
    // season-scoped route (the failure message above tells you how).
    const representatives = [
      '/',
      '/phases/pass_offense',
      '/team/units/defense',
      '/coaching',
      '/players',
      '/players/qb/00-0039851',
      '/players/skill/00-0039851',
    ];
    for (const rep of representatives) {
      assert.equal(
        routes.includes(rep),
        true,
        `'${rep}' matches the allowlist but has no app/s/[season] wrapper — ` +
          `the rewrite would 404`,
      );
    }
    assert.equal(routes.length, representatives.length);
  });
});
