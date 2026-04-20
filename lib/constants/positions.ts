// Player positions we aggregate per-position stats for. nflverse reports
// ~50 distinct position codes; for v1 we only build rollups for the four
// that drive the ship-facing pages (QB + skill trio). Other positions land
// in the players table with their raw code for completeness; they just
// don't get weekly/season aggregation yet.

export const PLAYER_POSITIONS = ['QB', 'WR', 'RB', 'TE'] as const;

export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

export const POSITION_DISPLAY_NAMES: Record<PlayerPosition, string> = {
  QB: 'Quarterback',
  WR: 'Wide receiver',
  RB: 'Running back',
  TE: 'Tight end',
};

export const SKILL_POSITIONS = ['WR', 'RB', 'TE'] as const satisfies readonly PlayerPosition[];
type SkillPosition = (typeof SKILL_POSITIONS)[number];

const POSITION_SET: ReadonlySet<string> = new Set(PLAYER_POSITIONS);
const SKILL_SET: ReadonlySet<string> = new Set(SKILL_POSITIONS);

export function isValidPosition(v: unknown): v is PlayerPosition {
  return typeof v === 'string' && POSITION_SET.has(v);
}

export function isSkillPosition(v: unknown): v is SkillPosition {
  return typeof v === 'string' && SKILL_SET.has(v);
}
