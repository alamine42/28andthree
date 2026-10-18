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

// Direction C — compare-first.
//
// The premise: "11th" only means something next to the other 31. So the
// league table is the page, not a panel inside it. The phase strip across
// the top is a filter — picking a phase re-sorts the table by that column
// and the Patriots row stays pinned in view.
//
// The data is already there: team_phase_season carries one row per
// (team, season, phase) for all 32 teams — that is where rank comes from —
// and getLeagueDistribution already reads 32 teams for a single phase. This
// screen needs that query pivoted across phases, not new ETL.
export default function DirectionC() {
  return (
    <div className="flex min-h-screen flex-col">
      <ProtoBanner variant="C · Compare-first" />
      <TopNav />

      <div className="border-b border-border px-6 py-3">
        <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center gap-x-10 gap-y-3">
          <ContextStats dense />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1800px] flex-1 px-6 py-5">
        <SectionHead note="click a phase to sort the league by it">Phase filter</SectionHead>
        <div className="flex gap-px overflow-x-auto bg-border pb-px">
          {phases.map((p, i) => (
            <PhaseChip key={p.phase} {...p} active={i === 0} />
          ))}
        </div>

        <div className="mt-8 grid gap-8 2xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0">
            <SectionHead note="sorted by overall EPA · New England pinned">
              The league, {SEASON}
            </SectionHead>
            {/* DESIGN.md §Layout: tables may exceed the viewport and scroll
                horizontally on small screens rather than drop columns. */}
            <div className="overflow-x-auto">
              <LeagueTable />
            </div>
          </section>

          <aside className="flex flex-col gap-8">
            <div>
              <SectionHead note="last 5">Results</SectionHead>
              <ResultsList />
            </div>
            <div>
              <SectionHead>Biggest gaps</SectionHead>
              <ul className="divide-y divide-border">
                <GapRow label="Run defense" value="30th" detail="23 spots below pass D" />
                <GapRow label="Rush offense" value="23rd" detail="14 spots below pass O" />
                <GapRow label="Special teams" value="19th" detail="middle third" />
              </ul>
              <p className="mt-2 font-mono text-2xs text-text-dim">
                Widest intra-team spread, auto-surfaced.
              </p>
            </div>
            <div>
              <SectionHead>Division</SectionHead>
              <dl className="space-y-2 border-t border-border pt-2 font-mono text-2xs">
                <div className="flex justify-between">
                  <dt className="text-text-muted">BUF</dt>
                  <dd className="tabular-nums text-text">4th</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-positive">NE</dt>
                  <dd className="tabular-nums text-positive">11th</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">MIA</dt>
                  <dd className="tabular-nums text-text">22nd</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">NYJ</dt>
                  <dd className="tabular-nums text-text">25th</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function TopNav() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-[1800px] items-center gap-8 px-6 py-4">
        <span className="font-display text-lg font-bold tracking-tighter text-text">
          28 <em className="not-italic text-positive">and</em> Three
        </span>
        <nav className="hidden gap-6 md:flex">
          {NAV.map((item, i) => (
            <span
              key={item.label}
              className={`cursor-default font-mono text-2xs uppercase tracking-widest ${
                i === 0 ? 'text-text' : 'text-text-muted hover:text-text'
              }`}
            >
              {item.label}
            </span>
          ))}
        </nav>
        <span className="ml-auto inline-flex items-center gap-1 border border-border-strong px-2 py-1 font-mono text-2xs text-text">
          {SEASON} ▾
        </span>
      </div>
    </header>
  );
}

function PhaseChip({
  phase,
  rank,
  epa,
  spark,
  active,
}: {
  phase: string;
  rank: number;
  epa: number;
  spark: number[];
  active: boolean;
}) {
  const tier = rankTier(rank);
  return (
    <div
      className={`flex min-w-[140px] flex-1 cursor-default flex-col gap-1 px-3 py-2 ${
        active ? 'bg-surface-2' : 'bg-bg hover:bg-surface'
      }`}
    >
      <Eyebrow>{phaseDisplayName(phase)}</Eyebrow>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-lg font-bold">
          <RankCell rank={rank} />
        </span>
        <Sparkline
          values={spark}
          tier={tier}
          title={`${phaseDisplayName(phase)} weekly trend`}
          width={48}
          height={14}
        />
      </div>
      <MetricValue value={epa} format={formatEpa} className="text-2xs text-text-muted" />
    </div>
  );
}

function GapRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <li className="flex items-baseline gap-3 py-2">
      <span className="flex-1 text-xs text-text">{label}</span>
      <span className="font-mono text-xs tabular-nums text-negative">{value}</span>
      <span className="w-full basis-full font-mono text-2xs text-text-dim">{detail}</span>
    </li>
  );
}
