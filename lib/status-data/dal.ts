import { and, eq } from 'drizzle-orm';
import type { QueryParams } from './schema';
import { teamPhaseSeason, teamPhaseWeekly } from '@/db/schema';
import { getDb } from '@/lib/db';

export type PhaseRow = {
  team: string;
  plays: number;
  epa_per_play: number | null;
  success_rate: number | null;
  rank: number | null;
  percentile: number | null;
  insufficient_sample: boolean;
};

/** Return the 32-team distribution for a given phase/season/[week]. */
export async function getPhaseDistribution(params: QueryParams): Promise<PhaseRow[]> {
  const db = getDb();
  if (!db) {
    throw new Error('DATABASE_URL not configured');
  }

  if (params.week !== undefined) {
    const rows = await db
      .select({
        team: teamPhaseWeekly.team,
        plays: teamPhaseWeekly.plays,
        epa_per_play: teamPhaseWeekly.epaPerPlay,
        success_rate: teamPhaseWeekly.successRate,
        rank: teamPhaseWeekly.rank,
        percentile: teamPhaseWeekly.percentile,
        insufficient_sample: teamPhaseWeekly.insufficientSample,
      })
      .from(teamPhaseWeekly)
      .where(
        and(
          eq(teamPhaseWeekly.phase, params.phase),
          eq(teamPhaseWeekly.season, params.season),
          eq(teamPhaseWeekly.week, params.week),
        ),
      );
    return rows;
  }

  const rows = await db
    .select({
      team: teamPhaseSeason.team,
      plays: teamPhaseSeason.plays,
      epa_per_play: teamPhaseSeason.epaPerPlay,
      success_rate: teamPhaseSeason.successRate,
      rank: teamPhaseSeason.rank,
      percentile: teamPhaseSeason.percentile,
      insufficient_sample: teamPhaseSeason.insufficientSample,
    })
    .from(teamPhaseSeason)
    .where(
      and(
        eq(teamPhaseSeason.phase, params.phase),
        eq(teamPhaseSeason.season, params.season),
      ),
    );
  return rows;
}
