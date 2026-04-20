import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidUnitSlug,
  UNIT_DISPLAY_NAMES,
  UNIT_SLUGS,
  type UnitSlug,
} from '../../lib/constants/units';

describe('lib/constants/units — UNIT_SLUGS', () => {
  it('should_include_defense', () => {
    assert.ok(UNIT_SLUGS.includes('defense' as UnitSlug));
  });

  it('should_include_offensive_line', () => {
    assert.ok(UNIT_SLUGS.includes('offensive-line' as UnitSlug));
  });

  it('should_include_defensive_line', () => {
    assert.ok(UNIT_SLUGS.includes('defensive-line' as UnitSlug));
  });

  it('should_have_exactly_three_entries', () => {
    assert.equal(UNIT_SLUGS.length, 3);
  });

  it('should_use_hyphen_for_url_readability_on_compound_names', () => {
    // URL paths favor hyphens (/team/units/offensive-line) over underscores
    // even though our DB phase_enum uses underscores — these are two
    // different audiences: DB vs URL.
    assert.ok(UNIT_SLUGS.includes('offensive-line' as UnitSlug));
    assert.ok(UNIT_SLUGS.includes('defensive-line' as UnitSlug));
  });
});

describe('lib/constants/units — display names', () => {
  it('should_have_display_name_for_every_slug', () => {
    for (const s of UNIT_SLUGS) {
      assert.ok(UNIT_DISPLAY_NAMES[s]?.length > 0, `${s} missing name`);
    }
  });

  it('should_render_offensive_line_slug_as_Offensive_line', () => {
    assert.equal(UNIT_DISPLAY_NAMES['offensive-line'], 'Offensive line');
  });
});

describe('lib/constants/units — isValidUnitSlug', () => {
  it('should_accept_defense', () => {
    assert.equal(isValidUnitSlug('defense'), true);
  });

  it('should_reject_unknown_slug', () => {
    assert.equal(isValidUnitSlug('special-teams'), false);
  });

  it('should_reject_underscore_variant', () => {
    // URL style is hyphen; underscore is DB-only.
    assert.equal(isValidUnitSlug('offensive_line'), false);
  });
});
