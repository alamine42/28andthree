import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { qbSeason } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getCurrentSeason, getSeasonContext } from '@/lib/data/current-season';
import { getPlayer, getQbDeepDive } from '@/lib/data/player';
import { MetricValue } from '@/components/numeric';
import { NoSeasonData } from '@/components/NoSeasonData';
import { formatEpa, formatPercent } from '@/lib/format/number';
import { PlayerHeader } from '@/components/PlayerHeader';
import { SmallSampleBanner } from '@/components/SmallSampleBanner';
import { pageMetadata } from '@/lib/seo/page-metadata';
import { QbTrend } from './QbTrend';

export const revalidate = 3600;

type Params = Promise<{ gsisId: string }>;

/** Pre-render current-season Pats QBs at build time (plan §3.12: cap
 * pre-render to ~50 players, not 480). Other QBs ISR-on-demand. */
export async function generateStaticParams() {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ gsisId: qbSeason.gsisId })
    .from(qbSeason)
    .where(and(eq(qbSeason.team, 'NE'), eq(qbSeason.season, 2025)));
  return rows.map((r) => ({ gsisId: r.gsisId }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { gsisId } = await params;
  const season = await getCurrentSeason();
  const [player, deepDive] = await Promise.all([
    getPlayer(gsisId, season),
    getQbDeepDive(gsisId, { season }),
  ]);
  if (!player) return {};
  const name = player.displayName;
  const epa = deepDive?.epaPerDropback;
  const stat = epa != null ? `${formatEpa(epa)} EPA/dropback` : undefined;
  return pageMetadata({
    title: `${name} \u00B7 QB`,
    description: `${name} quarterback deep dive: EPA per dropback, CPOE, aDOT, pressure splits, weekly trend \u2014 ${season} season.`,
    og: {
      title: name,
      eyebrow: `QB \u00B7 ${season}`,
      stat,
    },
    canonical: `/players/qb/${gsisId}`,
  });
}

export default async function QbDeepDivePage({ params }: { params: Params }) {
  const { gsisId } = await params;
  const ctx = await getSeasonContext();
  const season = ctx.season;
  const [player, deepDive] = await Promise.all([
    getPlayer(gsisId, season),
    getQbDeepDive(gsisId, { season }),
  ]);
  if (!player) notFound();

  // Preseason transition: the player exists but the new season has no
  // snaps. Render the header with the blank-stats callout instead of 404.
  if (!deepDive) {
    if (!ctx.awaitingFirstGame) notFound();
    return (
      <section className="flex flex-col gap-16 py-12 md:gap-[120px] md:py-16">
        <PlayerHeader player={player} season={season} subtitle="Quarterback" />
        <NoSeasonData season={season} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-16 py-12 md:gap-[120px] md:py-16">
      <PlayerHeader player={player} season={season} subtitle="Quarterback" />

      <SmallSampleBanner kind="dropbacks" n={deepDive.dropbacks} threshold={100} />

      <dl
        className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-4"
        data-testid="qb-hero-stats"
      >
        <HairlineCell label="EPA / dropback">
          <p className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-display">
            <MetricValue value={deepDive.epaPerDropback} format={formatEpa} />
          </p>
        </HairlineCell>
        <HairlineCell label="CPOE">
          <p className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-display">
            <MetricValue value={deepDive.cpoe} format={(v) => v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%'} />
          </p>
        </HairlineCell>
        <HairlineCell label="aDOT">
          <p className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-display">
            <MetricValue value={deepDive.adot} format={(v) => v == null ? '—' : v.toFixed(1) + ' yds'} />
          </p>
        </HairlineCell>
        <HairlineCell label="Pressure rate">
          <p className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-display">
            <MetricValue value={deepDive.pressureRate} format={formatPercent} />
          </p>
        </HairlineCell>
      </dl>

      <QbTrend weekly={deepDive.weekly} />

      <dl
        className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-2"
        data-testid="qb-pressure-split"
      >
        <HairlineCell label="Clean pocket (EPA/dropback)">
          <p className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-display">
            <MetricValue value={deepDive.cleanPocketEpaPerDropback} format={formatEpa} />
          </p>
        </HairlineCell>
        <HairlineCell label="Under pressure (EPA/dropback)">
          <p className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-display">
            <MetricValue value={deepDive.pressuredEpaPerDropback} format={formatEpa} />
          </p>
        </HairlineCell>
      </dl>

      <dl
        className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-2"
        data-testid="qb-deep-ball"
      >
        <HairlineCell label="Deep-ball EPA (20+ air yds)">
          <p className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-display">
            <MetricValue value={deepDive.deepEpaPerAttempt} format={formatEpa} />
          </p>
        </HairlineCell>
        <HairlineCell label="Success rate">
          <p className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-display">
            <MetricValue value={deepDive.successRate} format={formatPercent} />
          </p>
        </HairlineCell>
      </dl>

      <MethodologyCallout />
    </section>
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

function MethodologyCallout() {
  return (
    <aside className="flex flex-col gap-2 rounded-sm border-l-2 border-positive bg-surface px-4 py-3">
      <p className="font-mono text-2xs uppercase tracking-widest text-positive">Methodology</p>
      <p className="max-w-prose text-sm text-text">
        Primary starter = games where the QB took more than 50% of team dropbacks. Pressure rate
        and clean-pocket splits are shown only when participation data coverage for the underlying
        games is ≥ 80% (SPEC §3.3); em-dashes otherwise.
      </p>
    </aside>
  );
}
