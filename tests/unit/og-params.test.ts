import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseOgParams } from '../../lib/og/params';

function parse(qs: string) {
  return parseOgParams(new URLSearchParams(qs));
}

describe('parseOgParams — defaults', () => {
  it('returns the brand default when no title is provided', () => {
    assert.equal(parse('').title, '28 and Three');
  });
  it('returns null for optional fields when absent', () => {
    const p = parse('');
    assert.equal(p.eyebrow, null);
    assert.equal(p.stat, null);
    assert.equal(p.rank, null);
  });
});

describe('parseOgParams — happy paths', () => {
  it('parses title + eyebrow + stat + rank for a phase page', () => {
    const p = parse('title=Pass+offense&eyebrow=PHASES&stat=%2B0.12+EPA%2Fplay&rank=04');
    assert.equal(p.title, 'Pass offense');
    assert.equal(p.eyebrow, 'PHASES');
    assert.equal(p.stat, '+0.12 EPA/play');
    assert.equal(p.rank, '04');
  });

  it('parses a QB page payload with unicode display name', () => {
    const p = parse('title=Drake+Maye&eyebrow=QB&stat=0.12+EPA%2Fdropback');
    assert.equal(p.title, 'Drake Maye');
    assert.equal(p.eyebrow, 'QB');
    assert.equal(p.stat, '0.12 EPA/dropback');
    assert.equal(p.rank, null);
  });

  it('parses a coaching page payload with only title + eyebrow', () => {
    const p = parse('title=Patriots+coaching&eyebrow=COACHING+TENDENCIES');
    assert.equal(p.title, 'Patriots coaching');
    assert.equal(p.eyebrow, 'COACHING TENDENCIES');
    assert.equal(p.stat, null);
    assert.equal(p.rank, null);
  });
});

describe('parseOgParams — edge cases', () => {
  it('trims whitespace-only values down to null', () => {
    const p = parse('title=%20%20&eyebrow=%20');
    assert.equal(p.title, '28 and Three');
    assert.equal(p.eyebrow, null);
  });

  it('clamps oversized title to 80 chars', () => {
    const long = 'x'.repeat(200);
    const p = parse(`title=${long}`);
    assert.equal(p.title.length, 80);
  });

  it('clamps rank to 4 chars so a bug passing "032" or longer stays readable', () => {
    const p = parse('rank=99999');
    assert.equal(p.rank, '9999');
  });

  it('preserves the U+2212 real minus sign in a negative stat', () => {
    const p = parse(`stat=${encodeURIComponent('\u22120.08 EPA/play')}`);
    assert.equal(p.stat, '\u22120.08 EPA/play');
  });
});
