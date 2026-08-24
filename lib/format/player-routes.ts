import type { Route } from 'next';

// Canonical player-role buckets. Drives routing from a roster card:
//   qb/skill → player deep dive; ol/dline/defense → unit page; special → no
// destination yet (card renders non-clickable).
export type PlayerRole = 'qb' | 'skill' | 'ol' | 'dline' | 'defense' | 'special';

// Filter-chip buckets on the players hub. Independent of `PlayerRole` because
// the `skill` role covers both the RB chip and the WR+TE chip
// (plan §3.3, review finding #13).
export type PlayerCategory = 'QB' | 'RB' | 'WR+TE' | 'OL' | 'DEF' | 'ST';

const POSITION_TO_ROLE: Readonly<Record<string, PlayerRole>> = {
  QB: 'qb',
  RB: 'skill', HB: 'skill', FB: 'skill', WR: 'skill', TE: 'skill',
  C: 'ol', G: 'ol', OG: 'ol', T: 'ol', OT: 'ol', OL: 'ol',
  DT: 'dline', DE: 'dline', NT: 'dline', DL: 'dline',
  LB: 'defense', ILB: 'defense', OLB: 'defense', MLB: 'defense',
  CB: 'defense', S: 'defense', FS: 'defense', SS: 'defense', DB: 'defense',
  K: 'special', P: 'special', LS: 'special',
  KR: 'special', PR: 'special', RS: 'special', ST: 'special',
};

const POSITION_TO_CATEGORY: Readonly<Record<string, PlayerCategory>> = {
  QB: 'QB',
  RB: 'RB', HB: 'RB', FB: 'RB',
  WR: 'WR+TE', TE: 'WR+TE',
  C: 'OL', G: 'OL', OG: 'OL', T: 'OL', OT: 'OL', OL: 'OL',
  DT: 'DEF', DE: 'DEF', NT: 'DEF', DL: 'DEF',
  LB: 'DEF', ILB: 'DEF', OLB: 'DEF', MLB: 'DEF',
  CB: 'DEF', S: 'DEF', FS: 'DEF', SS: 'DEF', DB: 'DEF',
  K: 'ST', P: 'ST', LS: 'ST', KR: 'ST', PR: 'ST', RS: 'ST', ST: 'ST',
};

export function roleFor(position: string | null | undefined): PlayerRole {
  if (!position) return 'defense';
  return POSITION_TO_ROLE[position.toUpperCase()] ?? 'defense';
}

export function categoryFor(position: string | null | undefined): PlayerCategory {
  if (!position) return 'DEF';
  return POSITION_TO_CATEGORY[position.toUpperCase()] ?? 'DEF';
}

// Returns `null` for `special` so callers must render a non-clickable card;
// there's no /team/units/special-teams page yet, and we'd rather surface
// "coming soon" than pretend a kicker link goes somewhere useful.
export function playerHref(
  entry: { role: PlayerRole; gsisId: string },
  seasonQuery?: number | null,
): Route | null {
  const base = basePlayerHref(entry);
  if (base == null || seasonQuery == null) return base;
  // E11: while a past season is in view, links carry it forward.
  return `${base}?season=${seasonQuery}` as Route;
}

function basePlayerHref(entry: { role: PlayerRole; gsisId: string }): Route | null {
  switch (entry.role) {
    case 'qb':      return `/players/qb/${entry.gsisId}` as Route;
    case 'skill':   return `/players/skill/${entry.gsisId}` as Route;
    case 'ol':      return '/team/units/offensive-line' as Route;
    case 'dline':   return '/team/units/defensive-line' as Route;
    case 'defense': return '/team/units/defense' as Route;
    case 'special': return null;
  }
}
