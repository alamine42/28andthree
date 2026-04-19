import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES } from '../../lib/constants/phases';
import {
  phaseDisplayName,
  PHASE_DISPLAY_NAMES,
} from '../../lib/format/phase';

describe('lib/format/phase — display names', () => {
  it('should_have_a_display_name_for_every_phase_slug', () => {
    for (const p of PHASES) {
      const name = PHASE_DISPLAY_NAMES[p];
      assert.ok(typeof name === 'string' && name.length > 0, `${p} missing name`);
    }
  });

  it('should_not_introduce_display_names_for_unknown_slugs', () => {
    const extra = Object.keys(PHASE_DISPLAY_NAMES).filter(
      (k) => !(PHASES as readonly string[]).includes(k),
    );
    assert.deepEqual(extra, []);
  });

  it('should_use_title_case_with_spaces_for_pass_offense', () => {
    assert.equal(PHASE_DISPLAY_NAMES.pass_offense, 'Pass offense');
  });

  it('should_use_third_down_offense_with_3rd_abbreviation', () => {
    // Terse per DESIGN.md content conventions.
    assert.equal(PHASE_DISPLAY_NAMES.third_down_offense, '3rd down offense');
  });
});

describe('lib/format/phase — phaseDisplayName()', () => {
  it('should_resolve_known_slug_to_display_name', () => {
    assert.equal(phaseDisplayName('pass_offense'), 'Pass offense');
  });

  it('should_return_the_slug_unchanged_for_unknown_input', () => {
    // Defensive: unknown slugs pass through so a missing PHASES entry is
    // obvious in the UI rather than silently disappearing.
    assert.equal(phaseDisplayName('nonsense' as never), 'nonsense');
  });
});
