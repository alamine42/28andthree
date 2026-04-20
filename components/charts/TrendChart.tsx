'use client';

import { useState } from 'react';
import type { TrendPoint } from '@/lib/data/phases';
import { formatEpa } from '@/lib/format/number';
import { buildSparklinePath } from './sparkline-path';

type Props = {
  points: ReadonlyArray<TrendPoint>;
  phaseLabel: string;
};

type View = 'rolling' | 'raw';

const PLOT_WIDTH = 720;
const PLOT_HEIGHT = 320;
const MARGIN = { top: 16, right: 16, bottom: 32, left: 40 };

export function TrendChart({ points, phaseLabel }: Props) {
  const [view, setView] = useState<View>('rolling');

  if (points.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-text-muted">
        No weekly data yet.
      </div>
    );
  }

  const innerW = PLOT_WIDTH - MARGIN.left - MARGIN.right;
  const innerH = PLOT_HEIGHT - MARGIN.top - MARGIN.bottom;

  const weeks = points.map((p) => p.week);
  const minWeek = Math.min(...weeks);
  const maxWeek = Math.max(...weeks);

  // Build series. The rolling view uses precomputed rolling4 values so the
  // client does no math (review finding #8).
  const teamValues = points.map((p) => (view === 'rolling' ? p.rolling4 : p.raw));
  const leagueValues = points.map((p) => p.leagueMedian);

  const allValues = [...teamValues, ...leagueValues].filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  const yMin = allValues.length ? Math.min(...allValues) : -0.5;
  const yMax = allValues.length ? Math.max(...allValues) : 0.5;
  const yPad = Math.max(0.05, (yMax - yMin) * 0.1);

  const pathTeam = buildSparklinePath(teamValues, { width: innerW, height: innerH });
  const pathLeague = buildSparklinePath(leagueValues, { width: innerW, height: innerH });

  // Y-axis labels at 3 gridlines.
  const yTicks = [yMin - yPad, (yMin + yMax) / 2, yMax + yPad];

  return (
    <div className="flex flex-col gap-3" data-testid="trend-chart">
      <div className="flex justify-end">
        <div role="group" aria-label="View" className="flex gap-px rounded-sm border border-border bg-border p-px">
          <ToggleButton pressed={view === 'rolling'} onClick={() => setView('rolling')}>
            Rolling 4 wk
          </ToggleButton>
          <ToggleButton pressed={view === 'raw'} onClick={() => setView('raw')}>
            Raw
          </ToggleButton>
        </div>
      </div>

      <svg
        role="img"
        aria-label={`${phaseLabel} weekly trend, ${view === 'rolling' ? '4-week rolling' : 'raw weekly'}`}
        viewBox={`0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`}
        className="w-full"
      >
        <title>{phaseLabel} trend</title>

        {/* Y-axis gridlines + labels */}
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {yTicks.map((y, i) => {
            const yPos = innerH - ((y - (yMin - yPad)) / (yMax + yPad - (yMin - yPad))) * innerH;
            return (
              <g key={i}>
                <line
                  x1={0}
                  x2={innerW}
                  y1={yPos}
                  y2={yPos}
                  stroke="currentColor"
                  strokeWidth={0.5}
                  className="text-border"
                />
                <text
                  x={-6}
                  y={yPos}
                  dy="0.35em"
                  textAnchor="end"
                  className="fill-current font-mono text-[10px] text-text-dim"
                  data-numeric="true"
                >
                  {formatEpa(y)}
                </text>
              </g>
            );
          })}

          {/* League median line (muted) */}
          {pathLeague ? (
            <path
              d={pathLeague}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="3,3"
              className="text-chart-neutral"
            />
          ) : null}

          {/* Team line (amber) */}
          {pathTeam ? (
            <path
              d={pathTeam}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinejoin="round"
              className="text-positive"
            />
          ) : null}

          {/* X-axis week labels */}
          <g transform={`translate(0, ${innerH + 8})`}>
            {weeks.map((w, i) => {
              if (i % 2 !== 0 && weeks.length > 10) return null;
              const x = weeks.length === 1 ? innerW / 2 : (i / (weeks.length - 1)) * innerW;
              return (
                <text
                  key={w}
                  x={x}
                  y={10}
                  textAnchor="middle"
                  className="fill-current font-mono text-[10px] text-text-dim"
                >
                  W{w}
                </text>
              );
            })}
          </g>
        </g>
      </svg>

      <div className="flex gap-4 font-mono text-2xs uppercase tracking-widest text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-positive" aria-hidden />
          New England
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-chart-neutral" aria-hidden />
          League median
        </span>
      </div>

      <p className="font-mono text-2xs uppercase tracking-widest text-text-dim">
        Weeks {minWeek}–{maxWeek}
      </p>
    </div>
  );
}

function ToggleButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`bg-bg px-3 py-1.5 font-mono text-2xs uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive ${
        pressed ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}
