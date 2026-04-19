import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDelta,
  formatEpa,
  formatPercent,
  formatRank,
  NO_DATA,
} from '../../lib/format/number';

// Every rendered metric must flow through one of these helpers. The em-dash
// (U+2014) is the only acceptable "no number" output — bad-numbers crawler
// rejects NaN/null/undefined/0.0-only everywhere else.
describe('lib/format/number — formatEpa', () => {
  it('should_return_em_dash_for_null', () => {
    assert.equal(formatEpa(null), NO_DATA);
  });

  it('should_return_em_dash_for_undefined', () => {
    assert.equal(formatEpa(undefined), NO_DATA);
  });

  it('should_return_em_dash_for_NaN', () => {
    assert.equal(formatEpa(NaN), NO_DATA);
  });

  it('should_return_em_dash_for_Infinity', () => {
    assert.equal(formatEpa(Infinity), NO_DATA);
  });

  it('should_prefix_positive_values_with_plus_sign', () => {
    assert.equal(formatEpa(0.3), '+0.30');
  });

  it('should_use_real_minus_sign_U_2212_for_negatives', () => {
    assert.equal(formatEpa(-0.08), '−0.08');
  });

  it('should_treat_zero_as_signed_plus', () => {
    assert.equal(formatEpa(0), '+0.00');
  });

  it('should_fix_precision_to_two_decimals', () => {
    assert.equal(formatEpa(0.123456), '+0.12');
  });
});

describe('lib/format/number — formatRank', () => {
  it('should_zero_pad_single_digit_ranks', () => {
    assert.equal(formatRank(4), '04');
  });

  it('should_not_pad_double_digit_ranks', () => {
    assert.equal(formatRank(22), '22');
  });

  it('should_return_em_dash_for_null', () => {
    assert.equal(formatRank(null), NO_DATA);
  });

  it('should_return_em_dash_for_undefined', () => {
    assert.equal(formatRank(undefined), NO_DATA);
  });
});

describe('lib/format/number — formatDelta', () => {
  it('should_return_middle_dot_for_zero_delta', () => {
    assert.equal(formatDelta(0), '·');
  });

  it('should_prefix_positive_delta_with_up_triangle', () => {
    assert.equal(formatDelta(3), '▲ 3');
  });

  it('should_prefix_negative_delta_with_down_triangle', () => {
    assert.equal(formatDelta(-5), '▼ 5');
  });

  it('should_return_empty_string_for_null', () => {
    assert.equal(formatDelta(null), '');
  });

  it('should_return_empty_string_for_NaN', () => {
    assert.equal(formatDelta(NaN), '');
  });
});

describe('lib/format/number — formatPercent', () => {
  it('should_render_fraction_as_integer_percent_with_no_space', () => {
    // Per DESIGN.md content conventions: "58%" not "58 %"
    assert.equal(formatPercent(0.58), '58%');
  });

  it('should_round_to_nearest_integer', () => {
    assert.equal(formatPercent(0.584), '58%');
    assert.equal(formatPercent(0.585), '59%');
  });

  it('should_return_em_dash_for_null', () => {
    assert.equal(formatPercent(null), NO_DATA);
  });
});

describe('lib/format/number — NO_DATA sentinel', () => {
  it('should_be_the_real_em_dash_U_2014', () => {
    assert.equal(NO_DATA, '\u2014');
  });
});
