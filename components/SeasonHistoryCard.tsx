import Link from 'next/link';
import type { Route } from 'next';
import { rankTier } from '@/lib/color/rank';
import { phaseDisplayName } from '@/lib/format/phase';
import { formatEpa, formatRank, NO_DATA } from '@/lib/format/number';
import { RankNumber } from '@/components/numeric';
import type { PhaseSeasonSeries } from '@/lib/data/trends';
import {
  buildRankPath,
  plottedPoints,
  rankExtremes,
  yForRank,
} from '@/components/charts/season-rank-path';

type Props = { series: PhaseSeasonSeries };

// E12 small multiple: one phase's rank arc across every season, on the same
// fixed 1..32 axis as its eleven neighbours so the grid reads as one chart.
// Server component, pure SVG — the tile is a link, not a widget.

const W = 220;
const H = 64;

const STROKE: Record<string, string> = {
  positive: 'stroke-positive',
  neutral: 'stroke-text-muted',
  negative: 'stroke-negative',
};
const DOT: Record<string, string> = {
  positive: 'fill-positive',
  neutral: 'fill-text-muted',
  negative: 'fill-negative',
};

export function SeasonHistoryCard({ series }: Props) {
  const { phase, points } = series;
  const display = phaseDisplayName(phase);
  const ranks = points.map((p) => p.rank);
  const box = { width: W, height: H };

  const latest = [...points].reverse().find((p) => p.rank != null) ?? null;
  const { best, worst } = rankExtremes(ranks);
  // Colour the arc by where the phase stands now, matching the rank card
  // convention on the home page.
  const tier = rankTier(latest?.rank ?? null);
  const path = buildRankPath(ranks, box);
  const dots = plottedPoints(ranks, box);

  const summary =
    latest == null
      ? `${display}: no season clears the sample floor.`
      : `${display}: ${points
          .filter((p) => p.rank != null)
          .map((p) => `${p.season} ${formatRank(p.rank)}`)
          .join(', ')}.`;

  return (
    <Link
      href={`/phases/${phase}` as Route}
      data-testid="season-history-card"
      data-phase={phase}
      className="group flex flex-col gap-3 border border-border bg-surface p-4 transition-colors hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-positive"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          {display}
        </span>
        <RankNumber rank={latest?.rank ?? null} className="text-xl" />
      </div>

      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <title>{`${display} rank by season`}</title>
        <line
          x1={0}
          x2={W}
          y1={yForRank(16, H)}
          y2={yForRank(16, H)}
          strokeDasharray="2 3"
          vectorEffect="non-scaling-stroke"
          className="stroke-border"
        />
        {path ? (
          <path
            d={path}
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className={STROKE[tier]}
          />
        ) : null}
        {dots.map((d) => (
          <circle
            key={points[d.index]!.season}
            cx={d.x}
            cy={d.y}
            r={2}
            vectorEffect="non-scaling-stroke"
            className={DOT[tier]}
          />
        ))}
      </svg>

      <dl className="flex items-baseline justify-between gap-2 border-t border-border pt-2 font-mono text-2xs uppercase tracking-widest text-text-muted">
        <div className="flex gap-1.5">
          <dt>Best</dt>
          <dd className="tabular-nums text-text">{formatRank(best)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Worst</dt>
          <dd className="tabular-nums text-text">{formatRank(worst)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="sr-only">Latest EPA per play</dt>
          <dd className="tabular-nums text-text">
            {latest ? formatEpa(latest.epaPerPlay) : NO_DATA}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
