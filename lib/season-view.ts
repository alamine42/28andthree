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
