import { PHASES } from '@/lib/constants/phases';

/** Revalidation tags + paths shared between the ETL workflow (that hits the
 * endpoint) and the /api/revalidate route handler (that processes it).
 * Single source of truth prevents drift when a phase is added. */

// Paths that ISR caches. ETL revalidates these by path (simpler than tags
// given we have no query-string variants and a fixed URL set).
export const REVALIDATE_PATHS: readonly string[] = [
  '/',
  '/players',
  ...PHASES.map((p) => `/phases/${p}`),
];

const PATH_SET: ReadonlySet<string> = new Set(REVALIDATE_PATHS);

export function isRevalidatablePath(path: unknown): path is string {
  return typeof path === 'string' && PATH_SET.has(path);
}
