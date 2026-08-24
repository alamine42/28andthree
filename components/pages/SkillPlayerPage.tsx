import { notFound } from 'next/navigation';
import { getSeasonContext } from '@/lib/data/current-season';
import { getPlayer, getSkillUsage } from '@/lib/data/player';
import { HistoricalMarker } from '@/components/HistoricalMarker';
import { MetricValue } from '@/components/numeric';
import { StatCell, StatValue } from '@/components/StatCell';
import { NoSeasonData } from '@/components/NoSeasonData';
import { SeasonNotice } from '@/components/SeasonNotice';
import { formatPercent } from '@/lib/format/number';
import { PlayerHeader } from '@/components/PlayerHeader';
import { SmallSampleBanner } from '@/components/SmallSampleBanner';

// E11: shared skill-player template. Clean route renders current season;
// /s/[season] wrapper renders past seasons. Plan §3.4.

export async function SkillPlayerPage({
  gsisId,
  season,
  historical,
}: {
  gsisId: string;
  season: number;
  historical: boolean;
}) {
  const ctx = await getSeasonContext();
  const [player, usage] = await Promise.all([
    getPlayer(gsisId, season),
    getSkillUsage(gsisId, season),
  ]);
  if (!player) notFound();

  // Blank shell instead of 404 when the player exists but the viewed
  // season has no snaps (preseason transition or historical). Plan §3.4.
  if (!usage) {
    if (!historical && !ctx.awaitingFirstGame) notFound();
    return (
      <section className="flex flex-col gap-16 py-12 md:gap-[120px] md:py-16">
        {historical ? null : <SeasonNotice />}
        <header className="flex flex-col gap-3">
          <PlayerHeader player={player} season={season} subtitle={player.position ?? undefined} />
          {historical ? (
            <HistoricalMarker season={season} backHref="/players" />
          ) : null}
        </header>
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

  const isRb = usage.position === 'RB' || usage.position === 'HB' || usage.position === 'FB';

  return (
    <section className="flex flex-col gap-16 py-12 md:gap-[120px] md:py-16">
      {historical ? null : <SeasonNotice />}
      {/* Back target is the roster hub, not this player's clean URL — a
          departed player has no current-season stats and the clean player
          route 404s (code review pass 1). */}
      <header className="flex flex-col gap-3">
        <PlayerHeader player={player} season={season} subtitle={usage.position} />
        {historical ? (
          <HistoricalMarker season={season} backHref="/players" />
        ) : null}
      </header>

      <SmallSampleBanner
        kind={isRb ? 'carries' : 'targets'}
        n={isRb ? usage.carries ?? 0 : usage.targets ?? 0}
        threshold={isRb ? 50 : 30}
      />

      <dl
        className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-4"
        data-testid="skill-hero-stats"
      >
        {isRb ? (
          <>
            <StatCell label="Carries">
              <StatValue><MetricValue value={usage.carries} format={(v) => v == null ? '—' : String(v)} /></StatValue>
            </StatCell>
            <StatCell label="Yards">
              <StatValue><MetricValue value={usage.yardsRushing} format={(v) => v == null ? '—' : String(v)} /></StatValue>
            </StatCell>
            <StatCell label="YPC">
              <StatValue><MetricValue value={usage.ypc} format={(v) => v == null ? '—' : v.toFixed(2)} /></StatValue>
            </StatCell>
            <StatCell label="RZ targets">
              <StatValue><MetricValue value={usage.redzoneTargets} format={(v) => v == null ? '—' : String(v)} /></StatValue>
            </StatCell>
          </>
        ) : (
          <>
            <StatCell label="Targets">
              <StatValue><MetricValue value={usage.targets} format={(v) => v == null ? '—' : String(v)} /></StatValue>
            </StatCell>
            <StatCell label="Receptions">
              <StatValue><MetricValue value={usage.receptions} format={(v) => v == null ? '—' : String(v)} /></StatValue>
            </StatCell>
            <StatCell label="Target share" testid="skill-target-share">
              <StatValue><MetricValue value={usage.targetShare} format={formatPercent} /></StatValue>
            </StatCell>
            <StatCell label="YAC / reception">
              <StatValue><MetricValue value={usage.yacPerReception} format={(v) => v == null ? '—' : v.toFixed(1) + ' yds'} /></StatValue>
            </StatCell>
          </>
        )}
      </dl>
    </section>
  );
}


