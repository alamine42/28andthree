import { notFound } from 'next/navigation';
import { getSeasonContext } from '@/lib/data/current-season';
import { getPlayer, getQbDeepDive } from '@/lib/data/player';
import { HistoricalMarker } from '@/components/HistoricalMarker';
import { MetricValue } from '@/components/numeric';
import { NoSeasonData } from '@/components/NoSeasonData';
import { SeasonNotice } from '@/components/SeasonNotice';
import { formatEpa, formatPercent } from '@/lib/format/number';
import { PlayerHeader } from '@/components/PlayerHeader';
import { SmallSampleBanner } from '@/components/SmallSampleBanner';
import { QbTrend } from '@/app/players/qb/[gsisId]/QbTrend';

// E11: shared QB deep-dive template. Clean route renders current season;
// /s/[season] wrapper renders past seasons. Plan §3.4.

export async function QbDeepDivePage({
  gsisId,
  season,
  historical,
}: {
  gsisId: string;
  season: number;
  historical: boolean;
}) {
  const ctx = await getSeasonContext();
  const [player, deepDive] = await Promise.all([
    getPlayer(gsisId, season),
    getQbDeepDive(gsisId, { season }),
  ]);
  if (!player) notFound();

  // Blank shell instead of 404 when the player exists but the viewed
  // season has no snaps: the preseason transition (stats coming) and any
  // historical season (stats never coming — different copy). Plan §3.4.
  if (!deepDive) {
    if (!historical && !ctx.awaitingFirstGame) notFound();
    return (
      <section className="flex flex-col gap-16 py-12 md:gap-[120px] md:py-16">
        <PlayerHeader player={player} season={season} subtitle="Quarterback" />
        {historical ? <HistoricalMarker season={season} current={ctx.season} /> : null}
        <NoSeasonData
          season={season}
          variant={historical ? 'historical' : 'upcoming'}
          message={
            historical
              ? `No recorded ${season} snaps with the Patriots.`
              : undefined
          }
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-16 py-12 md:gap-[120px] md:py-16">
      <PlayerHeader player={player} season={season} subtitle="Quarterback" />
      {historical ? <HistoricalMarker season={season} current={ctx.season} /> : null}
      {historical ? null : <SeasonNotice />}

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
