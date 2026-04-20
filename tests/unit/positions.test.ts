import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSkillPosition,
  isValidPosition,
  PLAYER_POSITIONS,
  POSITION_DISPLAY_NAMES,
  SKILL_POSITIONS,
  type PlayerPosition,
} from '../../lib/constants/positions';

describe('lib/constants/positions — PLAYER_POSITIONS', () => {
  it('should_include_QB', () => {
    assert.ok(PLAYER_POSITIONS.includes('QB' as PlayerPosition));
  });

  it('should_include_all_three_skill_positions', () => {
    for (const p of ['WR', 'RB', 'TE'] as const) {
      assert.ok(PLAYER_POSITIONS.includes(p as PlayerPosition), `missing ${p}`);
    }
  });

  it('should_have_no_duplicate_entries', () => {
    const set = new Set(PLAYER_POSITIONS);
    assert.equal(set.size, PLAYER_POSITIONS.length);
  });
});

describe('lib/constants/positions — display names', () => {
  it('should_have_a_display_name_for_every_position', () => {
    for (const p of PLAYER_POSITIONS) {
      assert.ok(POSITION_DISPLAY_NAMES[p]?.length > 0, `${p} missing display name`);
    }
  });

  it('should_render_QB_as_Quarterback', () => {
    assert.equal(POSITION_DISPLAY_NAMES.QB, 'Quarterback');
  });

  it('should_render_WR_as_Wide_receiver', () => {
    assert.equal(POSITION_DISPLAY_NAMES.WR, 'Wide receiver');
  });
});

describe('lib/constants/positions — SKILL_POSITIONS', () => {
  it('should_include_exactly_WR_RB_TE', () => {
    assert.deepEqual([...SKILL_POSITIONS].sort(), ['RB', 'TE', 'WR']);
  });

  it('isSkillPosition_should_accept_WR', () => {
    assert.equal(isSkillPosition('WR'), true);
  });

  it('isSkillPosition_should_reject_QB', () => {
    assert.equal(isSkillPosition('QB'), false);
  });

  it('isSkillPosition_should_reject_unknown_string', () => {
    assert.equal(isSkillPosition('OG'), false);
  });
});

describe('lib/constants/positions — isValidPosition', () => {
  it('should_accept_known_position', () => {
    assert.equal(isValidPosition('QB'), true);
  });

  it('should_reject_unknown_position', () => {
    assert.equal(isValidPosition('XXX'), false);
  });

  it('should_reject_non_string', () => {
    assert.equal(isValidPosition(42), false);
  });

  it('should_reject_lowercase_variant', () => {
    // Positions are canonical uppercase.
    assert.equal(isValidPosition('qb'), false);
  });
});
