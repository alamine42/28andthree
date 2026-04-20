import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  categoryFor,
  playerHref,
  roleFor,
  type PlayerCategory,
  type PlayerRole,
} from '../../lib/format/player-routes';

// The POSITION_TO_ROLE / POSITION_TO_CATEGORY maps and their helpers are the
// single source of truth for how a nflverse position code drives the player
// hub card's chip bucket and destination route. Null-safety is a hard
// requirement — `players.position` is nullable in the schema. See
// `docs/plans/e7-players-hub-plan-adversarial-review.md` findings #4, #10, #13.

describe('lib/format/player-routes — roleFor', () => {
  it('should_map_QB_to_qb_role', () => {
    assert.equal(roleFor('QB'), 'qb');
  });

  it('should_map_RB_HB_FB_to_skill_role', () => {
    for (const p of ['RB', 'HB', 'FB']) {
      assert.equal(roleFor(p), 'skill', `expected ${p} → skill`);
    }
  });

  it('should_map_WR_TE_to_skill_role', () => {
    for (const p of ['WR', 'TE']) {
      assert.equal(roleFor(p), 'skill', `expected ${p} → skill`);
    }
  });

  it('should_map_all_offensive_line_codes_to_ol_role', () => {
    for (const p of ['C', 'G', 'OG', 'T', 'OT', 'OL']) {
      assert.equal(roleFor(p), 'ol', `expected ${p} → ol`);
    }
  });

  it('should_map_all_defensive_line_codes_to_dline_role', () => {
    for (const p of ['DT', 'DE', 'NT', 'DL']) {
      assert.equal(roleFor(p), 'dline', `expected ${p} → dline`);
    }
  });

  it('should_map_LB_and_DB_codes_to_defense_role', () => {
    for (const p of ['LB', 'ILB', 'OLB', 'MLB', 'CB', 'S', 'FS', 'SS', 'DB']) {
      assert.equal(roleFor(p), 'defense', `expected ${p} → defense`);
    }
  });

  it('should_map_K_P_LS_and_returners_to_special_role', () => {
    for (const p of ['K', 'P', 'LS', 'KR', 'PR', 'RS', 'ST']) {
      assert.equal(roleFor(p), 'special', `expected ${p} → special`);
    }
  });

  it('should_default_to_defense_for_unknown_position', () => {
    assert.equal(roleFor('XYZ'), 'defense');
  });

  it('should_be_case_insensitive', () => {
    assert.equal(roleFor('qb'), 'qb');
  });

  it('should_return_defense_for_null_position', () => {
    assert.equal(roleFor(null), 'defense');
  });

  it('should_return_defense_for_undefined_position', () => {
    assert.equal(roleFor(undefined), 'defense');
  });

  it('should_return_defense_for_empty_string', () => {
    assert.equal(roleFor(''), 'defense');
  });
});

describe('lib/format/player-routes — categoryFor', () => {
  it('should_map_QB_to_QB_chip', () => {
    assert.equal(categoryFor('QB'), 'QB');
  });

  it('should_map_RB_HB_FB_to_RB_chip', () => {
    for (const p of ['RB', 'HB', 'FB']) {
      assert.equal(categoryFor(p), 'RB', `expected ${p} → RB chip`);
    }
  });

  it('should_map_WR_and_TE_to_WR_plus_TE_chip', () => {
    for (const p of ['WR', 'TE']) {
      assert.equal(categoryFor(p), 'WR+TE', `expected ${p} → WR+TE chip`);
    }
  });

  it('should_map_all_OL_codes_to_OL_chip', () => {
    for (const p of ['C', 'G', 'OG', 'T', 'OT', 'OL']) {
      assert.equal(categoryFor(p), 'OL', `expected ${p} → OL chip`);
    }
  });

  it('should_map_DL_LB_DB_codes_to_DEF_chip', () => {
    for (const p of ['DT', 'DE', 'NT', 'DL', 'LB', 'CB', 'S', 'DB']) {
      assert.equal(categoryFor(p), 'DEF', `expected ${p} → DEF chip`);
    }
  });

  it('should_map_special_teams_codes_to_ST_chip', () => {
    for (const p of ['K', 'P', 'LS', 'KR', 'PR', 'RS', 'ST']) {
      assert.equal(categoryFor(p), 'ST', `expected ${p} → ST chip`);
    }
  });

  it('should_default_to_DEF_for_unknown_position', () => {
    assert.equal(categoryFor('XYZ'), 'DEF');
  });

  it('should_return_DEF_for_null_position', () => {
    assert.equal(categoryFor(null), 'DEF');
  });
});

describe('lib/format/player-routes — playerHref', () => {
  it('should_route_qb_role_to_qb_deep_dive', () => {
    const href = playerHref({ role: 'qb' satisfies PlayerRole, gsisId: '00-0039851' });
    assert.equal(href, '/players/qb/00-0039851');
  });

  it('should_route_skill_role_to_skill_deep_dive', () => {
    const href = playerHref({ role: 'skill', gsisId: '00-0033949' });
    assert.equal(href, '/players/skill/00-0033949');
  });

  it('should_route_ol_role_to_offensive_line_unit_page', () => {
    const href = playerHref({ role: 'ol', gsisId: '00-0000000' });
    assert.equal(href, '/team/units/offensive-line');
  });

  it('should_route_dline_role_to_defensive_line_unit_page', () => {
    const href = playerHref({ role: 'dline', gsisId: '00-0000000' });
    assert.equal(href, '/team/units/defensive-line');
  });

  it('should_route_defense_role_to_defense_unit_page', () => {
    const href = playerHref({ role: 'defense', gsisId: '00-0000000' });
    assert.equal(href, '/team/units/defense');
  });

  it('should_return_null_for_special_role_to_force_non_clickable_card', () => {
    // Special-teams has no unit page yet — card must render as a <div>, not
    // a broken <Link>. Review finding #7.
    const href = playerHref({ role: 'special', gsisId: '00-0000000' });
    assert.equal(href, null);
  });
});

describe('lib/format/player-routes — type exports', () => {
  it('should_export_the_six_PlayerRole_values', () => {
    const roles: PlayerRole[] = ['qb', 'skill', 'ol', 'dline', 'defense', 'special'];
    assert.equal(roles.length, 6);
  });

  it('should_export_the_six_PlayerCategory_values', () => {
    const categories: PlayerCategory[] = ['QB', 'RB', 'WR+TE', 'OL', 'DEF', 'ST'];
    assert.equal(categories.length, 6);
  });
});
