// Hand-rolled SVG scatter for the /coaching 4th-down chart.
// Intentionally minimal: Pats dots + optional reference line.

export type ScatterPoint = {
  x: number;
  y: number;
  label?: string;
  highlighted?: boolean;
};

export type ReferenceLinePoint = {
  x: number;
  y: number;
};

type Props = {
  data: ReadonlyArray<ScatterPoint>;
  referenceLine?: ReadonlyArray<ReferenceLinePoint>;
  xLabel: string;
  yLabel: string;
  title: string;
  height?: number;
};

export function ScatterPlot({
  data,
  referenceLine,
  xLabel,
  yLabel,
  title,
  height = 280,
}: Props) {
  const pad = { top: 20, right: 20, bottom: 40, left: 48 };
  const width = 640;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const xs = data.map((d) => d.x);
  const xMin = xs.length ? Math.min(...xs) : 0;
  const xMax = xs.length ? Math.max(...xs) : 1;
  // y axis fixed to [0, 1] — 4th-down "went for it" is a bernoulli outcome.
  const xTo = (v: number) =>
    pad.left + ((v - xMin) / Math.max(xMax - xMin, 1e-9)) * innerW;
  const yTo = (v: number) => pad.top + (1 - v) * innerH;

  return (
    <figure className="flex flex-col gap-2" data-testid="fourth-down-scatter">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={title}
        className="w-full"
      >
        <title>{title}</title>
        {/* Axes */}
        <line
          x1={pad.left}
          y1={yTo(0)}
          x2={pad.left + innerW}
          y2={yTo(0)}
          className="stroke-border"
          strokeWidth={1}
        />
        <line
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={pad.top + innerH}
          className="stroke-border"
          strokeWidth={1}
        />
        {/* Reference line (optional) */}
        {referenceLine && referenceLine.length > 1 ? (
          <polyline
            fill="none"
            className="stroke-text-muted"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            points={referenceLine.map((p) => `${xTo(p.x)},${yTo(p.y)}`).join(' ')}
          />
        ) : null}
        {/* Pats dots */}
        {data.map((p, i) => (
          <circle
            key={i}
            cx={xTo(p.x)}
            cy={yTo(p.y)}
            r={p.highlighted ? 5 : 4}
            className={p.highlighted ? 'fill-positive' : 'fill-text'}
          >
            {p.label ? <title>{p.label}</title> : null}
          </circle>
        ))}
        {/* Axis labels */}
        <text
          x={pad.left + innerW / 2}
          y={height - 6}
          textAnchor="middle"
          className="fill-text-muted font-mono text-[10px] uppercase tracking-widest"
        >
          {xLabel}
        </text>
        <text
          x={10}
          y={pad.top + innerH / 2}
          textAnchor="middle"
          transform={`rotate(-90, 10, ${pad.top + innerH / 2})`}
          className="fill-text-muted font-mono text-[10px] uppercase tracking-widest"
        >
          {yLabel}
        </text>
      </svg>
    </figure>
  );
}
