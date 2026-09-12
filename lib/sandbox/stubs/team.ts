// E8-03: DAL stubs for lib/data/team.ts.
// Each function mirrors the prod signature and returns the matching
// fixture slice. Stubs are async to match the prod contract — callers
// don't have to know they're sandboxed.

import { recentGames2025, teamOverview2025 } from '../fixtures/team';
import type { GameResult, TeamSeasonOverview } from '@/lib/data/team';
import { AWAITING_SEASON, isAwaiting } from '../season-state';

export async function getTeamSeasonOverview(
  _team: string,
  _season: number,
): Promise<TeamSeasonOverview> {
  if (await isAwaiting()) {
    // What lib/data/team.ts emptyOverview() returns for a season with no rows.
    return {
      season: AWAITING_SEASON,
      record: { wins: 0, losses: 0, ties: 0 },
      pointDiff: null,
      currentSeasonRank: null,
      currentSeasonEpa: null,
      prevSeasonRank: null,
    };
  }
  return teamOverview2025;
}

export async function getRecentGames(
  _team: string,
  _season: number,
  count = 6,
): Promise<GameResult[]> {
  if (await isAwaiting()) return [];
  return recentGames2025.slice(0, count);
}
