import { notFound } from 'next/navigation';
import { getSeasonContext } from '@/lib/data/current-season';
import { getPlayer, getSkillUsage } from '@/lib/data/player';
import { HistoricalMarker } from '@/components/HistoricalMarker';
import { MetricValue } from '@/components/numeric';
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
    getSkillUsage(gsisId, { season }),
  ]);
  if (!player) notFound();

  // Blank shell instead of 404 when the player exists but the viewed
  // season has no snaps (preseason transition or historical). Plan §3.4.
  if (!usage) {
    if (!historical && !ctx.awaitingFirstGame) notFound();
    return (
      <section className="flex flex-col gap-16 py-12 md:gap-[120px] md:py-16">
        <PlayerHeader player={player} season={season} subtitle={player.position ?? undefined} />
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

  const isRb = usage.position === 'RB' || usage.position === 'HB' || usage.position === 'FB';

  return (
    <section className="flex flex-col gap-16 py-12 md:gap-[120px] md:py-16">
      <PlayerHeader player={player} season={season} subtitle={usage.position} />
      {historical ? <HistoricalMarker season={season} current={ctx.season} /> : null}
      {historical ? null : <SeasonNotice />}

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
            <HairlineCell label="Carries">
              <Big value={usage.carries} format={(v) => v == null ? '—' : String(v)} />
            </HairlineCell>
            <HairlineCell label="Yards">
              <Big value={usage.yardsRushing} format={(v) => v == null ? '—' : String(v)} />
            </HairlineCell>
            <HairlineCell label="YPC">
              <Big value={usage.ypc} format={(v) => v == null ? '—' : v.toFixed(2)} />
            </HairlineCell>
            <HairlineCell label="RZ targets">
              <Big value={usage.redzoneTargets} format={(v) => v == null ? '—' : String(v)} />
            </HairlineCell>
          </>
        ) : (
          <>
            <HairlineCell label="Targets">
              <Big value={usage.targets} format={(v) => v == null ? '—' : String(v)} />
            </HairlineCell>
            <HairlineCell label="Receptions">
              <Big value={usage.receptions} format={(v) => v == null ? '—' : String(v)} />
            </HairlineCell>
            <HairlineCell label="Target share" testid="skill-target-share">
              <Big value={usage.targetShare} format={formatPercent} />
            </HairlineCell>
            <HairlineCell label="YAC / reception">
              <Big value={usage.yacPerReception} format={(v) => v == null ? '—' : v.toFixed(1) + ' yds'} />
            </HairlineCell>
          </>
        )}
      </dl>
    </section>
  );
}

function HairlineCell({
  label,
  children,
  testid,
}: {
  label: string;
  children: React.ReactNode;
  testid?: string;
}) {
  return (
    <div className="flex flex-col gap-2 bg-bg p-6 md:p-8" data-testid={testid}>
      <dt className="font-mono text-2xs uppercase tracking-widest text-text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Big<T>({ value, format }: { value: T | null | undefined; format: (v: T | null | undefined) => string }) {
  return (
    <p className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-display">
      <MetricValue value={value} format={format} />
    </p>
  );
}
