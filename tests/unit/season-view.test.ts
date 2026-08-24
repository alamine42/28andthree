import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EARLIEST_SEASON,
  isSeasonScopedPath,
  parseSeasonParam,
  resolveSeasonView,
} from '../../lib/season-view';

// E11-01: one strict validator + one path allowlist, shared by middleware,
// server pages, and client chrome. Review CRITICAL: parseInt('2023x')
// silently passing on the client while the middleware regex rejects it
// would label current data as historical.

describe('lib/season-view — parseSeasonParam', () => {
  it('should_accept_a_plain_4digit_season', () => {
    assert.equal(parseSeasonParam('2023'), 2023);
    assert.equal(parseSeasonParam(String(EARLIEST_SEASON)), EARLIEST_SEASON);
  });

  it('should_reject_trailing_garbage', () => {
    assert.equal(parseSeasonParam('2023x'), null);
    assert.equal(parseSeasonParam(' 2023'), null);
    assert.equal(parseSeasonParam('2023 '), null);
    assert.equal(parseSeasonParam('+2023'), null);
  });

  it('should_reject_non_numeric_and_wrong_length', () => {
    assert.equal(parseSeasonParam('abc'), null);
    assert.equal(parseSeasonParam('202'), null);
    assert.equal(parseSeasonParam('20233'), null);
    assert.equal(parseSeasonParam(''), null);
    assert.equal(parseSeasonParam(null), null);
    assert.equal(parseSeasonParam(undefined), null);
  });

  it('should_reject_seasons_before_the_data_floor', () => {
    assert.equal(parseSeasonParam('1999'), null);
    assert.equal(parseSeasonParam('2019'), null);
  });
});

describe('lib/season-view — isSeasonScopedPath', () => {
  it('should_match_the_season_scoped_routes', () => {
    for (const p of [
      '/',
      '/phases/pass_offense',
      '/team/units/defense',
      '/coaching',
      '/players',
      '/players/qb/00-0039851',
      '/players/skill/00-0031234',
    ]) {
      assert.equal(isSeasonScopedPath(p), true, p);
    }
  });

  it('should_not_match_season_agnostic_routes', () => {
    for (const p of [
      '/draft-roi',
      '/status',
      '/methodology',
      '/tokens',
      '/admin',
      '/admin/drafts',
      '/api/authoring/cron-tick',
      '/s/2023/coaching',
      '/phases',
      '/players/qb',
    ]) {
      assert.equal(isSeasonScopedPath(p), false, p);
    }
  });
});

describe('lib/season-view — resolveSeasonView', () => {
  it('should_resolve_a_valid_past_season_as_historical', () => {
    const v = resolveSeasonView('2023', 2026);
    assert.deepEqual(
      { season: v.season, historical: v.historical },
      { season: 2023, historical: true },
    );
  });

  it('should_fall_back_to_current_for_invalid_params', () => {
    for (const raw of ['2023x', 'abc', '1999', undefined, '']) {
      const v = resolveSeasonView(raw as string | undefined, 2026);
      assert.equal(v.season, 2026, String(raw));
      assert.equal(v.historical, false, String(raw));
    }
  });

  it('should_treat_current_and_future_seasons_as_current', () => {
    assert.equal(resolveSeasonView('2026', 2026).historical, false);
    assert.equal(resolveSeasonView('2030', 2026).historical, false);
  });

  it('should_take_the_first_value_of_an_array_param', () => {
    const v = resolveSeasonView(['2022', '2024'], 2026);
    assert.equal(v.season, 2022);
  });

  it('should_list_seasons_newest_first_down_to_the_floor', () => {
    const v = resolveSeasonView(undefined, 2026);
    assert.equal(v.seasons[0], 2026);
    assert.equal(v.seasons[v.seasons.length - 1], EARLIEST_SEASON);
    assert.equal(v.seasons.length, 2026 - EARLIEST_SEASON + 1);
  });
});
