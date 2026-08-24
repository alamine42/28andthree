import { PHASES } from '@/lib/constants/phases';

/** Revalidation tags + paths shared between the ETL workflow (that hits the
 * endpoint) and the /api/revalidate route handler (that processes it).
 * Single source of truth prevents drift when a phase is added. */

// Paths that ISR caches. ETL revalidates these by path (simpler than tags
// given we have no query-string variants and a fixed URL set).
export const REVALIDATE_PATHS: readonly string[] = [
  '/',
  '/players',
  '/draft-roi',
  '/coaching',
  ...PHASES.map((p) => `/phases/${p}`),
];

// E11 (plan §3.3): the internal historical tree also ISR-caches — most
// importantly the redirect-to-clean entries for the season that just
// rolled from current to historical, including per-player pages whose ids
// cannot be enumerated here. One layout-scoped revalidation clears the
// entire /s subtree (code review pass 1: the previous enumerated list
// missed player paths).
export const REVALIDATE_LAYOUT_PATHS: ReadonlyArray<{
  path: string;
  type: 'layout';
}> = [{ path: '/s/[season]', type: 'layout' }];

const PATH_SET: ReadonlySet<string> = new Set(REVALIDATE_PATHS);

export function isRevalidatablePath(path: unknown): path is string {
  return typeof path === 'string' && PATH_SET.has(path);
}
