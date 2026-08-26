// E12: pure geometry for the season-by-season rank charts. Separate from
// the components so it unit-tests without JSX, matching sparkline-path.ts.
//
// Why rank and not EPA: league-wide EPA/play drifts season to season, so a
// raw-EPA line across seven seasons compares against a moving baseline.
// Rank is normalised by construction — 4th in 2021 means the same thing as
// 4th in 2026. EPA rides along as the point label. See SPEC §3.5 ("league
// context is always adjacent").

export const LEAGUE_SIZE = 32;

export type PlotBox = { width: number; height: number };

/** X for season index i across n seasons. Single point sits centred. */
export function xFor(index: number, count: number, width: number): number {
  if (count <= 1) return width / 2;
  return (index / (count - 1)) * width;
}

/** Y for a league rank on a fixed, inverted 1..LEAGUE_SIZE domain: rank 1
 * pins to the top of the box, rank 32 to the bottom. Fixed — never scaled
 * to the data — so every one of the 12 small multiples shares an axis and
 * the grid reads as one chart. */
export function yForRank(rank: number, height: number): number {
  const clamped = Math.min(Math.max(rank, 1), LEAGUE_SIZE);
  return ((clamped - 1) / (LEAGUE_SIZE - 1)) * height;
}

/** Build one or more `M...L` segments from a rank series. Nulls break the
 * path rather than interpolating, so an unpublished season reads as a gap
 * instead of inventing a straight line through it. */
export function buildRankPath(
  ranks: ReadonlyArray<number | null>,
  { width, height }: PlotBox,
): string {
  const segments: string[] = [];
  let current: string[] = [];

  ranks.forEach((rank, i) => {
    if (rank == null || !Number.isFinite(rank)) {
      if (current.length > 1) segments.push(current.join(' '));
      current = [];
      return;
    }
    const x = xFor(i, ranks.length, width).toFixed(2);
    const y = yForRank(rank, height).toFixed(2);
    current.push(`${current.length === 0 ? 'M' : 'L'}${x},${y}`);
  });
  if (current.length > 1) segments.push(current.join(' '));

  return segments.join(' ');
}

/** Points that should get a dot. A lone published season between two gaps
 * draws no line, so without dots it would vanish from the chart. */
export function plottedPoints(
  ranks: ReadonlyArray<number | null>,
  box: PlotBox,
): Array<{ index: number; rank: number; x: number; y: number }> {
  const out: Array<{ index: number; rank: number; x: number; y: number }> = [];
  ranks.forEach((rank, i) => {
    if (rank == null || !Number.isFinite(rank)) return;
    out.push({
      index: i,
      rank,
      x: xFor(i, ranks.length, box.width),
      y: yForRank(rank, box.height),
    });
  });
  return out;
}

/** Best (lowest) and worst (highest) published rank in a series. */
export function rankExtremes(
  ranks: ReadonlyArray<number | null>,
): { best: number | null; worst: number | null } {
  const published = ranks.filter((r): r is number => r != null && Number.isFinite(r));
  if (published.length === 0) return { best: null, worst: null };
  return { best: Math.min(...published), worst: Math.max(...published) };
}
