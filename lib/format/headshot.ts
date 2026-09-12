// NFL headshot URLs are Cloudinary delivery URLs:
//   https://static.www.nfl.com/image/upload/<transformations>/league/<id>
// Without a width the CDN serves the full source image — ~1 MB each for a
// 64px circle, which was most of the weight on /players. Adding `w_<px>` to
// the transformation segment makes the NFL CDN resize for us, so we need no
// Vercel image optimization (and no extra hosting cost).

const UPLOAD_SEGMENT = '/image/upload/';

// A Cloudinary transformation segment is comma-separated `key_value` pairs
// (`f_auto,q_auto`). A path segment that does not match is part of the public
// id (`league/abc`), so we add our own segment instead of editing it.
const TRANSFORM_PARAM = /^[a-z]+_[^/,]+$/;

function isTransformSegment(segment: string): boolean {
  const parts = segment.split(',');
  return parts.every((part) => TRANSFORM_PARAM.test(part));
}

/**
 * Ask the NFL CDN for a headshot at `width` device pixels.
 *
 * Returns the URL unchanged when it is not a Cloudinary `/image/upload/` URL,
 * or when it already carries a width. An unrecognised shape passes through
 * untouched so a CDN change cannot break every avatar on the site.
 */
export function headshotAtWidth(url: string, width: number): string {
  const uploadIndex = url.indexOf(UPLOAD_SEGMENT);
  if (uploadIndex === -1) return url;

  const prefixEnd = uploadIndex + UPLOAD_SEGMENT.length;
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
