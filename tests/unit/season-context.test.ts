import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESEASON_WINDOW_DAYS,
  resolveSeasonContext,
  seasonNoticeCopy,
  WEEKLY_CADENCE_COPY,
} from '../../lib/logic/season-context';

// The preseason transition: the site flips to the new season (blank stats
// + notice) once the opener is close, instead of waiting for Week 1 data.
describe('lib/logic/season-context — resolveSeasonContext', () => {
  it('should_enter_transition_inside_preseason_window', () => {
    const ctx = resolveSeasonContext({
      statsSeason: 2025,
      maxScheduledSeason: 2026,
      phase: 'offseason',
      daysUntilNextGame: 16,
    });
    assert.deepEqual(ctx, {
      season: 2026,
      awaitingFirstGame: true,
      kickoffInDays: 16,
    });
  });

  it('should_enter_transition_at_window_boundary', () => {
    const ctx = resolveSeasonContext({
      statsSeason: 2025,
      maxScheduledSeason: 2026,
      phase: 'offseason',
      daysUntilNextGame: PRESEASON_WINDOW_DAYS,
    });
    assert.equal(ctx.awaitingFirstGame, true);
  });

  it('should_stay_on_stats_season_outside_window', () => {
    // May–July: schedule is loaded but kickoff is months out.
    const ctx = resolveSeasonContext({
      statsSeason: 2025,
      maxScheduledSeason: 2026,
      phase: 'offseason',
      daysUntilNextGame: PRESEASON_WINDOW_DAYS + 1,
    });
    assert.deepEqual(ctx, {
      season: 2025,
      awaitingFirstGame: false,
      kickoffInDays: null,
    });
  });

  it('should_stay_on_stats_season_when_no_newer_schedule', () => {
    // February: playoffs just ended, next-season schedule not published.
    const ctx = resolveSeasonContext({
      statsSeason: 2025,
      maxScheduledSeason: 2025,
      phase: 'offseason',
      daysUntilNextGame: 10,
    });
    assert.equal(ctx.awaitingFirstGame, false);
    assert.equal(ctx.season, 2025);
  });

  it('should_stay_on_stats_season_when_schedule_unknown', () => {
    const ctx = resolveSeasonContext({
      statsSeason: 2025,
      maxScheduledSeason: null,
      phase: 'offseason',
      daysUntilNextGame: 10,
    });
    assert.equal(ctx.awaitingFirstGame, false);
  });

  it('should_not_enter_transition_during_regular_season', () => {
    // Week 1 played: team_phase_weekly has 2026 rows, phase=regular.
    const ctx = resolveSeasonContext({
      statsSeason: 2026,
      maxScheduledSeason: 2026,
      phase: 'regular',
      daysUntilNextGame: 4,
    });
    assert.deepEqual(ctx, {
      season: 2026,
      awaitingFirstGame: false,
      kickoffInDays: null,
    });
  });

  it('should_not_enter_transition_during_playoffs', () => {
    const ctx = resolveSeasonContext({
      statsSeason: 2026,
      maxScheduledSeason: 2026,
      phase: 'playoffs',
      daysUntilNextGame: 2,
    });
    assert.equal(ctx.awaitingFirstGame, false);
  });

  it('should_stay_in_transition_when_days_reach_zero_on_gameday', () => {
    // Opener day, game not yet completed: still no snaps in the DB.
    const ctx = resolveSeasonContext({
      statsSeason: 2025,
      maxScheduledSeason: 2026,
      phase: 'offseason',
      daysUntilNextGame: 0,
    });
    assert.equal(ctx.awaitingFirstGame, true);
    assert.equal(ctx.season, 2026);
  });

  it('should_stay_in_transition_during_week_1_lag_without_countdown', () => {
    // Kickoff happened, first ETL run has not loaded snaps yet:
    // phase left offseason but team_phase_weekly still tops out at 2025.
    const ctx = resolveSeasonContext({
      statsSeason: 2025,
      maxScheduledSeason: 2026,
      phase: 'regular',
      daysUntilNextGame: 4,
    });
    assert.deepEqual(ctx, {
      season: 2026,
      awaitingFirstGame: true,
      kickoffInDays: null,
    });
  });
});

// The notice must not claim "no snap taken" once games have been played
// and the site is only waiting on Tuesday's ETL run.
describe('lib/logic/season-context — seasonNoticeCopy', () => {
  it('should_say_no_snap_yet_before_kickoff', () => {
    const copy = seasonNoticeCopy({ season: 2026, kickoffInDays: 12 });
    assert.match(copy, /haven't taken a regular-season snap yet/);
    assert.ok(copy.endsWith(WEEKLY_CADENCE_COPY));
  });

  it('should_not_claim_no_snap_during_week_1_lag', () => {
    const copy = seasonNoticeCopy({ season: 2026, kickoffInDays: null });
    assert.doesNotMatch(copy, /snap/);
    assert.match(copy, /No 2026 stats are loaded yet\./);
    assert.ok(copy.endsWith(WEEKLY_CADENCE_COPY));
  });

  it('should_state_the_tuesday_cadence_not_a_week_1_promise', () => {
    assert.match(WEEKLY_CADENCE_COPY, /Tuesday/);
    assert.doesNotMatch(WEEKLY_CADENCE_COPY, /after Week 1/);
  });
});
