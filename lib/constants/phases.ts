export const PHASES = [
  'pass_offense',
  'rush_offense',
  'overall_offense',
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

// Grouping matches the sprint task split (E2-05b/c/d/e) and informs page layout in E3.
export const PHASE_GROUPS = {
  offensive_base: ['pass_offense', 'rush_offense', 'overall_offense'],
  defensive_base: ['pass_defense', 'run_defense'],
  situational: ['redzone_offense', 'redzone_defense', 'third_down_offense', 'third_down_defense'],
  explosive_and_st: ['explosive_offense', 'explosive_defense', 'special_teams'],
} as const satisfies Record<string, readonly Phase[]>;

const PHASE_SET: ReadonlySet<string> = new Set(PHASES);

export function isValidPhase(slug: unknown): slug is Phase {
  return typeof slug === 'string' && PHASE_SET.has(slug);
}
