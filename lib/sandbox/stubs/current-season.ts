// E8-03: DAL stub for lib/data/current-season.ts.

import type { SeasonContext } from '@/lib/data/current-season';

export async function getCurrentSeason(): Promise<number> {
  return 2025;
}

export async function getSeasonContext(): Promise<SeasonContext> {
  return { season: 2025, awaitingFirstGame: false, kickoffInDays: null };
}
