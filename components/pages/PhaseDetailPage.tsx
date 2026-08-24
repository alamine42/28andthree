import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { type Phase } from '@/lib/constants/phases';
import { phaseDisplayName } from '@/lib/format/phase';
import { getSeasonContext } from '@/lib/data/current-season';
import {
  getLeagueDistribution,
  getPhaseDetail,
  getPhaseWeeklyTrend,
} from '@/lib/data/phases';
import { HistoricalMarker } from '@/components/HistoricalMarker';
import { NoSeasonData } from '@/components/NoSeasonData';
import { SeasonNotice } from '@/components/SeasonNotice';
import { MetricValue, RankNumber } from '@/components/numeric';
import { StatCell, StatValue } from '@/components/StatCell';
import { formatEpa, formatPercent } from '@/lib/format/number';
import { TrendChart } from '@/components/charts/TrendChart';
import { DistributionPlot } from '@/components/charts/DistributionPlot';
import { TopContributorCard } from '@/components/TopContributorCard';
import { getTopContributors } from '@/lib/data/contributors';

// E11: shared phase-detail template. Clean route renders current season;
// /s/[season] wrapper renders past seasons. Plan §3.4.

export async function PhaseDetailPage({
  phase,
  season,
  historical,
}: {
  phase: Phase;
  season: number;
  historical: boolean;
}) {
  const ctx = await getSeasonContext();

  const [detail, trend, distribution, contributors] = await Promise.all([
    getPhaseDetail(phase, 'NE', season),
    getPhaseWeeklyTrend(phase, 'NE', season),
    getLeagueDistribution(phase, season),
    getTopContributors(phase, 'NE', season, 3),
  ]);

  const display = phaseDisplayName(phase);
  const homeHref = historical ? `/?season=${season}` : '/';

  // Missing rows never 404 for a browsable season (plan §3.4): the
  // preseason transition renders the upcoming shell; a historical gap
  // (insufficient sample, backfill hole) renders the historical shell.
  // Outside both, a missing detail still means a broken slug/season → 404.
  if (!detail) {
    if (!historical && !ctx.awaitingFirstGame) notFound();
    return (
      <section className="flex flex-col gap-16 py-12 md:gap-[120px] md:py-16">
        <PhaseBreadcrumb display={display} homeHref={homeHref} />
        <header className="flex flex-col gap-3">
          {historical ? (
            <HistoricalMarker season={season} backHref={`/phases/${phase}`} />
          ) : null}
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display">
            {display}
          </h1>
          <p className="font-mono text-xs text-text-muted">
            EPA per play · regular season <span className="tabular-nums">{season}</span>
          </p>
        </header>
        <NoSeasonData season={season} variant={historical ? 'historical' : 'upcoming'} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-16 py-12 md:gap-[120px] md:py-16">
      {historical ? null : <SeasonNotice />}
      <PhaseBreadcrumb display={display} homeHref={homeHref} />

      <header className="flex flex-col gap-3">
        {historical ? (
          <HistoricalMarker season={season} backHref={`/phases/${phase}`} />
        ) : null}
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display">
          {display}
        </h1>
        <p className="flex flex-wrap items-center gap-3 font-mono text-xs text-text-muted">
          <span>
            EPA per play · regular season <span className="tabular-nums">{season}</span>
          </span>
          {detail.totalQualified !== 32 ? (
            <span className="text-text-muted">
              of {detail.totalQualified} qualified teams
            </span>
          ) : null}
          {detail.insufficientSample ? (
            <InsufficientSampleChip plays={detail.plays} />
          ) : null}
        </p>
      </header>

      <dl
        className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-3"
        data-testid="phase-rank-card"
      >
        <StatCell label="Rank">
          <RankNumber rank={detail.rank} className="text-display leading-none" />
        </StatCell>
        <StatCell label="EPA / play">
          <StatValue>
            <MetricValue value={detail.epaPerPlay} format={formatEpa} />
          </StatValue>
        </StatCell>
        <StatCell label="Success rate">
          <StatValue>
            <MetricValue value={detail.successRate} format={formatPercent} />
          </StatValue>
        </StatCell>
      </dl>

      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Weekly trend
        </h2>
        <TrendChart points={trend} phaseLabel={display} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          League distribution
        </h2>
        <DistributionPlot rows={distribution} highlightTeam="NE" phaseLabel={display} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Top contributors
        </h2>
        {contributors.length === 0 ? (
          <p className="text-text-muted">
            {historical ? `No ${season} contributor data.` : 'No contributor data yet.'}
          </p>
        ) : (
          <>
            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              {contributors.map((c, i) => (
                <TopContributorCard key={c.gsisId || `unit-${i}`} card={c} seasonQuery={historical ? season : null} />
              ))}
            </div>
            {contributors[0]?.caveat ? (
              <p
                data-testid="contributor-caveat"
                className="font-mono text-2xs leading-relaxed text-text-muted"
              >
                {contributors[0].caveat}
              </p>
            ) : null}
          </>
        )}
      </section>
    </section>
  );
}

function PhaseBreadcrumb({ display, homeHref }: { display: string; homeHref: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center font-mono text-2xs uppercase tracking-widest text-text-muted"
    >
      <Link
        href={homeHref as Route}
        className="inline-flex min-h-[44px] items-center underline underline-offset-4 decoration-border-strong hover:decoration-text hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive"
      >
        Season overview
      </Link>
      <span className="mx-2 text-text-muted">/</span>
      <span className="text-text">{display}</span>
    </nav>
  );
}

function InsufficientSampleChip({ plays }: { plays: number }) {
  // Surface the SPEC §3.5a small-sample state explicitly on the phase page.
  // Home grid already shows an "n<30" badge; this brings the phase detail
  // in sync so users know why the rank + EPA render as em-dashes.
  return (
    <span
      title={`${plays} plays — below the 30-play season threshold (SPEC §3.5a)`}
      className="rounded-sm border border-border-strong px-2 py-0.5 uppercase tracking-widest text-text-muted"
    >
      n&lt;30 · insufficient sample
    </span>
  );
}

