// E12: DAL stub for lib/data/trends.ts.

import { buildHistory, type PhaseSeasonSeries } from '@/lib/data/trends';
import { trendRows } from '../fixtures/trends';

export async function getPhaseSeasonHistory(
  _team: string,
  throughSeason: number,
): Promise<PhaseSeasonSeries[]> {
  // Runs the real shaping core over fixture rows, so the sandbox exercises
  // the sample-floor rule instead of hard-coding its output.
  return buildHistory(trendRows(throughSeason), throughSeason);
}
