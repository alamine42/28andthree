// Pure SVG-path builder for sparklines. Kept separate from the React
// component so it can be unit-tested without JSX rendering. The only knob
// is the viewBox (width × height); values are scaled linearly to that box.
//
// Nulls in the input produce gaps: the path breaks into multiple M...L
// segments rather than interpolating across the missing point.

export type SparklineDimensions = {
  width: number;
  height: number;
};

type Point = { x: number; y: number };

/**
 * Build an SVG `path` `d` attribute string from a series of values.
 *
 * Y-axis is inverted (SVG convention): max value → y=0 (top), min → y=height.
 * When min === max (identical series), draws a horizontal centerline.
 */
export function buildSparklinePath(
  values: ReadonlyArray<number | null>,
  { width, height }: SparklineDimensions,
): string {
  if (values.length === 0) return '';

  const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (finite.length === 0) return '';

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1; // avoid div-by-zero on constant series
  const xStep = values.length === 1 ? 0 : width / (values.length - 1);

  const yFor = (v: number): number => {
    // Constant series: centerline.
    if (max === min) return height / 2;
    return height - ((v - min) / span) * height;
  };

  // Walk values and accumulate segments. A null breaks the current segment.
  const segments: Point[][] = [];
  let current: Point[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      continue;
    }
    current.push({ x: i * xStep, y: yFor(v) });
  }
  if (current.length > 0) segments.push(current);

  return segments
    .map((seg) => {
      if (seg.length === 0) return '';
      const [head, ...rest] = seg;
      const start = `M${fmt(head.x)},${fmt(head.y)}`;
      const lines = rest.map((p) => `L${fmt(p.x)},${fmt(p.y)}`).join('');
      return start + lines;
    })
    .join(' ')
    .trim();
}

function fmt(n: number): string {
  // Avoid trailing zeros + use integer form when possible. Keeps the path
  // string compact (matters over 12 sparklines × N points on home page).
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}
