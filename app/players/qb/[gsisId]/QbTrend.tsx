'use client';

import { useMemo, useState } from 'react';
import type { QbWeeklyPoint } from '@/lib/data/player';
import { buildSparklinePath } from '@/components/charts/sparkline-path';
import { formatEpa } from '@/lib/format/number';

type Props = {
  weekly: ReadonlyArray<QbWeeklyPoint>;
};

type View = 'primary' | 'all';

const PLOT_WIDTH = 720;
const PLOT_HEIGHT = 260;
const MARGIN = { top: 16, right: 16, bottom: 32, left: 44 };

/** QB weekly EPA/dropback trend with the SPEC §3.5a primary-starter toggle.
 * State + filtering + rendering all live in this client component so the
 * toggle actually changes the chart — no more dead UI. */
export function QbTrend({ weekly }: Props) {
  const [view, setView] = useState<View>('primary');

  const filtered = useMemo(
    () => (view === 'primary' ? weekly.filter((p) => p.primaryStarter) : weekly),
    [weekly, view],
  );

  if (filtered.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <Header view={view} setView={setView} />
        <p className="rounded-md border border-dashed border-border p-6 text-text-muted">
          No games match this filter.
        </p>
      </section>
    );
  }

  const innerW = PLOT_WIDTH - MARGIN.left - MARGIN.right;
  const innerH = PLOT_HEIGHT - MARGIN.top - MARGIN.bottom;
  const values = filtered.map((p) => p.epaPerDropback);
  const weeks = filtered.map((p) => p.week);
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
  const yMin = finite.length ? Math.min(...finite) : -0.5;
  const yMax = finite.length ? Math.max(...finite) : 0.5;
  const yPad = Math.max(0.05, (yMax - yMin) * 0.1);
  const path = buildSparklinePath(values, { width: innerW, height: innerH });

  return (
    <section className="flex flex-col gap-3" data-testid="qb-trend">
      <Header view={view} setView={setView} />
      <svg
        role="img"
        aria-label="QB weekly EPA per dropback"
        viewBox={`0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`}
        className="w-full"
      >
        <title>Weekly EPA per dropback</title>
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {/* Axis labels (min/mid/max) */}
          {[yMin - yPad, (yMin + yMax) / 2, yMax + yPad].map((y) => {
            const yPos =
              innerH - ((y - (yMin - yPad)) / (yMax + yPad - (yMin - yPad))) * innerH;
            return (
              <g key={y.toFixed(3)}>
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
                  className="fill-current font-mono text-[10px] text-text-muted"
                  data-numeric="true"
                >
                  {formatEpa(y)}
                </text>
              </g>
            );
          })}
          {path ? (
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinejoin="round"
              className="text-positive"
            />
          ) : null}
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
                  className="fill-current font-mono text-[10px] text-text-muted"
                >
                  W{w}
                </text>
              );
            })}
          </g>
        </g>
      </svg>
      <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        {filtered.length} {view === 'primary' ? 'primary-starter ' : ''}games
      </p>
    </section>
  );
}

function Header({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        Weekly EPA / dropback
      </h2>
      <div
        role="group"
        aria-label="View"
        className="flex gap-px rounded-sm border border-border bg-border p-px"
      >
        <ToggleButton pressed={view === 'primary'} onClick={() => setView('primary')}>
          Primary starter
        </ToggleButton>
        <ToggleButton pressed={view === 'all'} onClick={() => setView('all')}>
          All games
        </ToggleButton>
      </div>
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
