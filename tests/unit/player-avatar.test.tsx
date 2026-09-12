import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayerAvatar } from '../../components/PlayerAvatar';

const HEADSHOT =
  'https://static.www.nfl.com/image/upload/f_auto,q_auto/league/srlewkb9utcfby1x0bhh';

// The avatar renders `next/image` unoptimized, so the CDN width in the src is
// the only thing keeping /players from shipping ~1 MB per headshot.
describe('components/PlayerAvatar', () => {
  it('should_request_twice_the_rendered_box_from_the_cdn', () => {
    const html = renderToStaticMarkup(
      <PlayerAvatar displayName="Drake Maye" headshotUrl={HEADSHOT} size={64} />,
    );
    assert.match(html, /f_auto,q_auto,w_128\/league\/srlewkb9utcfby1x0bhh/);
  });

  it('should_scale_the_cdn_width_with_the_size_prop', () => {
    const html = renderToStaticMarkup(
      <PlayerAvatar displayName="Drake Maye" headshotUrl={HEADSHOT} size={80} />,
    );
    assert.match(html, /w_160\//);
  });

  it('should_keep_the_layout_box_at_the_requested_size', () => {
    const html = renderToStaticMarkup(
      <PlayerAvatar displayName="Drake Maye" headshotUrl={HEADSHOT} size={56} />,
    );
    assert.match(html, /width="56"/);
    assert.match(html, /height="56"/);
  });

  it('should_render_initials_when_there_is_no_headshot', () => {
    const html = renderToStaticMarkup(
      <PlayerAvatar displayName="Drake Maye" headshotUrl={null} size={64} />,
    );
    assert.match(html, />DM</);
  });
});
