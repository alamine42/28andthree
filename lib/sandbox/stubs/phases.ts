// E8-03: DAL stubs for lib/data/phases.ts.

import {
  PHASES,
  phaseDetails2025,
  phaseDistribution2025,
  phaseSnapshot2025,
  phaseTrend2025,
  sparklines2025,
} from '../fixtures/phases';
import type {
  DistributionRow,
  PatsSparklines,
  PhaseDetail,
  PhaseSnapshot,
  TrendPoint,
} from '@/lib/data/phases';
import type { Phase } from '@/lib/constants/phases';

export async function getPhaseRankSnapshot(
  _team: string,
  _season: number,
): Promise<PhaseSnapshot[]> {
  return phaseSnapshot2025;
}

export async function getPatsPhaseSparklines(
  _team: string,
  _season: number,
): Promise<PatsSparklines> {
  return sparklines2025;
}

export async function getPhaseDetail(
  phase: Phase,
  _team: string,
  _season: number,
): Promise<PhaseDetail | null> {
  return phaseDetails2025[phase] ?? null;
}

export async function getPhaseWeeklyTrend(
  phase: Phase,
  _team: string,
  _season: number,
): Promise<TrendPoint[]> {
  return phaseTrend2025(phase);
}

export async function getLeagueDistribution(
  phase: Phase,
  _season: number,
): Promise<DistributionRow[]> {
  return phaseDistribution2025(phase);
}

export { PHASES };
