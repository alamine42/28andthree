import { rankTier } from '@/lib/color/rank';
import { formatDelta, formatRank } from '@/lib/format/number';

// Every rendered metric flows through one of these three wrappers. They
// always emit `data-numeric="true"` so the bad-number crawler can
// exhaustively find metric elements without per-call attribute plumbing
// that's easy to forget. Adversarial-review finding #10.

type Fmt<T> = (value: T | null | undefined) => string;

type RankNumberProps = {
  rank: number | null | undefined;
  /** Optional override class (size, weight, tracking). */
  className?: string;
};

const TIER_CLASS = {
  positive: 'text-positive',
  neutral: 'text-text',
  negative: 'text-negative',
} as const;

/** Large numeric rank (two-digit padded). Colored by `rankTier()`. */
export function RankNumber({ rank, className }: RankNumberProps) {
  const tier = rankTier(rank);
  return (
    <span
      data-numeric="true"
      data-tier={tier}
      className={`font-display font-bold tabular-nums ${TIER_CLASS[tier]} ${className ?? ''}`.trim()}
    >
      {formatRank(rank)}
    </span>
  );
}

type MetricValueProps<T> = {
  value: T | null | undefined;
  format: Fmt<T>;
  className?: string;
};

/** Generic numeric renderer (EPA, percent, raw numbers). Caller picks the formatter. */
export function MetricValue<T>({ value, format, className }: MetricValueProps<T>) {
  return (
    <span
      data-numeric="true"
      className={`font-mono tabular-nums ${className ?? ''}`.trim()}
    >
      {format(value)}
    </span>
  );
}

type DeltaProps = {
  value: number | null | undefined;
  className?: string;
};

/** Delta (rank change, EPA change) with directional glyph + signed number.
 * Per DESIGN.md + review finding #11 the glyph carries the semantic color;
 * the number uses --text so contrast stays WCAG AA compliant. */
export function Delta({ value, className }: DeltaProps) {
  const text = formatDelta(value);
  if (!text) {
    return <span data-numeric="true" />;
  }
  const [glyph, ...rest] = text;
  const glyphClass =
    glyph === '▲' ? 'text-positive' :
    glyph === '▼' ? 'text-negative' :
    'text-text-muted';
  return (
    <span data-numeric="true" className={`font-mono tabular-nums ${className ?? ''}`.trim()}>
      <span aria-hidden="true" className={glyphClass}>{glyph}</span>
      <span className="text-text">{rest.join('')}</span>
    </span>
  );
}
