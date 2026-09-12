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
import { isAwaiting } from '../season-state';

export async function getPhaseRankSnapshot(
  _team: string,
  _season: number,
): Promise<PhaseSnapshot[]> {
  if (await isAwaiting()) return [];
  return phaseSnapshot2025;
}

export async function getPatsPhaseSparklines(
  _team: string,
  _season: number,
): Promise<PatsSparklines> {
  if (await isAwaiting()) return new Map();
  return sparklines2025;
}

export async function getPhaseDetail(
  phase: Phase,
  _team: string,
  _season: number,
): Promise<PhaseDetail | null> {
  if (await isAwaiting()) return null;
  return phaseDetails2025[phase] ?? null;
}

export async function getPhaseWeeklyTrend(
  phase: Phase,
  _team: string,
  _season: number,
): Promise<TrendPoint[]> {
  if (await isAwaiting()) return [];
  return phaseTrend2025(phase);
}

export async function getLeagueDistribution(
  phase: Phase,
  _season: number,
): Promise<DistributionRow[]> {
  if (await isAwaiting()) return [];
  return phaseDistribution2025(phase);
}

export { PHASES };
