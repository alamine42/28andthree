// E8-03: DAL stubs for lib/data/team.ts.
// Each function mirrors the prod signature and returns the matching
// fixture slice. Stubs are async to match the prod contract — callers
// don't have to know they're sandboxed.

import { recentGames2025, teamOverview2025 } from '../fixtures/team';
import type { GameResult, TeamSeasonOverview } from '@/lib/data/team';

export async function getTeamSeasonOverview(
  _team: string,
  _season: number,
): Promise<TeamSeasonOverview> {
  return teamOverview2025;
}

export async function getRecentGames(
  _team: string,
  _season: number,
  count = 6,
): Promise<GameResult[]> {
  return recentGames2025.slice(0, count);
}
