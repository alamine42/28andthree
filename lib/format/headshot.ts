// Headshot URLs come from nflreadpy roster data and point at the NFL's
// Cloudinary delivery host, shaped:
//
//     https://static.www.nfl.com/image/upload/f_auto,q_auto/league/<id>
//                                             ^^^^^^^^^^^^^ transformations
//
// Those images are ~1 MB each at source resolution and we paint them into
// 56-80px circles, so /players shipped ~58 MB of discarded pixels. Adding a
// width to the transformation segment makes the CDN do the resizing, which
// keeps this off Vercel's image optimizer (and its billing) entirely.

const UPLOAD_MARKER = '/image/upload/';

// A transformation segment is a comma-separated list of `key_value` pairs
// ("f_auto,q_auto"). A public id is not. Requiring the leading `key_` is what
// keeps us from mangling a URL that carries no transformations at all —
// inserting into "league" would produce "league,w_112" and a broken image.
const LOOKS_LIKE_TRANSFORMS = /^[a-z]+_[^/]*$/;
const ALREADY_SIZED = /(?:^|,)w_\d+(?:,|$)/;

/** Ask the CDN for a headshot at `width` px. Returns the URL untouched for
 * anything that isn't a recognisably transformable Cloudinary URL — a stale
 * image is a far better failure than a broken one. */
export function headshotAtWidth(url: string, width: number): string {
  if (!Number.isFinite(width) || width <= 0) return url;

  const marker = url.indexOf(UPLOAD_MARKER);
  if (marker === -1) return url;

  const start = marker + UPLOAD_MARKER.length;
  const end = url.indexOf('/', start);
  if (end === -1) return url;

  const transforms = url.slice(start, end);
  if (!LOOKS_LIKE_TRANSFORMS.test(transforms)) return url;
  if (ALREADY_SIZED.test(transforms)) return url;

  return `${url.slice(0, start)}${transforms},w_${Math.round(width)}${url.slice(end)}`;
}
