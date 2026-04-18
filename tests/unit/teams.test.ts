import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NFL_TEAMS, isValidTeam, normalizeTeamAbbr } from '../../lib/constants/teams';

describe('lib/constants/teams', () => {
  it('should_export_exactly_32_NFL_team_abbreviations', () => {
    assert.equal(NFL_TEAMS.length, 32);
  });

  it('should_have_no_duplicate_team_abbreviations', () => {
    const set = new Set(NFL_TEAMS);
    assert.equal(set.size, NFL_TEAMS.length);
  });

  it('should_include_all_eight_divisional_Patriots_conference_teams', () => {
    const afcEast = ['NE', 'BUF', 'MIA', 'NYJ'];
    for (const team of afcEast) {
      assert.ok(NFL_TEAMS.includes(team as (typeof NFL_TEAMS)[number]), `missing ${team}`);
    }
  });

  it('should_use_LV_not_OAK_for_Las_Vegas', () => {
    const teams = NFL_TEAMS as readonly string[];
    assert.ok(teams.includes('LV'));
    assert.ok(!teams.includes('OAK'));
  });

  it('should_use_LAC_LAR_not_SD_STL', () => {
    const teams = NFL_TEAMS as readonly string[];
    assert.ok(teams.includes('LAC'));
    assert.ok(teams.includes('LAR'));
    assert.ok(!teams.includes('SD'));
    assert.ok(!teams.includes('STL'));
  });

  it('isValidTeam_should_accept_NE', () => {
    assert.equal(isValidTeam('NE'), true);
  });

  it('isValidTeam_should_reject_unknown', () => {
    assert.equal(isValidTeam('XYZ'), false);
  });

  it('normalizeTeamAbbr_should_map_WSH_to_WAS', () => {
    assert.equal(normalizeTeamAbbr('WSH'), 'WAS');
  });

  it('normalizeTeamAbbr_should_pass_through_canonical_abbrs_unchanged', () => {
    assert.equal(normalizeTeamAbbr('NE'), 'NE');
    assert.equal(normalizeTeamAbbr('LV'), 'LV');
  });

  it('normalizeTeamAbbr_should_return_null_on_empty_input', () => {
    assert.equal(normalizeTeamAbbr(''), null);
    assert.equal(normalizeTeamAbbr(null), null);
    assert.equal(normalizeTeamAbbr(undefined), null);
  });

  it('normalizeTeamAbbr_should_return_input_unchanged_when_unrecognized', () => {
    // Preserve unknown values so contract tests can flag them — better than silently remapping.
    assert.equal(normalizeTeamAbbr('XYZ'), 'XYZ');
  });
});
