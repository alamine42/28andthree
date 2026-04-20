// Team-level unit pages ship under /team/units/<slug>. URLs favor hyphens
// for readability over the DB style (underscore) — accepted small drift
// since URLs are a user surface and DB enum strings aren't.

export const UNIT_SLUGS = ['defense', 'offensive-line', 'defensive-line'] as const;

export type UnitSlug = (typeof UNIT_SLUGS)[number];

export const UNIT_DISPLAY_NAMES: Record<UnitSlug, string> = {
  defense: 'Defense',
  'offensive-line': 'Offensive line',
  'defensive-line': 'Defensive line',
};

const SLUG_SET: ReadonlySet<string> = new Set(UNIT_SLUGS);

export function isValidUnitSlug(v: unknown): v is UnitSlug {
  return typeof v === 'string' && SLUG_SET.has(v);
}
