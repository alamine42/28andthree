/** Pure parsing of /og query params into a normalized layout payload.
 *  Kept separate from the route handler so it can be unit-tested without
 *  having to spin up next/og. */

export type OgParams = {
  title: string;
  eyebrow: string | null;
  stat: string | null;
  rank: string | null;
};

const DEFAULT_TITLE = '28 and Three';
const TITLE_MAX = 80;
const EYEBROW_MAX = 60;
const STAT_MAX = 40;
const RANK_MAX = 4;

export function parseOgParams(searchParams: URLSearchParams): OgParams {
  return {
    title: clamp(searchParams.get('title'), TITLE_MAX) ?? DEFAULT_TITLE,
    eyebrow: clamp(searchParams.get('eyebrow'), EYEBROW_MAX),
    stat: clamp(searchParams.get('stat'), STAT_MAX),
    rank: clamp(searchParams.get('rank'), RANK_MAX),
  };
}

function clamp(value: string | null, max: number): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  // Truncate defensively so a caller passing an unreasonably long string
  // doesn't overflow the OG card layout. Satori wraps text but won't
  // shrink the font; the image ends up unreadable otherwise.
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}
