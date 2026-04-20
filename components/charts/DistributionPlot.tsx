import { rankTier } from '@/lib/color/rank';
import { formatEpa } from '@/lib/format/number';
import type { DistributionRow } from '@/lib/data/phases';

type Props = {
  rows: ReadonlyArray<DistributionRow>;
  highlightTeam: string;
  phaseLabel: string;
};

const PLOT_WIDTH = 720;
const PLOT_HEIGHT = 120;
const MARGIN = { top: 16, right: 16, bottom: 40, left: 16 };

/** All 32 (or K qualifying) teams on a single x-axis of EPA per play. The
 * highlighted team renders enlarged + amber; the rest fade to muted.
 * Plain SVG — no chart library — keeps the bundle tight. */
export function DistributionPlot({ rows, highlightTeam, phaseLabel }: Props) {
  const qualifying = rows.filter((r) => !r.insufficientSample && r.epaPerPlay != null);
  if (qualifying.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-text-muted">
        Not enough data to render the distribution yet.
      </div>
    );
  }

  const innerW = PLOT_WIDTH - MARGIN.left - MARGIN.right;
  const values = qualifying.map((r) => r.epaPerPlay as number);
  const xMin = Math.min(...values);
  const xMax = Math.max(...values);
  const xPad = Math.max(0.02, (xMax - xMin) * 0.08);
  const xLo = xMin - xPad;
  const xHi = xMax + xPad;
  const xScale = (v: number) => ((v - xLo) / (xHi - xLo)) * innerW;

  const highlightRow = qualifying.find((r) => r.team === highlightTeam);

  return (
    <svg
      role="img"
      aria-label={`${phaseLabel} distribution across ${qualifying.length} teams`}
      viewBox={`0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`}
      className="w-full"
      data-testid="distribution-plot"
    >
      <title>{phaseLabel} — league distribution</title>

      <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
        {/* Horizontal axis */}
        <line
          x1={0}
          x2={innerW}
          y1={PLOT_HEIGHT - MARGIN.top - MARGIN.bottom}
          y2={PLOT_HEIGHT - MARGIN.top - MARGIN.bottom}
          stroke="currentColor"
          strokeWidth={0.5}
          className="text-border"
        />

        {/* Dots: muted team circles, then the highlighted one on top */}
        {qualifying.map((r) => {
          const isHighlight = r.team === highlightTeam;
          if (isHighlight) return null; // drawn last so it stacks above others
          return (
            <circle
              key={r.team}
              cx={xScale(r.epaPerPlay as number)}
              cy={(PLOT_HEIGHT - MARGIN.top - MARGIN.bottom) / 2}
              r={4}
              className="fill-current text-text-dim"
              data-team={r.team}
              data-tier={rankTier(r.rank)}
            >
              <title>
                {r.team} · rank {r.rank ?? '—'} · {formatEpa(r.epaPerPlay)}
              </title>
            </circle>
          );
        })}

        {highlightRow ? (
          <g>
            <circle
              cx={xScale(highlightRow.epaPerPlay as number)}
              cy={(PLOT_HEIGHT - MARGIN.top - MARGIN.bottom) / 2}
              r={7}
              className="fill-current text-positive"
              data-team={highlightRow.team}
              data-tier={rankTier(highlightRow.rank)}
            >
              <title>
                {highlightRow.team} · rank {highlightRow.rank ?? '—'} ·{' '}
                {formatEpa(highlightRow.epaPerPlay)}
              </title>
            </circle>
            <text
              x={xScale(highlightRow.epaPerPlay as number)}
              y={(PLOT_HEIGHT - MARGIN.top - MARGIN.bottom) / 2 - 14}
              textAnchor="middle"
              className="fill-current font-mono text-[10px] font-bold text-positive"
            >
              {highlightRow.team}
            </text>
          </g>
        ) : null}

        {/* Axis labels */}
        <text
          x={0}
          y={PLOT_HEIGHT - MARGIN.top - MARGIN.bottom + 18}
          className="fill-current font-mono text-[10px] text-text-dim"
          data-numeric="true"
        >
          {formatEpa(xLo)}
        </text>
        <text
          x={innerW}
          y={PLOT_HEIGHT - MARGIN.top - MARGIN.bottom + 18}
          textAnchor="end"
          className="fill-current font-mono text-[10px] text-text-dim"
          data-numeric="true"
        >
          {formatEpa(xHi)}
        </text>
        <text
          x={innerW / 2}
          y={PLOT_HEIGHT - MARGIN.top - MARGIN.bottom + 32}
          textAnchor="middle"
          className="fill-current font-mono text-2xs uppercase tracking-widest text-text-muted"
        >
          EPA per play
        </text>
      </g>
    </svg>
  );
}
