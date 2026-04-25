import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { derivePhase, type ScheduleSnapshot } from '../../lib/schedule/phase';

// E9 / bd-8rd.2: contract test against the shared golden-values fixture
// (tests/fixtures/schedule-cases.json). Same fixture is consumed by
// etl/tests/test_schedule.py — both implementations must produce the same
// snapshot for every case. Day-deltas are calendar days in America/New_York.

type FixtureRow = {
  season: number;
  season_type: 'REG' | 'POST';
  first_game: string;
  last_game: string;
  last_week: number;
};

type FixturePlayoffWeek = {
  week: number;
  first_game: string;
  last_game: string;
};

type FixtureCase = {
  name: string;
  now_utc: string;
  input: {
    rows: FixtureRow[];
    playoff_weeks: FixturePlayoffWeek[];
    next_game_date: string | null;
    last_completed_date: string | null;
  };
  expected: {
    phase: 'regular' | 'playoffs' | 'offseason';
    season: number;
    last_game_date: string | null;
    days_since_last_game: number | null;
    next_game_date: string | null;
    days_until_next_game: number | null;
    playoff_round: 'wild_card' | 'divisional' | 'conference' | 'super_bowl' | null;
  };
};

type Fixture = { tz: string; cases: FixtureCase[] };

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '..', 'fixtures', 'schedule-cases.json');
const fixture: Fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

function expectedSnapshot(c: FixtureCase): ScheduleSnapshot {
  const e = c.expected;
  return {
    phase: e.phase,
    season: e.season,
    lastGameDate: e.last_game_date,
    daysSinceLastGame: e.days_since_last_game,
    nextGameDate: e.next_game_date,
    daysUntilNextGame: e.days_until_next_game,
    playoffRound: e.playoff_round,
  };
}

describe('derivePhase — golden values from schedule-cases.json', () => {
  for (const c of fixture.cases) {
    it(`${c.name}`, () => {
      const result = derivePhase({
        now: new Date(c.now_utc),
        rows: c.input.rows.map((r) => ({
          season: r.season,
          seasonType: r.season_type,
          firstGame: r.first_game,
          lastGame: r.last_game,
          lastWeek: r.last_week,
        })),
        playoffWeeks: c.input.playoff_weeks.map((w) => ({
          week: w.week,
          firstGame: w.first_game,
          lastGame: w.last_game,
        })),
        nextGameDate: c.input.next_game_date,
        lastCompletedDate: c.input.last_completed_date,
      });

      assert.deepEqual(result, expectedSnapshot(c));
    });
  }
});
