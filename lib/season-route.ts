import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { getSeasonContext } from '@/lib/data/current-season';
import { parseSeasonParam } from '@/lib/season-view';

/** Authoritative season check for /s/[season] wrappers (plan §3.1). The
 * middleware validates format + floor only (it is DB-free); this enforces
 * the upper bound: the current or a future season redirects to the clean
 * public path. The redirect response is ISR-cached with the page's
 * revalidate (86400) — at season rollover the ETL revalidation flush
 * clears it (plan §3.3), so a newly-historical season starts serving
 * within minutes, a day worst-case. */
export async function requireHistoricalSeason(
  seasonSegment: string,
  cleanPath: string,
): Promise<number> {
  const season = parseSeasonParam(seasonSegment);
  const ctx = await getSeasonContext();
  if (season == null || season >= ctx.season) redirect(cleanPath as Route);
  return season;
}
