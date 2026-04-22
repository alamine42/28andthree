import type {
  CoachSegmentWithRollup,
  TendencyRollup,
  FourthDownDecision,
} from '@/lib/data/coaching';

// Sandbox fixture: NE 2025 coaching staff with a §3.5a mid-season OC
// change baked in (E8-04 edge case). Vrabel HC throughout, McDaniels OC
// weeks 1-9 then "Patricia" OC weeks 10-18, Williams DC throughout.
// This exercises the segment-renderer's two-row code path that no real
// 2025 prod row currently triggers.

const baseRollup: TendencyRollup = {
  passRate1Short: 0.42,
  passRate1Mid: 0.55,
  passRate1Long: 0.68,
  passRate2Short: 0.50,
  passRate2Mid: 0.66,
  passRate2Long: 0.85,
  passRate3Short: 0.40,
  passRate3Mid: 0.78,
  passRate3Long: 0.91,
  shotgunRate: 0.72,
  playActionRate: 0.28,
  motionRate: 0.55,
  noHuddleRate: 0.06,
  scoreLeadingBigPassRate: 0.30,
  scoreLeadingSmallPassRate: 0.55,
  scoreTiedPassRate: 0.62,
  scoreTrailingSmallPassRate: 0.70,
  scoreTrailingBigPassRate: 0.85,
  secondsPerSnap: 28.4,
  personnelTopGroups: [
    { grouping: '11', share: 0.62 },
    { grouping: '12', share: 0.18 },
    { grouping: '21', share: 0.10 },
    { grouping: '13', share: 0.06 },
    { grouping: '22', share: 0.04 },
  ],
  blitzRate: null,
};

const dcRollup: TendencyRollup = {
  ...baseRollup,
  // Defense rollup: blitzRate is the only DC-specific field, the rest is
  // either inherited (personnel groups for opponent's offense seen) or
  // ignored. 30% blitz = "aggressive" classification on /coaching banner.
  blitzRate: 0.30,
  shotgunRate: null,
  playActionRate: null,
  motionRate: null,
  noHuddleRate: null,
  passRate1Short: null, passRate1Mid: null, passRate1Long: null,
  passRate2Short: null, passRate2Mid: null, passRate2Long: null,
  passRate3Short: null, passRate3Mid: null, passRate3Long: null,
  scoreLeadingBigPassRate: null, scoreLeadingSmallPassRate: null,
  scoreTiedPassRate: null, scoreTrailingSmallPassRate: null,
  scoreTrailingBigPassRate: null,
  secondsPerSnap: null,
};

export const coachSegments2025: CoachSegmentWithRollup[] = [
  {
    role: 'HC',
    coachId: null,
    coachName: 'Mike Vrabel',
    weekStart: 1,
    weekEnd: 18,
    rollup: baseRollup,
  },
  // §3.5a: McDaniels OC weeks 1-9
  {
    role: 'OC',
    coachId: null,
    coachName: 'Josh McDaniels',
    weekStart: 1,
    weekEnd: 9,
    rollup: { ...baseRollup, shotgunRate: 0.78, playActionRate: 0.32 },
  },
  // §3.5a: Patricia OC weeks 10-18 — visible split on /coaching
  {
    role: 'OC',
    coachId: null,
    coachName: 'Matt Patricia',
    weekStart: 10,
    weekEnd: 18,
    rollup: { ...baseRollup, shotgunRate: 0.65, playActionRate: 0.21 },
  },
  {
    role: 'DC',
    coachId: null,
    coachName: 'Terrell Williams',
    weekStart: 1,
    weekEnd: 18,
    rollup: dcRollup,
  },
];

// 4th-down decisions for 2025: 8 plays, mix of agreed + disagreed with
// model. Keeps the FourthDownLedger populated (vs. "Model pending"
// callout — that's the empty-state fallback when nfl4th is missing).
export const fourthDownDecisions2025: FourthDownDecision[] = [
  { week: 3, wpBoostGo: 0.042, wentForIt: false, goRecommended: true, resultYards: null },
  { week: 5, wpBoostGo: 0.018, wentForIt: true, goRecommended: true, resultYards: 7 },
  { week: 7, wpBoostGo: -0.008, wentForIt: false, goRecommended: false, resultYards: null },
  { week: 9, wpBoostGo: 0.011, wentForIt: true, goRecommended: true, resultYards: -2 },
  { week: 11, wpBoostGo: 0.029, wentForIt: false, goRecommended: true, resultYards: null },
  { week: 13, wpBoostGo: -0.012, wentForIt: true, goRecommended: false, resultYards: 3 },
  { week: 15, wpBoostGo: 0.057, wentForIt: true, goRecommended: true, resultYards: 12 },
  { week: 17, wpBoostGo: 0.024, wentForIt: true, goRecommended: true, resultYards: 5 },
];
