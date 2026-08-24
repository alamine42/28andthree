import { PHASES } from '@/lib/constants/phases';
import { UNIT_SLUGS } from '@/lib/constants/units';
import { EARLIEST_SEASON } from '@/lib/season-view';

/** Revalidation tags + paths shared between the ETL workflow (that hits the
 * endpoint) and the /api/revalidate route handler (that processes it).
 * Single source of truth prevents drift when a phase is added. */

// Paths that ISR caches. ETL revalidates these by path (simpler than tags
// given we have no query-string variants and a fixed URL set).
const CLEAN_PATHS: readonly string[] = [
  '/',
  '/players',
  '/draft-roi',
  '/coaching',
  ...PHASES.map((p) => `/phases/${p}`),
];

// E11 (plan §3.3): the internal historical tree also ISR-caches — most
// importantly the redirect-to-clean entry for the season that just rolled
// from current to historical. Flushing immutable pages weekly is cheap and
// heals rollover + backfills. Upper bound = current calendar year: /s
// segments above the current season only ever cache a redirect.
const SEASON_SCOPED_SUBPATHS: readonly string[] = [
  '',
  '/coaching',
  '/players',
  ...PHASES.map((p) => `/phases/${p}`),
  ...UNIT_SLUGS.map((u) => `/team/units/${u}`),
];

function historicalPaths(): string[] {
  const currentYear = new Date().getFullYear();
  const out: string[] = [];
  for (let s = EARLIEST_SEASON; s <= currentYear; s++) {
    for (const sub of SEASON_SCOPED_SUBPATHS) out.push(`/s/${s}${sub}`);
  }
  return out;
}

export const REVALIDATE_PATHS: readonly string[] = [
  ...CLEAN_PATHS,
  ...historicalPaths(),
];

const PATH_SET: ReadonlySet<string> = new Set(REVALIDATE_PATHS);

export function isRevalidatablePath(path: unknown): path is string {
  return typeof path === 'string' && PATH_SET.has(path);
}
