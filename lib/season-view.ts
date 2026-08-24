// E11: historical season browsing — single source of truth for what a
// season param is and which routes are season-scoped. Pure module: usable
// from middleware (edge), server pages, and client components. Plan:
// docs/plans/e11-historical-seasons-plan.md §3.2.

export const EARLIEST_SEASON = 2020;

const SEASON_PARAM_RE = /^\d{4}$/;

/** Strict season-param validator. Anchored 4-digit parse + data floor.
 * Everything that reads ?season= goes through this — middleware, server
 * pages, and client chrome must agree, or the pill can label current data
 * as historical (review CRITICAL: parseInt('2023x') === 2023). Returns
 * null for anything invalid; callers treat null as "param absent". */
export function parseSeasonParam(raw: string | null | undefined): number | null {
  if (raw == null || !SEASON_PARAM_RE.test(raw)) return null;
  const season = Number(raw);
  if (season < EARLIEST_SEASON) return null;
  return season;
}

/** Season-scoped route matchers — the ONLY list. Consumed by the
 * middleware rewrite branch and by client nav decoration. Order matters
 * for the more specific player paths. */
const SEASON_SCOPED_PATTERNS: ReadonlyArray<RegExp> = [
  /^\/$/,
  /^\/phases\/[^/]+$/,
  /^\/team\/units\/[^/]+$/,
  /^\/coaching$/,
  /^\/players$/,
  /^\/players\/qb\/[^/]+$/,
  /^\/players\/skill\/[^/]+$/,
];

export function isSeasonScopedPath(pathname: string): boolean {
  return SEASON_SCOPED_PATTERNS.some((re) => re.test(pathname));
}

export type SeasonRouting =
  | { kind: 'rewrite'; pathname: string }
  | { kind: 'redirect'; pathname: string; search: string };

/** Pure decision core for the middleware branch (plan §3.1, §3.3).
 *
 * - Season-scoped public path + valid ?season= → rewrite into the internal
 *   static tree /s/{season}{path}. The address bar keeps the public URL.
 * - External hit on the internal /s tree → 308 to the public ?season=
 *   form (valid season) or the clean path (malformed segment). Kills the
 *   duplicate URL surface; not a loop — the redirect target is rewritten
 *   internally on the next request.
 * - Everything else → null (pass through).
 *
 * Deliberately DB-free: the current-season upper bound is enforced by the
 * /s/[season] wrappers, which redirect season >= current to the clean
 * path. */
export function resolveSeasonRouting(
  pathname: string,
  seasonParam: string | null,
): SeasonRouting | null {
  if (pathname === '/s' || pathname.startsWith('/s/')) {
    const rest = pathname === '/s' ? '' : pathname.slice(2);
    const [, segment = '', ...restParts] = rest.split('/');
    const cleanPath = restParts.length > 0 ? `/${restParts.join('/')}` : '/';
    const season = parseSeasonParam(segment);
    return {
      kind: 'redirect',
      pathname: cleanPath,
      search: season != null ? `?season=${season}` : '',
    };
  }

  const season = parseSeasonParam(seasonParam);
  if (season == null || !isSeasonScopedPath(pathname)) return null;
  return {
    kind: 'rewrite',
    pathname: `/s/${season}${pathname === '/' ? '' : pathname}`,
  };
}

export type SeasonView = {
  /** Season the page renders. */
  season: number;
  /** True when the visitor navigated to a valid past season. */
  historical: boolean;
  /** Every browsable season, newest first. */
  seasons: number[];
};

/** Resolve the season a page should render from the ?season= param,
 * against the current season (from getSeasonContext — one authority for
 * "current"). Invalid or out-of-range values fall back to current — never
 * a 404. */
export function resolveSeasonView(
  param: string | string[] | undefined,
  currentSeason: number,
): SeasonView {
  const seasons: number[] = [];
  for (let s = currentSeason; s >= EARLIEST_SEASON; s--) seasons.push(s);

  const raw = Array.isArray(param) ? param[0] : param;
  const parsed = parseSeasonParam(raw);
  const season = parsed != null && parsed < currentSeason ? parsed : currentSeason;

  return { season, historical: season !== currentSeason, seasons };
}
