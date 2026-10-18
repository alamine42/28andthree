import Link from 'next/link';
import type { Route } from 'next';
import { TrendChart } from '@/components/charts/TrendChart';
import { DistributionPlot } from '@/components/charts/DistributionPlot';
import { MetricValue, RankNumber } from '@/components/numeric';
import { formatEpa, formatPercent } from '@/lib/format/number';
import {
  passOffenseContributors,
  passOffenseDistribution,
  passOffenseTrend,
  phases,
  SEASON,
} from '@/lib/proto/data';
import { Eyebrow, RankCell, SectionHead } from '../../_components/shared';
import { BShell, Breadcrumb, DataRail, PageHead, RailBlock } from '../_shell';
import {
  HistoricalChip,
  NoDataCallout,
  SmallSampleCallout,
  StateSwitcher,
  type ScreenState,
} from '../_states';

// Screen 2 — phase detail, reached from any row of the overview's phase
// table. Carries four of the six states; ?state= switches between them so
// each one can be reviewed without waiting for the real condition.
export default async function BPhaseDetail({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state: raw } = await searchParams;
  const state = (raw ?? 'loaded') as ScreenState;
  const historical = state === 'historical';
  const season = historical ? 2023 : SEASON;

  return (
    <BShell active="Phases" screen={`Phase detail · ${state}`} rail={<Rail state={state} />}>
      <PageHead
        breadcrumb={
          <Breadcrumb
            trail={[{ label: 'Season overview', href: '/proto/b' }]}
            current="Pass offense"
          />
        }
        eyebrow={`EPA per play · regular season ${season}`}
        title="Pass offense"
        marker={
          <div className="flex flex-col gap-3">
            {historical ? <HistoricalChip season={season} backHref="/proto/b/phase" /> : null}
            {state === 'small-sample' ? <SmallSampleCallout /> : null}
            <StateSwitcher base="/proto/b/phase" current={state} />
          </div>
        }
      />

      {state === 'no-data' ? (
        <NoDataCallout season={season} variant={historical ? 'historical' : 'upcoming'} />
      ) : (
        <>
          <dl className="grid gap-px border border-border bg-border md:grid-cols-3">
            <Stat label="Rank">
              <RankNumber rank={9} className="text-3xl leading-none" />
            </Stat>
            <Stat label="EPA / play">
              <MetricValue value={0.17} format={formatEpa} className="text-3xl text-text" />
            </Stat>
            <Stat label="Success rate">
              <MetricValue value={0.52} format={formatPercent} className="text-3xl text-text" />
            </Stat>
          </dl>

          {/* Both charts carry a 720x320 viewBox and scale to their
              container, so a wider column makes them proportionally TALLER,
              not denser: at ~1180px the trend chart renders ~525px tall and
              five weekly points float in it. Capping the width is a stopgap.
              The real fix is a viewBox that does not tie height to width —
              worth its own change to the shared chart components, not
              something to settle inside a layout decision. */}
          <section className="mt-8">
            <SectionHead note="capped at 860px — see note">Weekly trend</SectionHead>
            <div className="max-w-[860px]">
              <TrendChart points={passOffenseTrend} phaseLabel="Pass offense" />
            </div>
          </section>

          <section className="mt-8">
            <SectionHead note="32 teams">League distribution</SectionHead>
            <div className="max-w-[860px]">
              <DistributionPlot
                rows={passOffenseDistribution}
                highlightTeam="NE"
                phaseLabel="Pass offense"
              />
            </div>
          </section>

          <section className="mt-8">
            <SectionHead note="top 3 by EPA share">Top contributors</SectionHead>
            <ul className="divide-y divide-border border-y border-border">
              {passOffenseContributors.map((c) => (
                <li key={c.name} className="flex items-baseline gap-4 py-3">
                  <span className="w-10 font-mono text-2xs uppercase tracking-widest text-text-muted">
                    {c.position}
                  </span>
                  <span className="flex-1 text-sm text-text">{c.name}</span>
                  <span className="font-mono text-2xs text-text-dim">{c.line}</span>
                  <span className="w-28 text-right font-mono text-xs tabular-nums text-text">
                    {c.value}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </BShell>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 bg-bg p-4">
      <Eyebrow>{label}</Eyebrow>
      <div>{children}</div>
    </div>
  );
}

/** The rail earns its place on this screen: the other eleven phases stay a
 * click away, so comparing phases no longer means going back to the
 * overview between each one. */
function Rail({ state }: { state: ScreenState }) {
  return (
    <>
      <RailBlock title="All phases" note="jump">
        <ul className="divide-y divide-border">
          {phases.map((p, i) => (
            <li key={p.phase}>
              <Link
                href={`/proto/b/phase?state=${state}` as Route}
                className={`flex items-center justify-between gap-2 py-2 text-xs hover:text-text ${
                  i === 0 ? 'text-text' : 'text-text-muted'
                }`}
              >
                <span className="truncate">{p.phase.replace(/_/g, ' ')}</span>
                <RankCell rank={p.rank} />
              </Link>
            </li>
          ))}
        </ul>
      </RailBlock>
      <DataRail />
    </>
  );
}
