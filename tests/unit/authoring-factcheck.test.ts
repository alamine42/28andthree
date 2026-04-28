import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { factcheck } from '@/lib/authoring/factcheck';
import type { ExtractorContext, NumericClaim } from '@/lib/authoring/extractors/types';

function ctx(claims: NumericClaim[], names: string[]): ExtractorContext<unknown> {
  return {
    contentType: 'opponent_preview',
    contextKey: 'test',
    data: {},
    numericClaims: claims,
    playerNames: names,
    generatedAt: new Date(),
  };
}

describe('factcheck — numeric drift', () => {
  test('should_pass_when_every_numeric_in_source', () => {
    const md = 'NE EPA/dropback is −0.12 (24th).';
    const result = factcheck(md, ctx([{ label: 'a', value: -0.12 }, { label: 'rank', value: 24 }], []));
    assert.equal(result.status, 'pass');
  });

  test('should_pass_when_numeric_within_rounding_tolerance', () => {
    // Source has 0.123, output rounds to 0.12 — within 0.005 tolerance
    const md = 'EPA was 0.12.';
    const result = factcheck(md, ctx([{ label: 'a', value: 0.123 }], []));
    assert.equal(result.status, 'pass');
  });

  test('should_fail_when_numeric_not_in_source', () => {
    const md = 'EPA was 0.99 (a fabricated stat).';
    const result = factcheck(md, ctx([{ label: 'a', value: 0.12 }], []));
    assert.equal(result.status, 'fail');
    const drift = result.findings.find((f) => f.type === 'numeric_drift');
    assert.notEqual(drift, undefined);
    assert.equal(drift?.token, '0.99');
  });

  test('should_normalize_real_minus_sign_to_ascii', () => {
    // U+2212 in markdown should match ASCII negative in source
    const md = 'EPA was −0.31 last week.';
    const result = factcheck(md, ctx([{ label: 'a', value: -0.31 }], []));
    assert.equal(result.status, 'pass');
  });

  test('should_pass_for_percent_signs', () => {
    const md = 'pressure-to-sack rate of 12.4%.';
    const result = factcheck(md, ctx([{ label: 'a', value: 12.4 }], []));
    assert.equal(result.status, 'pass');
  });
});

describe('factcheck — player names', () => {
  test('should_pass_when_player_in_roster_context', () => {
    const md = 'Drake Maye threw the ball.';
    const result = factcheck(md, ctx([], ['Drake Maye']));
    assert.equal(result.status, 'pass');
  });

  test('should_pass_for_team_names_via_allowlist', () => {
    // Bills, Buffalo, AFC must NOT trigger player_unknown
    const md = 'The Bills are the AFC East rival hosted in Buffalo.';
    const result = factcheck(md, ctx([], []));
    assert.equal(result.status, 'pass', JSON.stringify(result.findings));
  });

  test('should_pass_for_all_32_NFL_team_names', () => {
    const md =
      'Patriots Bills Dolphins Jets Ravens Bengals Browns Steelers Texans ' +
      'Colts Jaguars Titans Broncos Chiefs Raiders Chargers Cowboys Giants ' +
      'Eagles Commanders Bears Lions Packers Vikings Falcons Panthers Saints ' +
      'Buccaneers Cardinals Rams Niners Seahawks';
    const result = factcheck(md, ctx([], []));
    assert.equal(result.status, 'pass', JSON.stringify(result.findings));
  });

  test('should_pass_for_common_football_nouns', () => {
    const md = 'Pro Bowl Hall of Fame Super Bowl Senior Bowl Combine.';
    const result = factcheck(md, ctx([], []));
    assert.equal(result.status, 'pass', JSON.stringify(result.findings));
  });

  test('should_fail_when_player_name_not_in_roster_or_allowlist', () => {
    const md = 'Jorge Velasquez had a great game for New England.';
    const result = factcheck(md, ctx([], ['Drake Maye']));
    assert.equal(result.status, 'fail');
    const fab = result.findings.find((f) => f.type === 'player_unknown');
    assert.equal(fab?.token, 'Jorge Velasquez');
  });

  test('should_NOT_flag_single_capitalized_words', () => {
    // "Buffalo" alone is a single word — wouldn't match FirstName-LastName pattern.
    // Number 4 must be in source (this test isolates the single-word rule).
    const md = 'Buffalo runs a 4 base defense.';
    const result = factcheck(md, ctx([{ label: 'a', value: 4 }], []));
    assert.equal(result.status, 'pass');
  });
});

describe('factcheck — both flavors mixed', () => {
  test('should_aggregate_findings', () => {
    const md = 'Jorge Velasquez had 12.5 yards (Drake Maye and Buffalo on hand).';
    // 12.5 not in source; Jorge Velasquez not in any allowlist
    const result = factcheck(md, ctx([{ label: 'a', value: 11.0 }], ['Drake Maye']));
    assert.equal(result.status, 'fail');
    assert.ok(result.findings.length >= 2);
  });
});
