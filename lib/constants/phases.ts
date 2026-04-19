export const PHASES = [
  'pass_offense',
  'rush_offense',
  // `overall` replaced `overall_offense` in E3-16. It's now the team EPA
  // differential (offensive EPA/play − defensive EPA/play allowed) per
  // SPEC §3.2 #12, not an offensive-plays-only aggregate.
  'overall',
  'pass_defense',
  'run_defense',
  'redzone_offense',
  'redzone_defense',
  'third_down_offense',
  'third_down_defense',
  'explosive_offense',
  'explosive_defense',
  'special_teams',
] as const;

export type Phase = (typeof PHASES)[number];

// Grouping informs page layout in E3 (sprint task split legacy).
export const PHASE_GROUPS = {
  offensive_base: ['pass_offense', 'rush_offense'],
  defensive_base: ['pass_defense', 'run_defense'],
  situational: ['redzone_offense', 'redzone_defense', 'third_down_offense', 'third_down_defense'],
  explosive_and_st: ['explosive_offense', 'explosive_defense', 'special_teams'],
  overall: ['overall'],
} as const satisfies Record<string, readonly Phase[]>;

const PHASE_SET: ReadonlySet<string> = new Set(PHASES);

export function isValidPhase(slug: unknown): slug is Phase {
  return typeof slug === 'string' && PHASE_SET.has(slug);
}
