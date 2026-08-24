import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSeasonRouting } from '../../lib/season-view';

// E11-05: pure decision core for the middleware branch (plan §3.1, §3.3).
// rewrite = valid ?season= on a season-scoped public path → internal /s
// tree. redirect = external hit on the internal /s tree → public form.

describe('lib/season-view — resolveSeasonRouting', () => {
  it('should_rewrite_scoped_paths_with_a_valid_season_param', () => {
    assert.deepEqual(resolveSeasonRouting('/', '2023'), {
      kind: 'rewrite',
      pathname: '/s/2023',
    });
    assert.deepEqual(resolveSeasonRouting('/phases/pass_offense', '2021'), {
      kind: 'rewrite',
      pathname: '/s/2021/phases/pass_offense',
    });
    assert.deepEqual(resolveSeasonRouting('/players/qb/00-0039851', '2022'), {
      kind: 'rewrite',
      pathname: '/s/2022/players/qb/00-0039851',
    });
  });

  it('should_pass_through_invalid_or_missing_params', () => {
    assert.equal(resolveSeasonRouting('/', null), null);
    assert.equal(resolveSeasonRouting('/', '2023x'), null);
    assert.equal(resolveSeasonRouting('/coaching', 'abc'), null);
    assert.equal(resolveSeasonRouting('/', '1999'), null);
  });

  it('should_pass_through_season_agnostic_paths', () => {
    assert.equal(resolveSeasonRouting('/draft-roi', '2023'), null);
    assert.equal(resolveSeasonRouting('/status', '2023'), null);
    assert.equal(resolveSeasonRouting('/methodology', '2023'), null);
    assert.equal(resolveSeasonRouting('/admin', '2023'), null);
    assert.equal(resolveSeasonRouting('/api/authoring/cron-tick', '2023'), null);
  });

  it('should_redirect_external_hits_on_the_internal_tree_to_public_form', () => {
    assert.deepEqual(resolveSeasonRouting('/s/2023/coaching', null), {
      kind: 'redirect',
      pathname: '/coaching',
      search: '?season=2023',
    });
    assert.deepEqual(resolveSeasonRouting('/s/2023', null), {
      kind: 'redirect',
      pathname: '/',
      search: '?season=2023',
    });
    assert.deepEqual(
      resolveSeasonRouting('/s/2021/players/skill/00-0031234', null),
      {
        kind: 'redirect',
        pathname: '/players/skill/00-0031234',
        search: '?season=2021',
      },
    );
  });

  it('should_redirect_malformed_internal_hits_to_the_clean_path', () => {
    assert.deepEqual(resolveSeasonRouting('/s/abc/coaching', null), {
      kind: 'redirect',
      pathname: '/coaching',
      search: '',
    });
    assert.deepEqual(resolveSeasonRouting('/s/1999', null), {
      kind: 'redirect',
      pathname: '/',
      search: '',
    });
    assert.deepEqual(resolveSeasonRouting('/s', null), {
      kind: 'redirect',
      pathname: '/',
      search: '',
    });
  });
});
