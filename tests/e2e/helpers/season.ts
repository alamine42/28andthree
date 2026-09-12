// Which season the data-dependent smoke specs run against.
//
// The site shows the current season, and a season has no rows until the
// first Tuesday ETL of the year loads Week 1. Every spec that asserts on
// real numbers therefore failed for the whole preseason: ranks render as
// an em dash, contributor cards and the distribution plot render not at
// all. That is the site behaving correctly (see the awaiting-data notice)
// and the specs assuming something the calendar does not guarantee.
//
// Pinning to a completed season makes the assertions deterministic all
// year. E11 already proves the route works under test: e11.spec.ts drives
// `?season=2023` against the real DB and passes.
//
// Override with E2E_DATA_SEASON when pointing the suite at a database
// that does not hold this season.

export const DATA_SEASON = Number(process.env.E2E_DATA_SEASON ?? 2025);

/** Add the season param to a season-scoped path (lib/season-view.ts).
 * The middleware rewrites it into the internal /s/{season} tree. */
export function seasonPath(path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}season=${DATA_SEASON}`;
}
