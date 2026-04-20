// Grade thresholds for the Draft ROI tracker. See plan §1.5.
//
// HIT     actual / expected ≥ 1.25
// FAIR    0.75 ≤ ratio < 1.25
// MISS    ratio < 0.75
// PENDING pick too recent, ST bucket, trade-out (no gsisId), or missing data.

export type Grade = 'HIT' | 'FAIR' | 'MISS' | 'PENDING';

export type PositionBucket = 'QB' | 'OFF_SKILL' | 'OL' | 'DL' | 'LB' | 'DB' | 'ST';

type GradeInput = {
  gsisId: string | null;
  draftSeason: number;
  positionBucket: PositionBucket;
  actualValue: number | null;
  expectedValue: number | null;
  currentSeason: number;
};

const HIT_RATIO = 1.25;
const MISS_RATIO = 0.75;
const MATURATION_YEARS = 2;

export function gradePick(input: GradeInput): Grade {
  // PENDING when we can't (or shouldn't) grade:
  //  - Rookie / sophomore — career hasn't matured.
  //  - Special teams — no defined value metric in v1.
  //  - Trade-out slots — no player to grade.
  //  - Either side of the ratio is missing / unusable.
  if (input.currentSeason - input.draftSeason < MATURATION_YEARS) return 'PENDING';
  if (input.positionBucket === 'ST') return 'PENDING';
  if (input.gsisId === null) return 'PENDING';
  if (input.actualValue === null || input.expectedValue === null) return 'PENDING';
  if (input.expectedValue === 0) return 'PENDING';

  const ratio = input.actualValue / input.expectedValue;
  if (ratio >= HIT_RATIO) return 'HIT';
  if (ratio < MISS_RATIO) return 'MISS';
  return 'FAIR';
}
