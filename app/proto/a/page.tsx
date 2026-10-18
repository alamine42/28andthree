import { rankTier } from '@/lib/color/rank';
import { formatEpa } from '@/lib/format/number';
import { phaseDisplayName } from '@/lib/format/phase';
import { Sparkline } from '@/components/charts/Sparkline';
import { MetricValue } from '@/components/numeric';
import { NAV, SEASON, phases } from '@/lib/proto/data';
import {
  ContextStats,
  Eyebrow,
  LeagueTable,
  ProtoBanner,
  RankCell,
  ResultsList,
  SectionHead,
} from '../_components/shared';

// Direction A — terminal shell.
//
// Left rail holds navigation and never scrolls away. A sticky context bar
// carries the team state (rank, record, EPA, week) across every screen, so a
// drill-down into a phase or a player no longer drops the season context.
// Content fills the viewport: no 1240px cap, three panel columns at ≥1280.
export default function DirectionA() {
  return (
    <div className="flex min-h-screen flex-col">
      <ProtoBanner variant="A · Terminal shell" />
      <div className="flex flex-1">
        <Rail />
        <div className="flex min-w-0 flex-1 flex-col">
          <ContextBar />
          <div className="grid flex-1 gap-px bg-border xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="bg-bg p-5">
              <SectionHead note="EPA per play · season to date">
                League rank across phases
              </SectionHead>
              {/* Two columns, not three: at three the phase name had no room
                  left and truncated to nothing. The trailing filler keeps the
                  gap-px border grid from showing an empty lit cell on the odd
                  eleventh phase — the same orphan tile the live home page has. */}
              <div className="grid gap-px bg-border md:grid-cols-2">
                {phases.map((p) => (
                  <PhaseRow
                    key={p.phase}
                    phase={p.phase}
                    rank={p.rank}
                    epa={p.epa}
                    spark={p.spark}
                  />
                ))}
                <div className="hidden bg-bg md:block" aria-hidden="true" />
              </div>

              <div className="mt-8">
                <SectionHead note="32 teams · click a row to compare">League</SectionHead>
                <div className="max-h-[420px] overflow-auto">
                  <LeagueTable compact />
                </div>
              </div>
            </section>

            <aside className="flex flex-col gap-6 bg-bg p-5">
              <div>
                <SectionHead note="last 5">Results</SectionHead>
                <ResultsList />
              </div>
              <div>
                <SectionHead>Watch list</SectionHead>
                <ul className="divide-y divide-border">
                  {phases
                    .filter((p) => rankTier(p.rank) === 'negative')
                    .map((p) => (
                      <li key={p.phase} className="flex items-center gap-3 py-2">
                        <span className="flex-1 text-xs text-text">
                          {phaseDisplayName(p.phase)}
                        </span>
                        <RankCell rank={p.rank} />
                      </li>
                    ))}
                </ul>
                <p className="mt-2 font-mono text-2xs text-text-dim">
                  Bottom-third phases, auto-surfaced.
                </p>
              </div>
              <div>
                <SectionHead>Data</SectionHead>
                <dl className="space-y-1 font-mono text-2xs text-text-muted">
                  <div className="flex justify-between">
                    <dt>Last refresh</dt>
                    <dd className="text-text">Tue 10:06 AM ET</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Next ETL</dt>
                    <dd className="text-text">Tue 14:00 UTC</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Source</dt>
                    <dd className="text-text">nflverse</dd>
                  </div>
                </dl>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function Rail() {
  return (
    <nav className="hidden w-[200px] shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="border-b border-border px-4 py-4">
        <span className="font-display text-lg font-bold tracking-tighter text-text">
          28 <em className="not-italic text-positive">and</em> Three
        </span>
      </div>
      <ul className="flex-1 py-2">
        {NAV.map((item, i) => (
          <li key={item.label}>
            <span
              className={`flex cursor-default items-center gap-2 px-4 py-2 font-mono text-2xs uppercase tracking-widest ${
                i === 0
                  ? 'border-l-2 border-positive bg-surface-2 text-text'
                  : 'border-l-2 border-transparent text-text-muted hover:text-text'
              }`}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-border px-4 py-3">
        <Eyebrow>Season</Eyebrow>
        <span className="mt-1 inline-flex items-center gap-1 border border-border-strong px-2 py-1 font-mono text-2xs text-text">
          {SEASON} ▾
        </span>
      </div>
    </nav>
  );
}

function ContextBar() {
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-10 gap-y-3 border-b border-border-strong bg-bg px-5 py-3">
      <ContextStats dense />
      <div className="ml-auto flex items-center gap-2 font-mono text-2xs uppercase tracking-widest text-text-muted">
        <span className="h-1.5 w-1.5 rounded-pill bg-positive" aria-hidden="true" />
        Live
      </div>
    </header>
  );
}

function PhaseRow({
  phase,
  rank,
  epa,
  spark,
}: {
  phase: string;
  rank: number;
  epa: number;
  spark: number[];
}) {
  const tier = rankTier(rank);
  return (
    <div className="flex items-center gap-3 bg-bg px-3 py-2.5 hover:bg-surface">
      <span className="min-w-0 flex-1 truncate text-sm text-text">{phaseDisplayName(phase)}</span>
      <Sparkline
        values={spark}
        tier={tier}
        title={`${phaseDisplayName(phase)} weekly trend`}
        width={56}
        height={16}
      />
      <MetricValue
        value={epa}
        format={formatEpa}
        className="w-12 shrink-0 text-right text-xs text-text-muted"
      />
      <span className="w-10 shrink-0 text-right text-sm">
        <RankCell rank={rank} />
      </span>
    </div>
  );
}
