import { SectionHead } from '../../_components/shared';
import { BShell, DataRail, PageHead, RailBlock, RailRow } from '../_shell';

// Screen 7 — trends. Included because it is the one screen whose chart is
// the content: it shows what the rail costs a full-width chart, and what
// the 1600px cap buys back.
const SEASONS = [
  { year: 2020, rank: 22, epa: -0.07 },
  { year: 2021, rank: 4, epa: 0.13 },
  { year: 2022, rank: 9, epa: 0.07 },
  { year: 2023, rank: 27, epa: -0.11 },
  { year: 2024, rank: 27, epa: -0.12 },
  { year: 2025, rank: 2, epa: 0.2 },
  { year: 2026, rank: 11, epa: 0.05 },
];

export default function BTrends() {
  const w = 1000;
  const h = 260;
  const x = (i: number) => 40 + (i * (w - 80)) / (SEASONS.length - 1);
  const y = (rank: number) => 20 + ((rank - 1) / 31) * (h - 60);

  return (
    <BShell active="Trends" screen="Trends" rail={<Rail />}>
      <PageHead
        eyebrow="Trends · 2020–2026"
        title="Twelve phases, season by season."
        lede="Each line is a league rank, not a raw number — league-wide EPA/play drifts between seasons."
      />

      <section className="mt-2">
        <SectionHead note="lower is better">Overall EPA differential</SectionHead>
        {/* Fluid viewBox, unlike the fixed 720px charts on the phase page.
            This is what the other charts need if B ships. */}
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-auto w-full"
          role="img"
          aria-label="Overall EPA differential rank by season, 2020 to 2026"
        >
          <title>Overall EPA differential rank by season</title>
          {[1, 8, 16, 24, 32].map((r) => (
            <g key={r}>
              <line
                x1={40}
                x2={w - 40}
                y1={y(r)}
                y2={y(r)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text x={8} y={y(r) + 4} className="fill-text-dim font-mono text-[11px]">
                {r}
              </text>
            </g>
          ))}
          <path
            d={SEASONS.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(s.rank)}`).join(' ')}
            fill="none"
            strokeWidth={1.5}
            className="stroke-chart-neutral"
          />
          {SEASONS.map((s, i) => (
            <g key={s.year}>
              <circle
                cx={x(i)}
                cy={y(s.rank)}
                r={4}
                className={
                  s.rank <= 11
                    ? 'fill-positive'
                    : s.rank >= 22
                      ? 'fill-negative'
                      : 'fill-chart-neutral'
                }
              />
              <text
                x={x(i)}
                y={y(s.rank) - 12}
                textAnchor="middle"
                className="fill-text font-mono text-[11px]"
              >
                {s.rank}
              </text>
              <text
                x={x(i)}
                y={h - 8}
                textAnchor="middle"
                className="fill-text-muted font-mono text-[11px]"
              >
                {s.year}
              </text>
            </g>
          ))}
        </svg>
      </section>
    </BShell>
  );
}

function Rail() {
  return (
    <>
      <RailBlock title="Seasons">
        <dl className="space-y-2">
          {SEASONS.slice()
            .reverse()
            .map((s) => (
              <RailRow key={s.year} label={String(s.year)} value={`${s.rank}`} />
            ))}
        </dl>
      </RailBlock>
      <DataRail />
    </>
  );
}
