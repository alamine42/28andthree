import { buildSparklinePath } from './sparkline-path';
import type { RankTier } from '@/lib/color/rank';

type Props = {
  values: ReadonlyArray<number | null>;
  /** Directional color class. Controls stroke; see DESIGN.md §Color. */
  tier?: RankTier;
  /** Accessible title announced to screen readers. */
  title: string;
  width?: number;
  height?: number;
};

// Pure-SVG sparkline. 60×20 default (DESIGN.md card card density). Directional
// color keyed off RankTier so a positive trend renders amber and negative
// renders cranberry — consistent with the rank card it sits next to.
//
// Nulls in `values` produce gaps (path splits on missing points) so an
// insufficient-sample week doesn't fake a zero.
export function Sparkline({ values, tier = 'neutral', title, width = 60, height = 20 }: Props) {
  const d = buildSparklinePath(values, { width, height });
  const strokeClass = STROKE[tier];

  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <title>{title}</title>
      {d ? (
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={strokeClass}
        />
      ) : null}
    </svg>
  );
}

const STROKE: Record<RankTier, string> = {
  positive: 'text-positive',
  neutral: 'text-text-muted',
  negative: 'text-negative',
};
