import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gradePick, type Grade } from '../../lib/logic/draft-grade';

// Grade = actual / expected value ratio thresholds (plan §1.5):
//   HIT     ratio ≥ 1.25
//   FAIR    0.75 ≤ ratio < 1.25
//   MISS    ratio < 0.75
//   PENDING rookie/sophomore year, ST position, or trade-out (gsisId null).

describe('lib/logic/draft-grade — gradePick', () => {
  it('should_return_HIT_when_actual_exceeds_expected_by_25_percent', () => {
    const g = gradePick({
      gsisId: '00-0039851',
      draftSeason: 2021,
      positionBucket: 'QB',
      actualValue: 150,
      expectedValue: 100,
      currentSeason: 2025,
    });
    assert.equal(g, 'HIT');
  });

  it('should_return_FAIR_when_ratio_between_0_75_and_1_25', () => {
    const g = gradePick({
      gsisId: '00-0039851',
      draftSeason: 2021,
      positionBucket: 'OFF_SKILL',
      actualValue: 100,
      expectedValue: 100,
      currentSeason: 2025,
    });
    assert.equal(g, 'FAIR');
  });

  it('should_return_MISS_when_actual_below_75_percent_of_expected', () => {
    const g = gradePick({
      gsisId: '00-0039851',
      draftSeason: 2021,
      positionBucket: 'OL',
      actualValue: 30,
      expectedValue: 100,
      currentSeason: 2025,
    });
    assert.equal(g, 'MISS');
  });

  it('should_return_PENDING_for_rookie_draft_class', () => {
    const g = gradePick({
      gsisId: '00-0039851',
      draftSeason: 2025,
      positionBucket: 'QB',
      actualValue: 0,
      expectedValue: 100,
      currentSeason: 2025,
    });
    assert.equal(g, 'PENDING');
  });

  it('should_return_PENDING_for_sophomore_draft_class', () => {
    const g = gradePick({
      gsisId: '00-0039851',
      draftSeason: 2024,
      positionBucket: 'QB',
      actualValue: 0,
      expectedValue: 100,
      currentSeason: 2025,
    });
    assert.equal(g, 'PENDING');
  });

  it('should_return_PENDING_for_ST_position_bucket_regardless_of_value', () => {
    const g = gradePick({
      gsisId: '00-0000001',
      draftSeason: 2021,
      positionBucket: 'ST',
      actualValue: 500,
      expectedValue: 100,
      currentSeason: 2025,
    });
    assert.equal(g, 'PENDING');
  });

  it('should_return_PENDING_for_trade_out_pick_with_null_gsisId', () => {
    const g = gradePick({
      gsisId: null,
      draftSeason: 2021,
      positionBucket: 'QB',
      actualValue: 0,
      expectedValue: 100,
      currentSeason: 2025,
    });
    assert.equal(g, 'PENDING');
  });

  it('should_return_MISS_when_actualValue_is_zero_and_expected_is_positive', () => {
    const g = gradePick({
      gsisId: '00-0000001',
      draftSeason: 2021,
      positionBucket: 'OFF_SKILL',
      actualValue: 0,
      expectedValue: 100,
      currentSeason: 2025,
    });
    assert.equal(g, 'MISS');
  });

  it('should_return_PENDING_when_expectedValue_is_null', () => {
    // Defensive: no EV curve for this slot (unknown position, fit gap, etc).
    // We don't invent a grade without a denominator.
    const g = gradePick({
      gsisId: '00-0039851',
      draftSeason: 2021,
      positionBucket: 'QB',
      actualValue: 100,
      expectedValue: null,
      currentSeason: 2025,
    });
    assert.equal(g, 'PENDING');
  });

  it('should_return_PENDING_when_expectedValue_is_zero', () => {
    // Avoid divide-by-zero and also avoid HIT-for-free.
    const g = gradePick({
      gsisId: '00-0039851',
      draftSeason: 2021,
      positionBucket: 'QB',
      actualValue: 100,
      expectedValue: 0,
      currentSeason: 2025,
    });
    assert.equal(g, 'PENDING');
  });

  it('should_return_PENDING_when_actualValue_is_null', () => {
    // Data not yet computed.
    const g = gradePick({
      gsisId: '00-0039851',
      draftSeason: 2021,
      positionBucket: 'QB',
      actualValue: null,
      expectedValue: 100,
      currentSeason: 2025,
    });
    assert.equal(g, 'PENDING');
  });

  it('should_treat_threshold_1_25_as_HIT_inclusive', () => {
    // Boundary: exactly 1.25× → HIT (≥ 1.25).
    const g = gradePick({
      gsisId: '00-0039851',
      draftSeason: 2021,
      positionBucket: 'QB',
      actualValue: 125,
      expectedValue: 100,
      currentSeason: 2025,
    });
    assert.equal(g, 'HIT');
  });

  it('should_treat_threshold_0_75_as_FAIR_inclusive', () => {
    // Boundary: exactly 0.75× → FAIR (ratio ≥ 0.75).
    const g = gradePick({
      gsisId: '00-0039851',
      draftSeason: 2021,
      positionBucket: 'QB',
      actualValue: 75,
      expectedValue: 100,
      currentSeason: 2025,
    });
    assert.equal(g, 'FAIR');
  });
});

describe('lib/logic/draft-grade — exported type shape', () => {
  it('should_allow_all_four_grade_values', () => {
    const grades: Grade[] = ['HIT', 'FAIR', 'MISS', 'PENDING'];
    assert.equal(grades.length, 4);
  });
});
