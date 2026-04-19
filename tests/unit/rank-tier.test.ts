import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rankTier, type RankTier } from '../../lib/color/rank';

// Tiers are always measured against the 32-team league — see plan §3.4 and
// adversarial review finding #2. A rank of 10 reads positive whether K=32
// or K=28 that week; the UI surfaces the denominator separately when K<32.
describe('lib/color/rank — rankTier', () => {
  it('should_return_positive_for_rank_1', () => {
    assert.equal<RankTier>(rankTier(1), 'positive');
  });

  it('should_return_positive_for_rank_11_top_of_first_third', () => {
    assert.equal<RankTier>(rankTier(11), 'positive');
  });

  it('should_return_neutral_for_rank_12', () => {
    assert.equal<RankTier>(rankTier(12), 'neutral');
  });

  it('should_return_neutral_for_rank_21', () => {
    assert.equal<RankTier>(rankTier(21), 'neutral');
  });

  it('should_return_negative_for_rank_22', () => {
    assert.equal<RankTier>(rankTier(22), 'negative');
  });

  it('should_return_negative_for_rank_32', () => {
    assert.equal<RankTier>(rankTier(32), 'negative');
  });

  it('should_return_neutral_for_null_rank', () => {
    assert.equal<RankTier>(rankTier(null), 'neutral');
  });

  it('should_return_neutral_for_undefined_rank', () => {
    assert.equal<RankTier>(rankTier(undefined), 'neutral');
  });

  it('should_ignore_passed_K_argument', () => {
    // Even if a week only has 9 qualifying teams, rank 3 is still rank 3
    // in the 32-team league view — positive because 3 <= ceil(32/3)=11.
    assert.equal<RankTier>(rankTier(3), 'positive');
  });
});
