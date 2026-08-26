// E12: sandbox fixture for lib/data/trends.ts.
//
// Deterministic seven-season arcs, one per phase. Shaped to exercise the
// states the real page must handle rather than to look pretty:
//   - `special_teams` carries a sub-floor season (2022) → a gap that splits
//     the stroke in two. Position matters: a gap at index 1 would strand the
//     opening season as a lone point, which cannot stroke at all, so the
//     line would read as unbroken. Two published seasons sit on each side.
//   - the newest season in range is sub-floor for every phase → the
//     barely-started current season never plots a point (SPEC §3.5a). Keyed
//     to `throughSeason`, not to a fixed index, so the fixture behaves the
//     same whether the caller asks for 2025 or 2030.
//   - `overall` swings across all three rank tiers.

import { PHASES, type Phase } from '@/lib/constants/phases';
import type { TeamPhaseSeasonRow } from '@/lib/data/trends';

/** Rank per phase per season index (0 = 2020). Hand-set so tiers vary. */
const RANK_ARCS: Record<Phase, number[]> = {
  overall: [7, 14, 26, 21, 9, 4, 12],
  pass_offense: [9, 18, 29, 24, 13, 6, 15],
  rush_offense: [4, 8, 11, 16, 19, 11, 9],
  pass_defense: [12, 6, 3, 8, 17, 14, 10],
  run_defense: [8, 11, 9, 13, 22, 18, 16],
  redzone_offense: [16, 23, 31, 27, 15, 8, 19],
  redzone_defense: [5, 9, 7, 12, 20, 13, 11],
  third_down_offense: [14, 21, 28, 25, 12, 7, 17],
  third_down_defense: [6, 4, 8, 11, 18, 15, 9],
  explosive_offense: [19, 26, 30, 22, 14, 10, 21],
  explosive_defense: [10, 7, 5, 14, 21, 16, 12],
  special_teams: [3, 2, 6, 9, 11, 5, 8],
};

/** EPA/play derived from rank so the chart and the badge always agree:
 * rank 1 → +0.18, rank 32 → −0.16, linear between. */
function epaForRank(rank: number): number {
  const t = (rank - 1) / 31;
  return Number((0.18 - t * 0.34).toFixed(3));
}

const PLAYS_BY_INDEX = [1042, 1008, 1071, 1035, 1019, 998, 1024];

/** The one phase-season that is thin on purpose, to exercise gap-render. */
const GAP_SEASON = 2022;
const GAP_PHASE: Phase = 'special_teams';

export function trendRows(throughSeason: number, earliest = 2020): TeamPhaseSeasonRow[] {
  const rows: TeamPhaseSeasonRow[] = [];
  for (const phase of PHASES) {
    const arc = RANK_ARCS[phase];
    for (let i = 0; i + earliest <= throughSeason && i < arc.length; i++) {
      const season = earliest + i;
      const rank = arc[i]!;
      const isGap = phase === GAP_PHASE && season === GAP_SEASON;
      // The newest season in range is always barely under way.
      const isNewest = season === throughSeason;
      const plays = isGap ? 18 : isNewest ? 12 : PLAYS_BY_INDEX[i]!;
      rows.push({
        phase,
        season,
        plays,
        epaPerPlay: epaForRank(rank),
        successRate: Number((0.52 - ((rank - 1) / 31) * 0.14).toFixed(3)),
        rank,
        insufficientSample: false,
      });
    }
  }
  return rows;
}
