import { cache } from 'react';
import { desc } from 'drizzle-orm';
import { metaRefresh } from '@/db/schema';
import { getDb } from '@/lib/db';
import { isSandbox } from '@/lib/sandbox';

// E13-01: one source for "how fresh is this page".
//
// SiteFooter has carried a "Last refresh" line since E1, but it reads an
// optional `lastRefreshIso` prop that no caller has ever passed — so in
// production the line has always rendered "Last refresh: never", which
// reads as a broken site rather than a fresh one. This DAL closes that:
// the footer and the data rail both call it, so the two can never
// disagree about when the numbers last landed.
//
// `completedAt` is the honest field, not `startedAt`: a run that started
// an hour ago and is still going has not refreshed anything yet.

const PG_UNDEFINED_TABLE = '42P01';

export type RefreshSnapshot = {
  /** When the most recent successful ETL run finished. */
  completedAt: Date | null;
};

/** Most recent completed ETL run. Cached per server render, so the footer
 * and the rail on the same page cost one query between them. */
export const getLastRefresh = cache(async (): Promise<RefreshSnapshot> => {
  if (isSandbox()) {
    const stub = await import('@/lib/sandbox/stubs/refresh');
    return stub.getLastRefresh();
  }
  const db = getDb();
  if (!db) return { completedAt: null };
  try {
    const [row] = await db
      .select({ completedAt: metaRefresh.completedAt, status: metaRefresh.status })
      .from(metaRefresh)
      .orderBy(desc(metaRefresh.completedAt))
      .limit(1);
    // A failed run still has a completedAt. Reporting it as the freshness
    // of the data would be a lie — the numbers on screen are from whatever
    // succeeded before it — so only an 'ok' run counts.
    if (!row || row.status !== 'ok') return { completedAt: null };
    return { completedAt: row.completedAt };
  } catch (e) {
    // The table is missing before the first migration on a fresh database.
    // A freshness line is decoration on top of the page's real content, so
    // it degrades to "unknown" rather than taking the layout down with it.
    if (e && typeof e === 'object' && 'code' in e && e.code === PG_UNDEFINED_TABLE) {
      return { completedAt: null };
    }
    console.error('getLastRefresh failed', e);
    return { completedAt: null };
  }
});

/** "Tue 10:06 AM ET" — the terminal-style date format from DESIGN.md
 * §Content. Returns null when there is nothing honest to show. */
export function formatRefresh(completedAt: Date | null): string | null {
  if (!completedAt) return null;
  return completedAt.toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  });
}
