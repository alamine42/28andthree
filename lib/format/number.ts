// Single place where `null`, `undefined`, `NaN`, `Infinity` collapse into a
// renderable string. Every UI numeric must flow through one of these helpers
// so the bad-number crawler (`tests/e2e/no-bad-numbers.spec.ts`) stays green.
//
// Conventions per DESIGN.md §Content:
//   - Real minus sign U+2212 for negatives (not hyphen).
//   - "+0.00" (signed zero) — deltas never hide direction.
//   - Percentages: "58%" no space.
//   - Ranks: English ordinal suffix ("1st", "22nd", "13th") — the teen
//     exceptions (11/12/13 → "th") are handled inside formatRank.

/** Sentinel rendered when a metric is null / undefined / NaN / Infinity. */
export const NO_DATA = '\u2014'; // em-dash

const MINUS = '\u2212'; // U+2212 real minus sign

function isFiniteNumber(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v);
}

export function formatEpa(v: number | null | undefined): string {
  if (!isFiniteNumber(v)) return NO_DATA;
  const sign = v >= 0 ? '+' : MINUS;
  return `${sign}${Math.abs(v).toFixed(2)}`;
}

export function formatRank(rank: number | null | undefined): string {
  if (!isFiniteNumber(rank)) return NO_DATA;
  const n = Math.trunc(rank);
  return `${n}${ordinalSuffix(n)}`;
}

/** English ordinal suffix. 11/12/13 all use "th" regardless of last
 *  digit (the "teen exception"). Kept internal — callers want the
 *  formatted rank string, not just the suffix. */
function ordinalSuffix(n: number): 'st' | 'nd' | 'rd' | 'th' {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  const mod10 = abs % 10;
  if (mod10 === 1) return 'st';
  if (mod10 === 2) return 'nd';
  if (mod10 === 3) return 'rd';
  return 'th';
}

export function formatDelta(delta: number | null | undefined): string {
  if (!isFiniteNumber(delta)) return '';
  if (delta === 0) return '·';
  const glyph = delta > 0 ? '▲' : '▼';
  return `${glyph} ${Math.abs(delta)}`;
}

export function formatPercent(frac: number | null | undefined): string {
  if (!isFiniteNumber(frac)) return NO_DATA;
  return `${Math.round(frac * 100)}%`;
}

/** Signed integer (e.g., point differential, score deltas). Uses U+2212
 * for negatives per DESIGN.md §Content and "+" for positives so direction
 * is always explicit. */
export function formatSignedInt(v: number | null | undefined): string {
  if (!isFiniteNumber(v)) return NO_DATA;
  const n = Math.trunc(v);
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : `${MINUS}${Math.abs(n)}`;
}
