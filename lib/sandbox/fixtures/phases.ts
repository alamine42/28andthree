import type {
  PhaseSnapshot,
  PatsSparklines,
  PhaseDetail,
  TrendPoint,
  DistributionRow,
  SparklinePoint,
} from '@/lib/data/phases';
import { PHASES, type Phase } from '@/lib/constants/phases';

// Sandbox fixture: NE 2025 phase ranks. Hand-tuned to give a believable
// shape — strong on offense, mid on defense, weak on red zone D.
// Edge cases baked in (E8-04):
//   • rush_offense + special_teams tied at rank 14 (tiebreak display)
//   • explosive_defense insufficientSample=true, totalQualified=28
//   • sparklines2025['special_teams'] has one null point (week 13) to
//     exercise the gap-render path in Sparkline.

export const phaseSnapshot2025: PhaseSnapshot[] = [
  { phase: 'pass_offense', plays: 612, epaPerPlay: 0.32, rank: 1 },
  { phase: 'rush_offense', plays: 480, epaPerPlay: 0.02, rank: 14 },
  { phase: 'overall', plays: 1092, epaPerPlay: 0.20, rank: 2 },
  { phase: 'pass_defense', plays: 590, epaPerPlay: -0.05, rank: 9 },
  { phase: 'run_defense', plays: 410, epaPerPlay: 0.01, rank: 19 },
  { phase: 'redzone_offense', plays: 88, epaPerPlay: 0.45, rank: 6 },
  { phase: 'redzone_defense', plays: 75, epaPerPlay: 0.31, rank: 28 },
  { phase: 'third_down_offense', plays: 142, epaPerPlay: 0.18, rank: 11 },
  { phase: 'third_down_defense', plays: 138, epaPerPlay: -0.09, rank: 7 },
  { phase: 'explosive_offense', plays: 1092, epaPerPlay: 0.118, rank: 4 },
  { phase: 'explosive_defense', plays: 1000, epaPerPlay: 0.092, rank: 22 },
  { phase: 'special_teams', plays: 124, epaPerPlay: 0.02, rank: 14 },
];

// 8-week sparkline trend per phase. Mostly trending up (we're 14-3 by
// week 17 in this fixture). One null marks an insufficient-sample
// week — augmenter widens that to exercise the gap-render in Sparkline.
function sparkline(seed: number, dir: 'up' | 'down' | 'flat'): SparklinePoint[] {
  const slope = dir === 'up' ? 0.03 : dir === 'down' ? -0.02 : 0;
  return Array.from({ length: 8 }, (_, i) => {
    const week = 10 + i; // weeks 10-17
    const value = seed + slope * i + (Math.sin(i + seed * 10) * 0.02);
    return { week, value: Number(value.toFixed(3)) };
  });
}

// Special teams has a null at week 13 — insufficient-sample gap. All
// other phases have 8 consecutive points.
const specialTeamsWithGap: SparklinePoint[] = sparkline(0.02, 'flat').map((p) =>
  p.week === 13 ? { week: 13, value: null } : p,
);

export const sparklines2025: PatsSparklines = new Map<Phase, SparklinePoint[]>([
  ['pass_offense', sparkline(0.28, 'up')],
  ['rush_offense', sparkline(0.00, 'up')],
  ['overall', sparkline(0.16, 'up')],
  ['pass_defense', sparkline(-0.02, 'down')],
  ['run_defense', sparkline(0.03, 'flat')],
  ['redzone_offense', sparkline(0.40, 'up')],
  ['redzone_defense', sparkline(0.30, 'flat')],
  ['third_down_offense', sparkline(0.14, 'up')],
  ['third_down_defense', sparkline(-0.06, 'down')],
  ['explosive_offense', sparkline(0.10, 'up')],
  ['explosive_defense', sparkline(0.08, 'flat')],
  ['special_teams', specialTeamsWithGap],
]);

// Per-phase detail (used by /phases/[slug]). K=32 by default;
// explosive_defense is flagged insufficient with K=28 to exercise the
// "of N qualified teams" copy path.
export const phaseDetails2025: Record<Phase, PhaseDetail> = Object.fromEntries(
  phaseSnapshot2025.map((s): [Phase, PhaseDetail] => {
    const insufficient = s.phase === 'explosive_defense';
    return [
      s.phase,
      {
        phase: s.phase,
        plays: s.plays,
        epaPerPlay: s.epaPerPlay,
        successRate: s.epaPerPlay === null ? null : 0.46 + s.epaPerPlay,
        rank: insufficient ? null : s.rank,
        percentile: s.rank === null || insufficient ? null : 1 - (s.rank - 1) / 31,
        insufficientSample: insufficient,
        totalQualified: insufficient ? 28 : 32,
      },
    ];
  }),
) as Record<Phase, PhaseDetail>;

// Per-phase weekly trend (8 points). Produces a chart that visibly trends.
export function phaseTrend2025(phase: Phase): TrendPoint[] {
  const points = sparklines2025.get(phase) ?? [];
  return points.map((p, i) => ({
    week: p.week,
    raw: p.value,
    rolling4: p.value === null ? null : Number(((p.value ?? 0) * 0.9 + 0.01 * i).toFixed(3)),
    leagueMedian: 0,
  }));
}

// 32-team distribution per phase. Sandbox version uses a synthetic curve.
// NE always sits at the rank in phaseSnapshot2025; other 31 fill in below.
export function phaseDistribution2025(phase: Phase): DistributionRow[] {
  const ne = phaseSnapshot2025.find((s) => s.phase === phase);
  const teams = [
    'BUF', 'KC', 'PHI', 'BAL', 'CIN', 'DAL', 'SF', 'DET', 'MIA', 'GB',
    'JAX', 'LAC', 'SEA', 'PIT', 'MIN', 'ATL', 'HOU', 'NYG', 'NYJ', 'CLE',
    'IND', 'TEN', 'DEN', 'LV', 'WAS', 'CHI', 'TB', 'NO', 'LAR', 'CAR',
    'ARI',
  ];
  const rows: DistributionRow[] = teams.map((team, i) => ({
    team,
    plays: ne?.plays ?? 500,
    epaPerPlay: Number((0.30 - i * 0.018).toFixed(3)),
    rank: i + 1,
    insufficientSample: false,
  }));
  // Inject NE at its real rank, displacing the synthetic team there.
  if (ne?.rank != null && ne?.epaPerPlay != null) {
    rows.splice(ne.rank - 1, 0, {
      team: 'NE',
      plays: ne.plays,
      epaPerPlay: ne.epaPerPlay,
      rank: ne.rank,
      insufficientSample: false,
    });
    // Re-rank everything after the splice.
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row) row.rank = i + 1;
    }
  }
  // Trim to 32.
  return rows.slice(0, 32);
}

// Re-export PHASES so stubs that need to iterate phases stay in this module.
export { PHASES };
