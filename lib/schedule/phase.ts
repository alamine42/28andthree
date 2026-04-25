// E9 / bd-8rd.2: schedule-phase derivation. Pure-function core + thin
// DB wrapper. Same contract as etl/schedule.py — both implementations are
// covered by tests/fixtures/schedule-cases.json. Day-deltas are calendar
// days in America/New_York so countdown text doesn't flip ±1 around UTC
// midnight.

import { cache } from 'react';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { isSandbox } from '@/lib/sandbox';

export type SchedulePhase = 'regular' | 'playoffs' | 'offseason';
export type PlayoffRound = 'wild_card' | 'divisional' | 'conference' | 'super_bowl';

export type ScheduleSnapshot = {
  phase: SchedulePhase;
  season: number;
  /** YYYY-MM-DD in America/New_York. */
  lastGameDate: string | null;
  daysSinceLastGame: number | null;
  /** YYYY-MM-DD in America/New_York. */
  nextGameDate: string | null;
  daysUntilNextGame: number | null;
  playoffRound: PlayoffRound | null;
};

export type Aggregate = {
  season: number;
  seasonType: 'REG' | 'POST';
  /** YYYY-MM-DD. */
  firstGame: string;
  /** YYYY-MM-DD. */
  lastGame: string;
  lastWeek: number;
};

export type PlayoffWeek = {
  week: number;
  firstGame: string;
  lastGame: string;
};

export type DerivePhaseInput = {
  now: Date;
  rows: Aggregate[];
  playoffWeeks: PlayoffWeek[];
  nextGameDate: string | null;
  lastCompletedDate: string | null;
};

// nflverse week-to-round mapping for postseason. Verified against `games`
// table 2024-25 + 2025-26 POST rows: week 19=6 games (wild card),
// 20=4 (divisional), 21=2 (conference), 22=1 (super bowl). Our ETL
// normalizes nflverse string weeks to integers, so the integer mapping is
// safe here. See plan v2 §5.
const PLAYOFF_WEEK_TO_ROUND: Record<number, PlayoffRound> = {
  19: 'wild_card',
  20: 'divisional',
  21: 'conference',
  22: 'super_bowl',
};

// ---- Pure derivation -------------------------------------------------------

export function derivePhase(input: DerivePhaseInput): ScheduleSnapshot {
  const { now, rows, playoffWeeks, nextGameDate, lastCompletedDate } = input;
  const today = nyDateString(now);

  const season = pickCurrentSeason(rows, today);
  const phase = computePhase(rows, today, season);
  const playoffRound = phase === 'playoffs' ? computePlayoffRound(playoffWeeks, today) : null;

  return {
    phase,
    season,
    lastGameDate: lastCompletedDate,
    daysSinceLastGame: lastCompletedDate ? daysBetween(lastCompletedDate, today) : null,
    nextGameDate,
    daysUntilNextGame: nextGameDate ? daysBetween(today, nextGameDate) : null,
    playoffRound,
  };
}

function pickCurrentSeason(rows: Aggregate[], today: string): number {
  // The latest season whose REG first_game ≤ today. If none (early
  // bootstrap state), fall back to the smallest season we have any row
  // for.
  const regSeasonsStarted = rows
    .filter((r) => r.seasonType === 'REG' && r.firstGame <= today)
    .map((r) => r.season);
  if (regSeasonsStarted.length > 0) {
    return Math.max(...regSeasonsStarted);
  }
  if (rows.length > 0) {
    return Math.min(...rows.map((r) => r.season));
  }
  // No data at all — fall back to current calendar year.
  return new Date(today + 'T00:00:00Z').getUTCFullYear();
}

function computePhase(rows: Aggregate[], today: string, season: number): SchedulePhase {
  const reg = rows.find((r) => r.season === season && r.seasonType === 'REG');
  const post = rows.find((r) => r.season === season && r.seasonType === 'POST');

  if (reg && today >= reg.firstGame && today <= reg.lastGame) return 'regular';
  if (reg && post && today > reg.lastGame && today <= post.lastGame) return 'playoffs';
  return 'offseason';
}

function computePlayoffRound(weeks: PlayoffWeek[], today: string): PlayoffRound | null {
  if (weeks.length === 0) return null;
  // Find the week whose range contains today, OR the next upcoming week
  // (during the gap between REG end and first POST game).
  const sorted = [...weeks].sort((a, b) => a.week - b.week);
  for (const w of sorted) {
    if (today >= w.firstGame && today <= w.lastGame) return PLAYOFF_WEEK_TO_ROUND[w.week] ?? null;
  }
  // No "current" week — find next upcoming.
  const next = sorted.find((w) => today < w.firstGame);
  if (next) return PLAYOFF_WEEK_TO_ROUND[next.week] ?? null;
  // Past the last playoff week (shouldn't normally happen — POST.lastGame
  // covers it). Return the last round as a safe default.
  const last = sorted[sorted.length - 1];
  return last ? PLAYOFF_WEEK_TO_ROUND[last.week] ?? null : null;
}

// ---- America/New_York date helpers -----------------------------------------

const NY_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Convert a Date into a YYYY-MM-DD string in America/New_York. */
function nyDateString(d: Date): string {
  // en-CA renders YYYY-MM-DD natively, dodging the en-US M/D/Y trap.
  return NY_DATE_FORMATTER.format(d);
}

/**
 * Calendar days between two YYYY-MM-DD strings (b - a). Both interpreted
 * as midnight UTC; subtraction yields whole-day count regardless of DST.
 */
function daysBetween(aIso: string, bIso: string): number {
  const a = Date.UTC(
    Number(aIso.slice(0, 4)),
    Number(aIso.slice(5, 7)) - 1,
    Number(aIso.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(bIso.slice(0, 4)),
    Number(bIso.slice(5, 7)) - 1,
    Number(bIso.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
}

// ---- DB wrapper (cached per server render) ---------------------------------

type SnapshotRow = {
  season: number;
  season_type: 'REG' | 'POST';
  first_game: string;
  last_game: string;
  last_week: number;
};

type AggregateExtras = {
  next_game_date: string | null;
  last_completed_date: string | null;
};

/**
 * Query `games` table and derive a ScheduleSnapshot. Cached per server
 * render via React `cache()` — no cross-render staleness.
 */
export const getSchedulePhase = cache(async (now: Date = new Date()): Promise<ScheduleSnapshot> => {
  if (isSandbox()) {
    const stub = await import('@/lib/sandbox/stubs/schedule');
    return stub.getSchedulePhase(now);
  }
  const db = getDb();
  if (!db) {
    // Bootstrap state: no DB connection. Return a benign offseason snap so
    // downstream UI renders sensible copy instead of crashing.
    return {
      phase: 'offseason',
      season: now.getUTCFullYear(),
      lastGameDate: null,
      daysSinceLastGame: null,
      nextGameDate: null,
      daysUntilNextGame: null,
      playoffRound: null,
    };
  }

  // Anchor the SQL `now` to America/New_York date so the query agrees with
  // etl/schedule.py (which does the same conversion) — without this, after
  // ~8pm ET the UTC date advances past NY's, and the two implementations
  // disagree on which game is "next".
  const today = nyDateString(now);
  const calendarYear = Number(today.slice(0, 4));
  const aggResult = await db.execute<SnapshotRow & AggregateExtras>(sql`
    SELECT season, season_type,
           MIN(game_date)::text AS first_game,
           MAX(game_date)::text AS last_game,
           MAX(week)::int       AS last_week,
           (SELECT MIN(game_date)::text FROM games
              WHERE game_date > ${today}::date
                 OR (game_date = ${today}::date AND completed = false)
           )                                              AS next_game_date,
           (SELECT MAX(game_date)::text FROM games
              WHERE game_date <= ${today}::date AND completed = true) AS last_completed_date
    FROM games
    WHERE season BETWEEN ${calendarYear - 1} AND ${calendarYear + 1}
    GROUP BY season, season_type
    ORDER BY season, season_type
  `);

  const rawRows = (aggResult.rows ?? aggResult) as Array<SnapshotRow & AggregateExtras>;
  if (rawRows.length === 0) {
    return {
      phase: 'offseason',
      season: calendarYear,
      lastGameDate: null,
      daysSinceLastGame: null,
      nextGameDate: null,
      daysUntilNextGame: null,
      playoffRound: null,
    };
  }

  const rows: Aggregate[] = rawRows.map((r) => ({
    season: r.season,
    seasonType: r.season_type,
    firstGame: r.first_game,
    lastGame: r.last_game,
    lastWeek: r.last_week,
  }));

  // Per-week POST aggregates for the current season — needed only when
  // phase=playoffs to derive the round. Fetched separately to keep the
  // primary aggregate query small.
  const seasonGuess = pickCurrentSeason(rows, today);
  const playoffWeeks = await fetchPlayoffWeeks(db, seasonGuess);

  // Same now-anchored aggregates from the first query — pull from any row.
  const extras = rawRows[0]!;

  return derivePhase({
    now,
    rows,
    playoffWeeks,
    nextGameDate: extras.next_game_date,
    lastCompletedDate: extras.last_completed_date,
  });
});

async function fetchPlayoffWeeks(
  db: NonNullable<ReturnType<typeof getDb>>,
  season: number,
): Promise<PlayoffWeek[]> {
  const result = await db.execute<{ week: number; first_game: string; last_game: string }>(sql`
    SELECT week::int AS week,
           MIN(game_date)::text AS first_game,
           MAX(game_date)::text AS last_game
    FROM games
    WHERE season = ${season} AND season_type = 'POST'
    GROUP BY week
    ORDER BY week
  `);
  const rows = (result.rows ?? result) as Array<{ week: number; first_game: string; last_game: string }>;
  return rows.map((r) => ({ week: r.week, firstGame: r.first_game, lastGame: r.last_game }));
}
