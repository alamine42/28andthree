import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { headshotAtWidth } from '../../lib/format/headshot';

const REAL = 'https://static.www.nfl.com/image/upload/f_auto,q_auto/league/srlewkb9utcfby1x0bhh';

// /players shipped ~58 MB of full-resolution headshots painted into 56px
// circles. The CDN resizes them if asked; the risk is asking wrongly and
// breaking every player image, so the pass-through cases matter most.
describe('lib/format/headshot — headshotAtWidth', () => {
  it('should_append_width_to_the_transformation_segment', () => {
    assert.equal(
      headshotAtWidth(REAL, 112),
      'https://static.www.nfl.com/image/upload/f_auto,q_auto,w_112/league/srlewkb9utcfby1x0bhh',
    );
  });

  it('should_round_a_fractional_width', () => {
    assert.match(headshotAtWidth(REAL, 112.4), /,w_112\//);
  });

  it('should_leave_a_url_that_already_carries_a_width', () => {
    const sized = 'https://static.www.nfl.com/image/upload/f_auto,w_128/league/abc';
    assert.equal(headshotAtWidth(sized, 112), sized);
  });

  it('should_not_mangle_a_url_with_no_transformation_segment', () => {
    // The guard that matters: inserting here would yield "league,w_112".
    const bare = 'https://static.www.nfl.com/image/upload/league/abc';
    assert.equal(headshotAtWidth(bare, 112), bare);
  });

  it('should_pass_through_a_non_cloudinary_url', () => {
    const other = 'https://example.com/headshots/abc.png';
    assert.equal(headshotAtWidth(other, 112), other);
  });

  it('should_pass_through_when_upload_is_the_last_segment', () => {
    const truncated = 'https://static.www.nfl.com/image/upload/';
    assert.equal(headshotAtWidth(truncated, 112), truncated);
  });

  it('should_pass_through_a_nonsense_width', () => {
    assert.equal(headshotAtWidth(REAL, 0), REAL);
    assert.equal(headshotAtWidth(REAL, -8), REAL);
    assert.equal(headshotAtWidth(REAL, Number.NaN), REAL);
  });
});
