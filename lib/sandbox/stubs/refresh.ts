// E13-01: DAL stub for lib/data/refresh.ts.
//
// A fixed timestamp, not Date.now(): a moving value would differ between
// the server render and the client hydration and throw a mismatch, which
// is exactly the class of bug the E13 port had to chase out of the charts.

import type { RefreshSnapshot } from '@/lib/data/refresh';

const FIXTURE_REFRESH = new Date('2026-01-06T15:06:00.000Z');

export async function getLastRefresh(): Promise<RefreshSnapshot> {
  return { completedAt: FIXTURE_REFRESH };
}
