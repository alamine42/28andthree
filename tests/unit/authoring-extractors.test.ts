import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNumericClaims,
  validatePlayerNames,
  type ExtractorContext,
  type NumericClaim,
} from '@/lib/authoring/extractors/types';

// L0-04 / L0-05: extractor contracts.
//
// The extractors themselves are integration code (read from Neon DAL).
// What's testable in unit-test land: the helper validators that ensure
// the extractor output is well-formed before it goes into the prompt.

describe('NumericClaim shape', () => {
  test('should_accept_a_valid_claim', () => {
    const claim: NumericClaim = {
      label: 'NE pass-O EPA/dropback',
      value: -0.12,
      rank: 24,
      unit: 'epa',
    };
    assert.equal(typeof claim.value, 'number');
  });

  test('validateNumericClaims_should_pass_for_well_formed_array', () => {
    const claims: NumericClaim[] = [
      { label: 'a', value: 1.0 },
      { label: 'b', value: -0.5, rank: 12 },
    ];
    assert.doesNotThrow(() => validateNumericClaims(claims));
  });

  test('validateNumericClaims_should_throw_on_NaN', () => {
    const claims: NumericClaim[] = [{ label: 'broken', value: Number.NaN }];
    assert.throws(() => validateNumericClaims(claims), /NaN/);
  });

  test('validateNumericClaims_should_throw_on_missing_label', () => {
    const claims = [{ label: '', value: 1.0 }] as NumericClaim[];
    assert.throws(() => validateNumericClaims(claims), /label/);
  });
});

describe('validatePlayerNames', () => {
  test('should_pass_for_valid_array', () => {
    assert.doesNotThrow(() => validatePlayerNames(['Drake Maye', 'Pop Douglas']));
  });

  test('should_throw_on_empty_string', () => {
    assert.throws(() => validatePlayerNames(['Drake Maye', '']), /empty/);
  });

  test('should_throw_on_non_string', () => {
    assert.throws(
      () => validatePlayerNames(['Drake Maye', 123 as unknown as string]),
      /string/,
    );
  });
});

describe('ExtractorContext shape', () => {
  test('should_carry_required_fields', () => {
    const ctx: ExtractorContext<{ foo: number }> = {
      contentType: 'opponent_preview',
      contextKey: '2025-w08-bills',
      data: { foo: 1 },
      numericClaims: [{ label: 'foo', value: 1 }],
      playerNames: ['Drake Maye'],
      generatedAt: new Date(),
    };
    assert.equal(ctx.contentType, 'opponent_preview');
    assert.equal(ctx.contextKey, '2025-w08-bills');
    assert.equal(ctx.data.foo, 1);
  });
});
