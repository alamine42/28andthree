import { cache } from 'react';
import { desc } from 'drizzle-orm';
import { qbSeason } from '@/db/schema';
import { getDb } from '@/lib/db';

/** Latest season with player-stats rows (qb_season). NOT the display
 * season: during the preseason transition getCurrentSeason() returns the
 * upcoming season, which has zero player rows — keying sitemap/prerender
 * lists on it would empty them for ~6 weeks a year (review WARNING, plan
 * §3.7). Player and team rollups load together, so qb_season's max is
 * the right bound for both player route lists. */
export const getLatestStatsSeason = cache(async (): Promise<number | null> => {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select({ season: qbSeason.season })
    .from(qbSeason)
    .orderBy(desc(qbSeason.season))
    .limit(1);
  return rows[0]?.season ?? null;
});
