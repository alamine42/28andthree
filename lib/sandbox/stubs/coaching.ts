// E8-03: DAL stubs for lib/data/coaching.ts.

import { coachSegments2025, fourthDownDecisions2025 } from '../fixtures/coaching';
import type { CoachSegmentWithRollup, FourthDownDecision } from '@/lib/data/coaching';

export async function getCoachSegments(
  _team: string,
  _season: number,
): Promise<CoachSegmentWithRollup[]> {
  return coachSegments2025;
}

export async function getFourthDownDecisions(
  _team: string,
  _season: number,
): Promise<FourthDownDecision[]> {
  return fourthDownDecisions2025;
}
