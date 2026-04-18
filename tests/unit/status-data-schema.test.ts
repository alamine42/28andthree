import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maxSeason, minSeason, queryParamSchema } from '../../lib/status-data/schema';

describe('lib/status-data/schema', () => {
  it('should_accept_known_phase_and_valid_season', () => {
    const result = queryParamSchema.parse({ phase: 'pass_offense', season: '2025' });
    assert.equal(result.phase, 'pass_offense');
    assert.equal(result.season, 2025);
    assert.equal(result.week, undefined);
  });

  it('should_reject_unknown_phase_slug', () => {
    assert.throws(() => queryParamSchema.parse({ phase: 'nonsense', season: '2025' }));
  });

  it('should_reject_season_below_2020_lower_bound', () => {
    assert.throws(() => queryParamSchema.parse({ phase: 'pass_offense', season: '2019' }));
  });

  it('should_derive_upper_bound_from_current_year_not_hardcode', () => {
    // Upper bound = current year + 1 so the schema stays forward-compatible
    // without manual bumps every August.
    assert.ok(maxSeason() >= new Date().getFullYear());
  });

  it('should_reject_season_above_derived_upper_bound', () => {
    const tooFar = maxSeason() + 10;
    assert.throws(() =>
      queryParamSchema.parse({ phase: 'pass_offense', season: String(tooFar) }),
    );
  });

  it('should_parse_optional_week_as_integer', () => {
    const result = queryParamSchema.parse({
      phase: 'pass_offense',
      season: '2025',
      week: '14',
    });
    assert.equal(result.week, 14);
  });

  it('should_reject_week_above_22_playoff_bound', () => {
    assert.throws(() =>
      queryParamSchema.parse({ phase: 'pass_offense', season: '2025', week: '25' }),
    );
  });

  it('should_reject_week_below_1', () => {
    assert.throws(() =>
      queryParamSchema.parse({ phase: 'pass_offense', season: '2025', week: '0' }),
    );
  });

  it('minSeason_should_be_2020', () => {
    assert.equal(minSeason, 2020);
  });
});
