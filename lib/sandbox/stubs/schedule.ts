// E9 / bd-8rd.5: sandbox stub for getSchedulePhase. Returns one of three
// canned snaps so the eyebrow + footer can be exercised across phases
// without needing a live games table. Phase selector (in priority order):
//   1. `x-sandbox-schedule-phase` request header (per-request override —
//      the e2e spec uses this to test all 3 phases against one dev server).
//   2. `NEXT_PUBLIC_SANDBOX_SCHEDULE_PHASE` env var (process-wide default).
//   3. 'regular' fallback.
//
// The phases below are calibrated to render representative copy:
//   regular  → "2025 SEASON · IN PROGRESS"
//   playoffs → "2025 PLAYOFFS · WILD CARD"
//   offseason → "2025 SEASON · FINAL · NEXT GAME IN 87 DAYS"

import { headers } from 'next/headers';
import type { ScheduleSnapshot, SchedulePhase } from '@/lib/schedule/phase';

const REGULAR: ScheduleSnapshot = {
  phase: 'regular',
  season: 2025,
  lastGameDate: '2025-10-13',
  daysSinceLastGame: 1,
  nextGameDate: '2025-10-16',
  daysUntilNextGame: 2,
  playoffRound: null,
};

const PLAYOFFS: ScheduleSnapshot = {
  phase: 'playoffs',
  season: 2025,
  lastGameDate: '2026-01-10',
  daysSinceLastGame: 1,
  nextGameDate: '2026-01-11',
  daysUntilNextGame: 0,
  playoffRound: 'wild_card',
};

const OFFSEASON: ScheduleSnapshot = {
  phase: 'offseason',
  season: 2025,
  lastGameDate: '2026-02-08',
  daysSinceLastGame: 188,
  nextGameDate: '2026-09-03',
  daysUntilNextGame: 87,
  playoffRound: null,
};

const SNAPSHOTS: Record<SchedulePhase, ScheduleSnapshot> = {
  regular: REGULAR,
  playoffs: PLAYOFFS,
  offseason: OFFSEASON,
};

function isPhase(s: unknown): s is SchedulePhase {
  return s === 'regular' || s === 'playoffs' || s === 'offseason';
}

async function pickPhase(): Promise<SchedulePhase> {
  // Per-request header override (used by e2e spec to test all 3 phases
  // against a single running dev server). headers() is server-component
  // only; in any other context it throws and we fall back.
  try {
    const h = await headers();
    const fromHeader = h.get('x-sandbox-schedule-phase');
    if (isPhase(fromHeader)) return fromHeader;
  } catch {
    // Outside a request context (e.g. unit-test direct call) — ignore.
  }
  const raw = process.env.NEXT_PUBLIC_SANDBOX_SCHEDULE_PHASE;
  if (isPhase(raw)) return raw;
  return 'regular';
}

export async function getSchedulePhase(_now?: Date): Promise<ScheduleSnapshot> {
  return SNAPSHOTS[await pickPhase()];
}
