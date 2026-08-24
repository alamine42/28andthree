import { cache } from 'react';
import { desc, sql } from 'drizzle-orm';
import { games, teamPhaseWeekly } from '@/db/schema';
import { getDb } from '@/lib/db';
import {
  PRESEASON_WINDOW_DAYS,
  resolveSeasonContext,
  type SeasonContext,
} from '@/lib/logic/season-context';
import { getSchedulePhase } from '@/lib/schedule/phase';
import { isSandbox } from '@/lib/sandbox';

export { PRESEASON_WINDOW_DAYS, resolveSeasonContext, type SeasonContext };

// Keyed on team_phase_weekly (not team_phase_season) so the home page flips
// to the new season as soon as any team has enough plays in any phase —
// not after the season rollup accumulates 30-plays/phase. Review finding #6.

const FALLBACK_SEASON = 2025;

/** Season context for the current render. Cached per server render so
 * multiple consumers in the same request hit the DB once. */
export const getSeasonContext = cache(async (): Promise<SeasonContext> => {
  if (isSandbox()) {
    const stub = await import('@/lib/sandbox/stubs/current-season');
    return stub.getSeasonContext();
  }
  const db = getDb();
  if (!db) {
    return { season: FALLBACK_SEASON, awaitingFirstGame: false, kickoffInDays: null };
  }
  const rows = await db
    .select({ season: teamPhaseWeekly.season })
    .from(teamPhaseWeekly)
    .orderBy(desc(teamPhaseWeekly.season))
    .limit(1);
  const statsSeason = rows[0]?.season ?? FALLBACK_SEASON;

  const snap = await getSchedulePhase();
  // The MAX(season) probe only matters when a newer season can be ahead of
  // the stats: the schedule phase already left statsSeason behind (Week 1
  // lag), or the offseason countdown is inside the preseason window.
  const probeNeeded =
    snap.season > statsSeason ||
    (snap.phase === 'offseason' &&
      snap.daysUntilNextGame != null &&
      snap.daysUntilNextGame <= PRESEASON_WINDOW_DAYS);
  let maxScheduledSeason: number | null = null;
  if (probeNeeded) {
    const scheduled = await db
      .select({ max: sql<number | null>`max(${games.season})` })
      .from(games);
    maxScheduledSeason = scheduled[0]?.max ?? null;
  }

  return resolveSeasonContext({
    statsSeason,
    maxScheduledSeason,
    phase: snap.phase,
    daysUntilNextGame: snap.daysUntilNextGame,
  });
});

/** Season every stats page should display. Delegates to getSeasonContext
 * so the whole site agrees on one season per render. */
export const getCurrentSeason = cache(async (): Promise<number> => {
  return (await getSeasonContext()).season;
});

/** Status of a given season: "final" when the season rollup exists OR
 * week 22 (SB) has a completed game; "in_progress" otherwise. */
export type SeasonStatus = 'final' | 'in_progress';
