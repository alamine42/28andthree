// Sandbox season state. Lets one running sandbox server render either the
// normal in-season site or the awaiting-data shell every visitor sees from
// February to September: the new season's schedule is loaded, no snaps are.
//
// Selector, in priority order (same pattern as stubs/schedule.ts):
//   1. `x-sandbox-season-state` request header — the e2e spec sets it per
//      browser context so both states are exercised against one dev server.
//   2. `NEXT_PUBLIC_SANDBOX_SEASON_STATE` env var (process-wide default).
//   3. 'live'.
//
// In the 'awaiting' state every data stub returns what the real DAL returns
// for a season with no rows: empty lists, null detail, an overview with a
// 0-0 record and null ranks. bd patsbythenumbers-3ww.

import { headers } from 'next/headers';

export type SandboxSeasonState = 'live' | 'awaiting';

/** The season the awaiting shell shows. One ahead of the fixture season. */
export const AWAITING_SEASON = 2026;
export const AWAITING_KICKOFF_IN_DAYS = 12;

function isState(s: unknown): s is SandboxSeasonState {
  return s === 'live' || s === 'awaiting';
}

export async function sandboxSeasonState(): Promise<SandboxSeasonState> {
  try {
    const h = await headers();
    const fromHeader = h.get('x-sandbox-season-state');
    if (isState(fromHeader)) return fromHeader;
  } catch {
    // Outside a request context — ignore.
  }
  const raw = process.env.NEXT_PUBLIC_SANDBOX_SEASON_STATE;
  if (isState(raw)) return raw;
  return 'live';
}

export async function isAwaiting(): Promise<boolean> {
  return (await sandboxSeasonState()) === 'awaiting';
}
