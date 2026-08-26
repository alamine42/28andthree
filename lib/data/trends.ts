import { cache } from 'react';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { PHASES, type Phase } from '@/lib/constants/phases';
import { teamPhaseSeason } from '@/db/schema';
import { getDb } from '@/lib/db';
import { isSandbox } from '@/lib/sandbox';
import { EARLIEST_SEASON } from '@/lib/season-view';

// E12: season-by-season history for the 12 team phases. The inverse of E11
// — E11 shows one season across the whole site, this shows the whole site's
// headline metric across every season. Deliberately NOT season-scoped: it
// lives outside app/s and takes no ?season= (plan: bd patsbythenumbers-pt2).

/** SPEC §3.5a: "Season-to-date views always render once cumulative
 * plays-in-phase >= 30." Below the floor the season has no publishable
 * number, so epa/rank are nulled at the DAL rather than at render time —
 * a gap in the line, never a fake zero. */
export const SEASON_SAMPLE_FLOOR = 30;

export type SeasonPoint = {
  season: number;
  /** Null when the season is below the sample floor or has no row. */
  epaPerPlay: number | null;
  /** Null on the same terms. League context per SPEC §3.5a — never render
   * the EPA value without this beside it. */
  rank: number | null;
  successRate: number | null;
  plays: number;
  /** True when a row exists but sits under the floor. Distinct from "no
   * row at all" (plays === 0), which is a season we simply never loaded. */
  insufficientSample: boolean;
};

export type PhaseSeasonSeries = {
  phase: Phase;
  points: SeasonPoint[];
  /** Seasons with a publishable value, for empty-state decisions. */
  publishedCount: number;
};

/** Every phase's per-season series, EARLIEST_SEASON..throughSeason.
 *
 * Scalar args only — React `cache()` keys by `Object.is`, so an options
 * object would miss on every call (E11 code review pass 2, see
 * docs/solutions/gotchas). Series are dense: every season in range gets a
 * point, so all 12 charts share one x-axis and gaps stay visible. */
export const getPhaseSeasonHistory = cache(
  async (team: string, throughSeason: number): Promise<PhaseSeasonSeries[]> => {
    if (isSandbox()) {
      const stub = await import('@/lib/sandbox/stubs/trends');
      return stub.getPhaseSeasonHistory(team, throughSeason);
    }
    const db = getDb();
    if (!db) return emptyHistory(throughSeason);

    const rows = await db
      .select({
        phase: teamPhaseSeason.phase,
        season: teamPhaseSeason.season,
        plays: teamPhaseSeason.plays,
        epaPerPlay: teamPhaseSeason.epaPerPlay,
        successRate: teamPhaseSeason.successRate,
        rank: teamPhaseSeason.rank,
        insufficientSample: teamPhaseSeason.insufficientSample,
      })
      .from(teamPhaseSeason)
      .where(
        and(
          eq(teamPhaseSeason.team, team),
          gte(teamPhaseSeason.season, EARLIEST_SEASON),
          lte(teamPhaseSeason.season, throughSeason),
        ),
      )
      .orderBy(asc(teamPhaseSeason.season));

    return buildHistory(rows, throughSeason);
  },
);

/** Row shape the DAL query returns — exported so the unit test can drive
 * `buildHistory` directly without a database. */
export type TeamPhaseSeasonRow = {
  phase: Phase;
  season: number;
  plays: number;
  epaPerPlay: number | null;
  successRate: number | null;
  rank: number | null;
  insufficientSample: boolean;
};

/** Pure shaping core: dense per-phase series + the sample-floor rule.
 * Split out from the query so SPEC §3.5a is unit-testable (the codebase
 * does its math in the DAL so the client does none — E3 review #8). */
export function buildHistory(
  rows: ReadonlyArray<TeamPhaseSeasonRow>,
  throughSeason: number,
): PhaseSeasonSeries[] {
  const seasons = seasonRange(throughSeason);
  const byKey = new Map<string, TeamPhaseSeasonRow>();
  for (const r of rows) byKey.set(`${r.phase}:${r.season}`, r);

  return PHASES.map((phase) => {
    let publishedCount = 0;
    const points = seasons.map((season): SeasonPoint => {
      const row = byKey.get(`${phase}:${season}`);
      if (!row) {
        return {
          season,
          epaPerPlay: null,
          rank: null,
          successRate: null,
          plays: 0,
          insufficientSample: false,
        };
      }
      // Trust the ETL flag, but re-apply the floor here too: the flag is
      // written per-phase by the aggregation and a season row can predate
      // the rule. Whichever says "too thin" wins.
      const thin = row.insufficientSample || row.plays < SEASON_SAMPLE_FLOOR;
      if (!thin) publishedCount += 1;
      return {
        season,
        epaPerPlay: thin ? null : row.epaPerPlay,
        rank: thin ? null : row.rank,
        successRate: thin ? null : row.successRate,
        plays: row.plays,
        insufficientSample: thin,
      };
    });
    return { phase, points, publishedCount };
  });
}

export function seasonRange(throughSeason: number): number[] {
  const out: number[] = [];
  for (let s = EARLIEST_SEASON; s <= throughSeason; s++) out.push(s);
  return out;
}

function emptyHistory(throughSeason: number): PhaseSeasonSeries[] {
  return buildHistory([], throughSeason);
}
