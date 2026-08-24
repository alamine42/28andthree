import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EARLIEST_SEASON,
  browsableSeasons,
  isSeasonScopedPath,
  parseSeasonParam,
  withSeason,
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

  it('should_reject_seasons_beyond_the_current_calendar_year', () => {
    const thisYear = new Date().getFullYear();
    assert.equal(parseSeasonParam(String(thisYear)), thisYear);
    assert.equal(parseSeasonParam(String(thisYear + 1)), null);
    assert.equal(parseSeasonParam('9999'), null);
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

describe('lib/season-view — browsableSeasons + withSeason', () => {
  it('should_list_seasons_newest_first_down_to_the_floor', () => {
    const seasons = browsableSeasons(2026);
    assert.equal(seasons[0], 2026);
    assert.equal(seasons[seasons.length - 1], EARLIEST_SEASON);
    assert.equal(seasons.length, 2026 - EARLIEST_SEASON + 1);
  });

  it('should_append_the_season_param_only_when_present', () => {
    assert.equal(withSeason('/phases/pass_offense', 2023), '/phases/pass_offense?season=2023');
    assert.equal(withSeason('/coaching', null), '/coaching');
    assert.equal(withSeason('/', undefined), '/');
  });
});
