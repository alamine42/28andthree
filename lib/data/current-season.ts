import { cache } from 'react';
import { desc } from 'drizzle-orm';
import { teamPhaseWeekly } from '@/db/schema';
import { getDb } from '@/lib/db';

// Keyed on team_phase_weekly (not team_phase_season) so the home page flips
// to the new season as soon as any team has enough plays in any phase —
// not after the season rollup accumulates 30-plays/phase. Review finding #6.

const FALLBACK_SEASON = 2025;

/** Latest season with at least one row in team_phase_weekly. Cached per
 * server render so multiple consumers in the same request hit the DB once. */
export const getCurrentSeason = cache(async (): Promise<number> => {
  const db = getDb();
  if (!db) return FALLBACK_SEASON;
  const rows = await db
    .select({ season: teamPhaseWeekly.season })
    .from(teamPhaseWeekly)
    .orderBy(desc(teamPhaseWeekly.season))
    .limit(1);
  return rows[0]?.season ?? FALLBACK_SEASON;
});

/** Status of a given season: "final" when the season rollup exists OR
 * week 22 (SB) has a completed game; "in_progress" otherwise. */
export type SeasonStatus = 'final' | 'in_progress';
