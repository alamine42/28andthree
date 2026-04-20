import { and, asc, eq, sql } from 'drizzle-orm';
import { PHASES, type Phase } from '@/lib/constants/phases';
import { teamPhaseSeason, teamPhaseWeekly } from '@/db/schema';
import { getDb } from '@/lib/db';

// ---- Snapshot: 12 rows for the home-page rank grid --------------------------

export type PhaseSnapshot = {
  phase: Phase;
  plays: number;
  epaPerPlay: number | null;
  rank: number | null;
  deltaRank: number | null; // vs. prior week (null for week 1 or insufficient)
};

/** One row per phase for the given team-season. Delta is computed via SQL
 * LAG over per-week ranks: last-week's rank minus the week-before-last. */
export async function getPhaseRankSnapshot(
  team: string,
  season: number,
): Promise<PhaseSnapshot[]> {
  const db = getDb();
  if (!db) return [];

  // Season-level rank for the headline number; delta needs the weekly table.
  const seasonRows = await db
    .select({
      phase: teamPhaseSeason.phase,
      plays: teamPhaseSeason.plays,
      epaPerPlay: teamPhaseSeason.epaPerPlay,
      rank: teamPhaseSeason.rank,
    })
    .from(teamPhaseSeason)
    .where(and(eq(teamPhaseSeason.team, team), eq(teamPhaseSeason.season, season)));

  // Per-phase delta: last recorded rank minus the one before it (weekly grain).
  const deltaRows = await db.execute<{ phase: Phase; delta: number | null }>(sql`
    SELECT phase,
           (last_rank - prev_rank)::int AS delta
    FROM (
      SELECT phase,
             rank AS last_rank,
             LAG(rank) OVER (PARTITION BY phase ORDER BY week) AS prev_rank,
             ROW_NUMBER() OVER (PARTITION BY phase ORDER BY week DESC) AS rn
      FROM team_phase_weekly
      WHERE team = ${team} AND season = ${season} AND rank IS NOT NULL
    ) x
    WHERE rn = 1
  `);

  const deltaByPhase = new Map<Phase, number | null>();
  for (const r of deltaRows.rows ?? deltaRows) {
    deltaByPhase.set(r.phase, r.delta ?? null);
  }

  // Return rows in canonical PHASE order (stable for the UI grid).
  const snapshotByPhase = new Map<Phase, PhaseSnapshot>();
  for (const r of seasonRows) {
    snapshotByPhase.set(r.phase, {
      phase: r.phase,
      plays: r.plays,
      epaPerPlay: r.epaPerPlay,
      rank: r.rank,
      deltaRank: deltaByPhase.get(r.phase) ?? null,
    });
  }

  return PHASES.map(
    (p): PhaseSnapshot =>
      snapshotByPhase.get(p) ?? {
        phase: p,
        plays: 0,
        epaPerPlay: null,
        rank: null,
        deltaRank: null,
      },
  );
}

// ---- Sparkline series: Pats-only, last 8 weeks per phase --------------------

export type SparklinePoint = { week: number; value: number | null };
export type PatsSparklines = Map<Phase, SparklinePoint[]>;

/** One query, 12 phases × last 8 weeks of Pats-only EPA values. Review #4
 * split this out from the trend query. */
export async function getPatsPhaseSparklines(
  team: string,
  season: number,
  weeksBack = 8,
): Promise<PatsSparklines> {
  const db = getDb();
  const result = new Map<Phase, SparklinePoint[]>();
  for (const p of PHASES) result.set(p, []);
  if (!db) return result;

  // Rank N rows per phase by week, take the most recent weeksBack.
  const rows = await db.execute<{
    phase: Phase;
    week: number;
    value: number | null;
  }>(sql`
    SELECT phase, week, epa_per_play AS value
    FROM (
      SELECT phase, week, epa_per_play,
             ROW_NUMBER() OVER (PARTITION BY phase ORDER BY week DESC) AS rn
      FROM team_phase_weekly
      WHERE team = ${team} AND season = ${season}
    ) x
    WHERE rn <= ${weeksBack}
    ORDER BY phase, week
  `);

  for (const r of rows.rows ?? rows) {
    const arr = result.get(r.phase);
    if (arr) arr.push({ week: r.week, value: r.value });
  }
  return result;
}

// ---- Phase detail: season-aggregate + weekly trend + distribution ----------

export type PhaseDetail = {
  phase: Phase;
  plays: number;
  epaPerPlay: number | null;
  successRate: number | null;
  rank: number | null;
  percentile: number | null;
  insufficientSample: boolean;
  totalQualified: number; // K — the denominator when K<32 (review #2)
};

/** Season-level detail for one phase. `totalQualified` lets the UI show
 * "of N qualified teams" when K<32. */
export async function getPhaseDetail(
  phase: Phase,
  team: string,
  season: number,
): Promise<PhaseDetail | null> {
  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select()
    .from(teamPhaseSeason)
    .where(
      and(
        eq(teamPhaseSeason.team, team),
        eq(teamPhaseSeason.season, season),
        eq(teamPhaseSeason.phase, phase),
      ),
    )
    .limit(1);

  if (!row) return null;

  const qualified = await db
    .select({
      k: sql<number>`COUNT(*) FILTER (WHERE ${teamPhaseSeason.insufficientSample} = false)::int`,
    })
    .from(teamPhaseSeason)
    .where(and(eq(teamPhaseSeason.season, season), eq(teamPhaseSeason.phase, phase)));

  return {
    phase,
    plays: row.plays,
    epaPerPlay: row.epaPerPlay,
    successRate: row.successRate,
    rank: row.rank,
    percentile: row.percentile,
    insufficientSample: row.insufficientSample,
    totalQualified: qualified[0]?.k ?? 32,
  };
}

// ---- Weekly trend: Pats + league median + rolling4 (all precomputed in SQL)

export type TrendPoint = {
  week: number;
  raw: number | null;
  rolling4: number | null;
  leagueMedian: number | null;
};

/** Two+median series for a phase, per review #8. Rolling4 computed in SQL
 * with insufficient-sample weeks excluded from the window. */
export async function getPhaseWeeklyTrend(
  phase: Phase,
  team: string,
  season: number,
): Promise<TrendPoint[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db.execute<TrendPoint>(sql`
    WITH team_raw AS (
      SELECT week,
             CASE WHEN insufficient_sample THEN NULL ELSE epa_per_play END AS raw,
             CASE WHEN insufficient_sample THEN NULL
                  ELSE AVG(epa_per_play) FILTER (WHERE insufficient_sample = false) OVER (
                    ORDER BY week ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
                  ) END AS rolling4
      FROM team_phase_weekly
      WHERE team = ${team} AND season = ${season} AND phase = ${phase}
    ),
    league_median AS (
      SELECT week,
             (PERCENTILE_CONT(0.5) WITHIN GROUP (
                ORDER BY epa_per_play) FILTER (WHERE insufficient_sample = false))::double precision
             AS league_median
      FROM team_phase_weekly
      WHERE season = ${season} AND phase = ${phase}
      GROUP BY week
    )
    SELECT COALESCE(t.week, l.week) AS week,
           t.raw AS raw,
           t.rolling4 AS rolling4,
           l.league_median AS "leagueMedian"
    FROM team_raw t
    FULL OUTER JOIN league_median l USING (week)
    ORDER BY week
  `);

  return rows.rows ?? rows;
}

// ---- League distribution: 32 teams at one snapshot -------------------------

export type DistributionRow = {
  team: string;
  plays: number;
  epaPerPlay: number | null;
  rank: number | null;
  insufficientSample: boolean;
};

/** All qualifying teams for a phase at season or week granularity. Used by
 * the distribution plot + /status/data endpoint. */
export async function getLeagueDistribution(
  phase: Phase,
  season: number,
  week?: number,
): Promise<DistributionRow[]> {
  const db = getDb();
  if (!db) return [];

  if (week !== undefined) {
    const rows = await db
      .select({
        team: teamPhaseWeekly.team,
        plays: teamPhaseWeekly.plays,
        epaPerPlay: teamPhaseWeekly.epaPerPlay,
        rank: teamPhaseWeekly.rank,
        insufficientSample: teamPhaseWeekly.insufficientSample,
      })
      .from(teamPhaseWeekly)
      .where(
        and(
          eq(teamPhaseWeekly.phase, phase),
          eq(teamPhaseWeekly.season, season),
          eq(teamPhaseWeekly.week, week),
        ),
      )
      .orderBy(asc(teamPhaseWeekly.team));
    return rows;
  }

  const rows = await db
    .select({
      team: teamPhaseSeason.team,
      plays: teamPhaseSeason.plays,
      epaPerPlay: teamPhaseSeason.epaPerPlay,
      rank: teamPhaseSeason.rank,
      insufficientSample: teamPhaseSeason.insufficientSample,
    })
    .from(teamPhaseSeason)
    .where(and(eq(teamPhaseSeason.phase, phase), eq(teamPhaseSeason.season, season)))
    .orderBy(asc(teamPhaseSeason.team));
  return rows;
}
