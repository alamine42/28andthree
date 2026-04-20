import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isValidPhase, type Phase } from '@/lib/constants/phases';
import { phaseDisplayName } from '@/lib/format/phase';
import { getCurrentSeason } from '@/lib/data/current-season';
import {
  getLeagueDistribution,
  getPhaseDetail,
  getPhaseWeeklyTrend,
} from '@/lib/data/phases';
import { MetricValue, RankNumber } from '@/components/numeric';
import { formatEpa, formatPercent } from '@/lib/format/number';
import { TrendChart } from '@/components/charts/TrendChart';
import { DistributionPlot } from '@/components/charts/DistributionPlot';
import { TopContributorCard } from '@/components/TopContributorCard';
import { getTopContributors } from '@/lib/data/contributors';
import { pageMetadata } from '@/lib/seo/page-metadata';

export const revalidate = 3600;

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  // Pre-render the 12 known phases for SSG path hints.
  const { PHASES } = await import('@/lib/constants/phases');
  return PHASES.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidPhase(slug)) return {};
  const phase = slug as Phase;
  const display = phaseDisplayName(phase);
  const season = await getCurrentSeason();
  const detail = await getPhaseDetail(phase, 'NE', season);
  const rank = detail?.rank != null ? String(detail.rank).padStart(2, '0') : undefined;
  const epa = detail?.epaPerPlay != null ? formatEpa(detail.epaPerPlay) : null;

  return pageMetadata({
    title: display,
    description: `Patriots ${display.toLowerCase()} rank and EPA per play, season-to-date ${season} against the 32-team league, with weekly trend and top contributors.`,
    og: {
      title: display,
      eyebrow: `PHASES \u00B7 ${season}`,
      rank,
      stat: epa ? `${epa} EPA/play` : undefined,
    },
    canonical: `/phases/${slug}`,
  });
}

export default async function PhaseDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  if (!isValidPhase(slug)) notFound();
  const phase = slug as Phase;
  const season = await getCurrentSeason();

  const [detail, trend, distribution, contributors] = await Promise.all([
    getPhaseDetail(phase, 'NE', season),
    getPhaseWeeklyTrend(phase, 'NE', season),
    getLeagueDistribution(phase, season),
    getTopContributors(phase, 'NE', season, 3),
  ]);

  if (!detail) notFound();

  const display = phaseDisplayName(phase);

  return (
    <section className="flex flex-col gap-16 py-12 md:gap-[120px] md:py-16">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center font-mono text-2xs uppercase tracking-widest text-text-muted"
      >
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center underline underline-offset-4 decoration-border-strong hover:decoration-text hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive"
        >
          Season overview
        </Link>
        <span className="mx-2 text-text-muted">/</span>
        <span className="text-text">{display}</span>
      </nav>

      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display">
          {display}
        </h1>
        <p className="flex flex-wrap items-center gap-3 font-mono text-xs text-text-muted">
          <span>EPA per play · regular season {season}</span>
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
        <HairlineCell label="Rank">
          <RankNumber rank={detail.rank} className="text-display leading-none" />
        </HairlineCell>
        <HairlineCell label="EPA / play">
          <p className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-display">
            <MetricValue value={detail.epaPerPlay} format={formatEpa} />
          </p>
        </HairlineCell>
        <HairlineCell label="Success rate">
          <p className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-display">
            <MetricValue value={detail.successRate} format={formatPercent} />
          </p>
        </HairlineCell>
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
          <p className="text-text-muted">No contributor data yet.</p>
        ) : (
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {contributors.map((c, i) => (
              <TopContributorCard key={c.gsisId || `unit-${i}`} card={c} />
            ))}
          </div>
        )}
      </section>
    </section>
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

function HairlineCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 bg-bg p-6 md:p-8">
      <dt className="font-mono text-2xs uppercase tracking-widest text-text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

