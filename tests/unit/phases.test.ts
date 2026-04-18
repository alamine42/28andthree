import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASES,
  PHASE_GROUPS,
  isValidPhase,
  type Phase,
} from '../../lib/constants/phases';

describe('lib/constants/phases', () => {
  it('should_export_exactly_12_phases', () => {
    assert.equal(PHASES.length, 12);
  });

  it('should_list_phases_in_SPEC_3_2_order', () => {
    assert.deepEqual(
      [...PHASES],
      [
        'pass_offense',
        'rush_offense',
        'overall_offense',
        'pass_defense',
        'run_defense',
        'redzone_offense',
        'redzone_defense',
        'third_down_offense',
        'third_down_defense',
        'explosive_offense',
        'explosive_defense',
        'special_teams',
      ],
    );
  });

  it('should_have_no_duplicate_phase_slugs', () => {
    const set = new Set(PHASES);
    assert.equal(set.size, PHASES.length);
  });

  it('should_group_every_phase_into_exactly_one_group', () => {
    const grouped = new Set<Phase>();
    for (const phases of Object.values(PHASE_GROUPS)) {
      for (const p of phases) {
        assert.ok(!grouped.has(p), `phase ${p} appears in more than one group`);
        grouped.add(p);
      }
    }
    assert.equal(grouped.size, PHASES.length);
  });

  it('isValidPhase_should_accept_known_slug', () => {
    assert.equal(isValidPhase('pass_offense'), true);
  });

  it('isValidPhase_should_reject_unknown_slug', () => {
    assert.equal(isValidPhase('nonsense_phase'), false);
  });

  it('isValidPhase_should_reject_empty_string', () => {
    assert.equal(isValidPhase(''), false);
  });

  it('isValidPhase_should_be_case_sensitive', () => {
    assert.equal(isValidPhase('Pass_Offense'), false);
  });
});
