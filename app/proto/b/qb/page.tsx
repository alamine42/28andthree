import { MetricValue } from '@/components/numeric';
import { formatEpa, formatPercent } from '@/lib/format/number';
import { qb } from '@/lib/proto/data';
import { Eyebrow, SectionHead } from '../../_components/shared';
import { BShell, Breadcrumb, DataRail, PageHead, RailBlock, RailRow } from '../_shell';
import { SmallSampleCallout, StateSwitcher } from '../_states';

// Screen 4 — QB deep dive. The densest screen in the product and the real
// test of the shell: the live version stacks six separate bordered stat
// grids down a single 1240px column, each one a full-width row holding two
// to four numbers. Here the same numbers sit in one 4-up strip plus two
// paired splits, and the methodology note moves to the rail where it stops
// interrupting the read.
export default async function BQbDeepDive({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  // The small-sample state is a different player-week, not a different
  // layout: a backup with 64 dropbacks trips the 100-dropback floor.
  const small = state === 'small-sample';
  const dropbacks = small ? 64 : qb.dropbacks;
  return (
    <BShell active="Players" screen="QB deep dive" rail={<Rail dropbacks={dropbacks} />}>
      <PageHead
        breadcrumb={
          <Breadcrumb
            trail={[
              { label: 'Season overview', href: '/proto/b' },
              { label: 'Players', href: '/proto/b/players' },
            ]}
            current={qb.name}
          />
        }
        eyebrow={`Quarterback · #${qb.number} · 2026`}
        title={qb.name}
        lede="Primary starter: games with more than 50% of team dropbacks."
        marker={
          <div className="flex flex-col gap-3">
            <SmallSampleCallout n={dropbacks} threshold={100} kind="dropbacks" />
            <StateSwitcher
              base="/proto/b/qb"
              current={small ? 'small-sample' : 'loaded'}
              states={['loaded', 'small-sample']}
            />
          </div>
        }
      />

      <dl className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
        <Stat label="EPA / dropback" value={formatEpa(qb.epaPerDropback)} />
        <Stat label="CPOE" value={`+${qb.cpoe.toFixed(1)}%`} />
        <Stat label="aDOT" value={`${qb.adot.toFixed(1)} yds`} />
        <Stat label="Pressure rate" value={formatPercent(qb.pressureRate)} />
      </dl>

      <section className="mt-8">
        <SectionHead note="EPA per dropback">Weekly</SectionHead>
        {/* Bars off a zero line, not sparklines. A sparkline needs a series;
            one value per week is a magnitude, and a bar shows sign and size
            of each week against the others at a glance. */}
        <WeeklyBars />
      </section>

      {/* Two splits side by side rather than two stacked full-width grids.
          The comparison is the point; stacking them hides it. */}
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section>
          <SectionHead note="EPA / dropback">Pressure split</SectionHead>
          <dl className="grid grid-cols-2 gap-px border border-border bg-border">
            <Stat label="Clean pocket" value={formatEpa(qb.cleanPocketEpa)} tone="positive" />
            <Stat label="Under pressure" value={formatEpa(qb.pressuredEpa)} tone="negative" />
          </dl>
        </section>
        <section>
          <SectionHead note="20+ air yards">Deep ball</SectionHead>
          <dl className="grid grid-cols-2 gap-px border border-border bg-border">
            <Stat label="Deep-ball EPA" value={formatEpa(qb.deepEpa)} tone="positive" />
            <Stat label="Success rate" value={formatPercent(qb.successRate)} />
          </dl>
        </section>
      </div>
    </BShell>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  const color =
    tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : 'text-text';
  return (
    <div className="flex flex-col gap-2 bg-bg p-4">
      <Eyebrow>{label}</Eyebrow>
      <span data-numeric="true" className={`font-mono text-2xl tabular-nums ${color}`}>
        {value}
      </span>
    </div>
  );
}

/** Weekly EPA per dropback as signed bars off a shared zero line. */
function WeeklyBars() {
  const max = Math.max(...qb.weekly.map((w) => Math.abs(w.epa)));
  return (
    <div className="flex items-stretch gap-px border border-border bg-border">
      {qb.weekly.map((w) => {
        const pct = (Math.abs(w.epa) / max) * 42;
        const up = w.epa >= 0;
        return (
          <div key={w.week} className="flex flex-1 flex-col items-center gap-2 bg-bg px-2 py-3">
            <MetricValue
              value={w.epa}
              format={formatEpa}
              className={`text-xs ${up ? 'text-positive' : 'text-negative'}`}
            />
            <div className="relative h-24 w-full" aria-hidden="true">
              <div className="absolute inset-x-0 top-1/2 h-px bg-border-strong" />
              <div
                className={`absolute left-1/2 w-8 -translate-x-1/2 ${up ? 'bg-positive' : 'bg-negative'}`}
                style={
                  up ? { bottom: '50%', height: `${pct}%` } : { top: '50%', height: `${pct}%` }
                }
              />
            </div>
            <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
              Wk {w.week}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Rail({ dropbacks }: { dropbacks: number }) {
  return (
    <>
      <RailBlock title="Season">
        <dl className="space-y-2">
          <RailRow label="Dropbacks" value={String(dropbacks)} />
          <RailRow label="Games started" value="5" />
          <RailRow label="Team pass O rank" value="9th" />
        </dl>
      </RailBlock>
      <RailBlock title="Other quarterbacks">
        <dl className="space-y-2">
          <RailRow label="Behren Morton" value="—" />
          <RailRow label="Tommy DeVito" value="—" />
        </dl>
        <p className="mt-2 font-mono text-2xs text-text-dim">No qualifying dropbacks.</p>
      </RailBlock>
      {/* The live page ends with this as a full-width callout below every
          stat grid. In the rail it is available without interrupting. */}
      <RailBlock title="Methodology">
        <p className="border-l-2 border-positive bg-surface px-3 py-2 text-xs text-text-muted">
          Pressure rate and clean-pocket splits render only when participation coverage for the
          underlying games is ≥ 80% (SPEC §3.3). Em-dashes otherwise.
        </p>
      </RailBlock>
      <DataRail />
    </>
  );
}
