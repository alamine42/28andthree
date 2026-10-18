import { getSeasonContext } from '@/lib/data/current-season';
import { parseSeasonParam, withSeason } from '@/lib/season-view';

/** What a /s/[season] wrapper should render. `historical: false` means the
 * requested segment is the current season (or junk that got this far), so
 * the wrapper renders the clean current-season view. */
export type SeasonSegmentView = {
  season: number;
  historical: boolean;
};

/** Authoritative season check for /s/[season] wrappers (plan §3.1). The
 * middleware validates format + floor only (it is DB-free); this enforces
 * the upper bound.
 *
 * It used to `redirect()` the current season back to the clean path. That
 * cannot work: /s is reached through a middleware rewrite, and Next cannot
 * put a Location header on a rewritten response. It degrades to a 200
 * carrying `<meta http-equiv="refresh">`, so the reader stares at an empty
 * page for a second before the bounce, and any fetch sees an empty
 * document (issue #25).
 *
 * So the wrapper renders the current-season view in place instead. The
 * clean path stays canonical through `seasonCanonical`, and the header
 * chrome already treats `?season=<current>` as absent (SeasonSwitcher
 * compares the param against the current season). The rollover path still
 * self-corrects: during season Y, `/s/Y/...` caches the current view, and
 * the first ETL run after the Y+1 rollover flushes the whole /s subtree
 * (plan §3.3), after which Y serves as history. */
export async function resolveSeasonSegment(
  seasonSegment: string,
): Promise<SeasonSegmentView> {
  const requested = parseSeasonParam(seasonSegment);
  const { season: current } = await getSeasonContext();
  if (requested == null || requested >= current) {
    return { season: current, historical: false };
  }
  return { season: requested, historical: true };
}

/** Canonical URL for a page rendered through the /s tree. Historical views
 * are self-canonical in the public `?season=` form (plan §3.7); a
 * current-season view canonicalises to the clean path, which is the URL
 * the switcher links to and the one the sitemap carries. */
export function seasonCanonical(cleanPath: string, view: SeasonSegmentView): string {
  return view.historical ? withSeason(cleanPath, view.season) : cleanPath;
}
