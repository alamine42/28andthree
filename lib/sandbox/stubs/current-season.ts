// E8-03: DAL stub for lib/data/current-season.ts.

import type { SeasonContext } from '@/lib/data/current-season';
import { AWAITING_KICKOFF_IN_DAYS, AWAITING_SEASON, isAwaiting } from '../season-state';

export async function getCurrentSeason(): Promise<number> {
  return (await getSeasonContext()).season;
}

export async function getSeasonContext(): Promise<SeasonContext> {
  if (await isAwaiting()) {
    return {
      season: AWAITING_SEASON,
      awaitingFirstGame: true,
      kickoffInDays: AWAITING_KICKOFF_IN_DAYS,
    };
  }
  return { season: 2025, awaitingFirstGame: false, kickoffInDays: null };
}
