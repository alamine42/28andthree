import { rankTier } from '@/lib/color/rank';
import { formatEpa, formatRank } from '@/lib/format/number';
import type { SeasonPoint } from '@/lib/data/trends';
import {
  LEAGUE_SIZE,
  buildRankPath,
  plottedPoints,
  xFor,
  yForRank,
} from './season-rank-path';

type Props = {
  points: ReadonlyArray<SeasonPoint>;
  /** Phase name, for the accessible label. */
  phaseLabel: string;
};

// E12 headline chart: league rank per season on a fixed inverted 1..32
// axis. Server component, pure SVG — no client JS, so it survives an ISR
// cache HIT with nothing to hydrate (see the CSP/ISR gotcha doc).

const PLOT_WIDTH = 720;
const PLOT_HEIGHT = 300;
const MARGIN = { top: 24, right: 24, bottom: 40, left: 44 };
const GRID_RANKS = [1, 8, 16, 24, 32];

const DOT: Record<string, string> = {
  positive: 'fill-positive',
  neutral: 'fill-text-muted',
  negative: 'fill-negative',
};

export function SeasonRankChart({ points, phaseLabel }: Props) {
  const innerW = PLOT_WIDTH - MARGIN.left - MARGIN.right;
  const innerH = PLOT_HEIGHT - MARGIN.top - MARGIN.bottom;

  const ranks = points.map((p) => p.rank);
  const box = { width: innerW, height: innerH };
  const path = buildRankPath(ranks, box);
  const dots = plottedPoints(ranks, box);
  const published = points.filter((p) => p.rank != null);

  if (published.length === 0) {
    return (
      <div
        data-testid="season-rank-chart-empty"
        className="rounded-sm border border-dashed border-border p-6 font-mono text-2xs uppercase tracking-widest text-text-muted"
      >
        No season clears the sample floor yet.
      </div>
    );
  }

  const summary = published
    .map((p) => `${p.season}: ${formatRank(p.rank)}`)
    .join(', ');

  return (
    <figure className="flex flex-col gap-3" data-testid="season-rank-chart">
      <div className="overflow-x-auto">
      <svg
        role="img"
        aria-label={`${phaseLabel} league rank by season. ${summary}.`}
        viewBox={`0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`}
        className="w-full min-w-[560px]"
      >
        <title>{`${phaseLabel} rank by season`}</title>

        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {GRID_RANKS.map((r) => {
            const y = yForRank(r, innerH);
            return (
              <g key={r}>
                <line
                  x1={0}
                  x2={innerW}
                  y1={y}
                  y2={y}
                  className="stroke-border"
                  strokeWidth={1}
                />
                <text
                  x={-10}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-text-muted font-mono text-[10px] tabular-nums"
                >
                  {r}
                </text>
              </g>
            );
          })}

          {path ? (
            <path
              d={path}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-text-muted"
            />
          ) : null}

          {dots.map((d) => {
            const point = points[d.index]!;
            const tier = rankTier(d.rank);
            return (
              <g key={point.season}>
                <circle cx={d.x} cy={d.y} r={4} className={DOT[tier]} />
                <text
                  x={d.x}
                  y={d.y - 12}
                  textAnchor="middle"
                  className="fill-text font-mono text-[10px] tabular-nums"
                >
                  {formatRank(d.rank)}
                </text>
                <text
                  x={d.x}
                  y={d.y + 20}
                  textAnchor="middle"
                  className="fill-text-muted font-mono text-[10px] tabular-nums"
                >
                  {formatEpa(point.epaPerPlay)}
                </text>
              </g>
            );
          })}

          {/* Season axis. Unpublished seasons keep their slot and label so
              the gap is legible as "no data", not as a missing year. */}
          {points.map((p, i) => (
            <text
              key={p.season}
              x={xFor(i, points.length, innerW)}
              y={innerH + 26}
              textAnchor="middle"
              className={
                p.rank == null
                  ? 'fill-border-strong font-mono text-[10px] tabular-nums'
                  : 'fill-text-muted font-mono text-[10px] tabular-nums'
              }
            >
              {`’${String(p.season).slice(2)}`}
            </text>
          ))}
        </g>
      </svg>
      </div>

      <figcaption className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        Rank of {LEAGUE_SIZE} · EPA/play below each point
      </figcaption>
    </figure>
  );
}
