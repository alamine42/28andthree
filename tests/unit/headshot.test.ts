import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { headshotAtWidth } from '../../lib/format/headshot';

// Every headshot must reach the browser resized by the NFL CDN. A URL shape we
// do not recognise passes through untouched — a wrong guess would break every
// avatar on the site, a missing width only costs bytes.
describe('lib/format/headshot — headshotAtWidth', () => {
  it('should_add_width_to_the_transformation_segment', () => {
    assert.equal(
      headshotAtWidth(
        'https://static.www.nfl.com/image/upload/f_auto,q_auto/league/srlewkb9utcfby1x0bhh',
        128,
      ),
      'https://static.www.nfl.com/image/upload/f_auto,q_auto,w_128/league/srlewkb9utcfby1x0bhh',
    );
  });

  it('should_keep_a_url_that_already_has_a_width', () => {
    const url = 'https://static.www.nfl.com/image/upload/f_auto,q_auto,w_64/league/abc';
    assert.equal(headshotAtWidth(url, 128), url);
  });

  it('should_keep_a_width_that_is_not_the_first_param', () => {
    const url = 'https://static.www.nfl.com/image/upload/w_200,f_auto/league/abc';
    assert.equal(headshotAtWidth(url, 128), url);
  });

  it('should_add_a_segment_when_there_are_no_transformations', () => {
    assert.equal(
      headshotAtWidth('https://static.www.nfl.com/image/upload/league/abc', 128),
      'https://static.www.nfl.com/image/upload/w_128/league/abc',
    );
  });

  it('should_add_width_to_a_private_delivery_url', () => {
    assert.equal(
      headshotAtWidth(
        'https://static.www.nfl.com/image/private/f_auto,q_auto/league/cvtae9fiee1vgzac4b2b',
        128,
      ),
      'https://static.www.nfl.com/image/private/f_auto,q_auto,w_128/league/cvtae9fiee1vgzac4b2b',
    );
  });

  it('should_keep_a_private_delivery_url_that_already_has_a_width', () => {
    const url = 'https://static.www.nfl.com/image/private/w_64,f_auto/league/abc';
    assert.equal(headshotAtWidth(url, 128), url);
  });

  it('should_pass_a_non_cloudinary_url_through_untouched', () => {
    const url = 'https://example.com/headshots/abc.png';
    assert.equal(headshotAtWidth(url, 128), url);
  });

  it('should_pass_an_upload_url_with_no_public_id_through_untouched', () => {
    const url = 'https://static.www.nfl.com/image/upload/abc';
    assert.equal(headshotAtWidth(url, 128), url);
  });

  it('should_round_a_fractional_width', () => {
    assert.equal(
      headshotAtWidth('https://static.www.nfl.com/image/upload/f_auto/league/abc', 112.4),
      'https://static.www.nfl.com/image/upload/f_auto,w_112/league/abc',
    );
  });

  it('should_clamp_a_zero_width_to_one_pixel', () => {
    assert.equal(
      headshotAtWidth('https://static.www.nfl.com/image/upload/f_auto/league/abc', 0),
      'https://static.www.nfl.com/image/upload/f_auto,w_1/league/abc',
    );
  });
});
