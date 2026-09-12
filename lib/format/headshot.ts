// NFL headshot URLs are Cloudinary delivery URLs:
//   https://static.www.nfl.com/image/<type>/<transformations>/league/<id>
// Without a width the CDN serves the full source image — about 1 MB each for a
// 64px circle, and over 4 MB for the few that are stored as large PNGs. That
// was most of the weight on /players. Adding `w_<px>` to the transformation
// segment makes the NFL CDN resize for us, so we need no Vercel image
// optimization (and no extra hosting cost).

// Roster data carries both delivery types. `private` is rarer but behaves the
// same way for transformations — verified against the live CDN.
const UPLOAD_SEGMENTS = ['/image/upload/', '/image/private/'];

// A Cloudinary transformation segment is comma-separated `key_value` pairs
// (`f_auto,q_auto`). A path segment that does not match is part of the public
// id (`league/abc`), so we add our own segment instead of editing it.
const TRANSFORM_PARAM = /^[a-z]+_[^/,]+$/;

function isTransformSegment(segment: string): boolean {
  return segment.split(',').every((part) => TRANSFORM_PARAM.test(part));
}

function findUploadSegment(url: string): { index: number; length: number } | null {
  for (const segment of UPLOAD_SEGMENTS) {
    const index = url.indexOf(segment);
    if (index !== -1) return { index, length: segment.length };
  }
  return null;
}

/**
 * Ask the NFL CDN for a headshot at `width` device pixels.
 *
 * Returns the URL unchanged when it is not a Cloudinary delivery URL, or when
 * it already carries a width. An unrecognised shape passes through untouched
 * so a CDN change cannot break every avatar on the site.
 */
export function headshotAtWidth(url: string, width: number): string {
  const found = findUploadSegment(url);
  if (!found) return url;

  const prefixEnd = found.index + found.length;
  const prefix = url.slice(0, prefixEnd);
  const rest = url.slice(prefixEnd);
  const slashIndex = rest.indexOf('/');
  if (slashIndex === -1) return url;

  const widthParam = `w_${Math.max(1, Math.round(width))}`;
  const firstSegment = rest.slice(0, slashIndex);

  if (!isTransformSegment(firstSegment)) {
    return `${prefix}${widthParam}/${rest}`;
  }
  if (firstSegment.split(',').some((part) => part.startsWith('w_'))) {
    return url;
  }
  return `${prefix}${firstSegment},${widthParam}/${rest.slice(slashIndex + 1)}`;
}
