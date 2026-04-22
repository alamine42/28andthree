import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDelta,
  formatEpa,
  formatPercent,
  formatRank,
  formatSignedInt,
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

describe('lib/format/number — formatRank (ordinal suffix)', () => {
  it('should_render_rank_1_as_1st', () => {
    assert.equal(formatRank(1), '1st');
  });

  it('should_render_rank_2_as_2nd', () => {
    assert.equal(formatRank(2), '2nd');
  });

  it('should_render_rank_3_as_3rd', () => {
    assert.equal(formatRank(3), '3rd');
  });

  it('should_render_ranks_4_through_10_with_th', () => {
    for (let n = 4; n <= 10; n++) {
      assert.equal(formatRank(n), `${n}th`, `rank ${n}`);
    }
  });

  it('should_use_th_for_the_teen_exceptions_11_12_13', () => {
    // 11/12/13 all take "th" even though they end in 1/2/3 — English
    // ordinal teens exception. Without this, we'd ship "11st / 12nd / 13rd".
    assert.equal(formatRank(11), '11th');
    assert.equal(formatRank(12), '12th');
    assert.equal(formatRank(13), '13th');
  });

  it('should_render_ranks_14_through_20_with_th', () => {
    for (let n = 14; n <= 20; n++) {
      assert.equal(formatRank(n), `${n}th`, `rank ${n}`);
    }
  });

  it('should_render_rank_21_as_21st', () => {
    assert.equal(formatRank(21), '21st');
  });

  it('should_render_rank_22_as_22nd', () => {
    assert.equal(formatRank(22), '22nd');
  });

  it('should_render_rank_23_as_23rd', () => {
    assert.equal(formatRank(23), '23rd');
  });

  it('should_render_rank_32_as_32nd_league_bottom', () => {
    assert.equal(formatRank(32), '32nd');
  });

  it('should_return_em_dash_for_null', () => {
    assert.equal(formatRank(null), NO_DATA);
  });

  it('should_return_em_dash_for_undefined', () => {
    assert.equal(formatRank(undefined), NO_DATA);
  });

  it('should_return_em_dash_for_NaN', () => {
    assert.equal(formatRank(NaN), NO_DATA);
  });

  it('should_truncate_fractional_input_to_integer_ordinal', () => {
    assert.equal(formatRank(4.9), '4th');
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

describe('lib/format/number — formatSignedInt', () => {
  it('should_render_positive_with_plus_prefix', () => {
    assert.equal(formatSignedInt(87), '+87');
  });

  it('should_render_negative_with_U_2212', () => {
    assert.equal(formatSignedInt(-12), '−12');
  });

  it('should_render_zero_as_bare_zero_no_sign', () => {
    // Point diff of exactly 0 is not really "directional"; treat as neutral.
    assert.equal(formatSignedInt(0), '0');
  });

  it('should_return_em_dash_for_null', () => {
    assert.equal(formatSignedInt(null), NO_DATA);
  });

  it('should_truncate_fractional_input', () => {
    assert.equal(formatSignedInt(3.7), '+3');
  });
});

describe('lib/format/number — NO_DATA sentinel', () => {
  it('should_be_the_real_em_dash_U_2014', () => {
    assert.equal(NO_DATA, '\u2014');
  });
});
