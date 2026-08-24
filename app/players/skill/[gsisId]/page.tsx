import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { skillSeason } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getCurrentSeason, getSeasonContext } from '@/lib/data/current-season';
import { getPlayer, getSkillUsage } from '@/lib/data/player';
import { MetricValue } from '@/components/numeric';
import { NoSeasonData } from '@/components/NoSeasonData';
import { formatPercent } from '@/lib/format/number';
import { PlayerHeader } from '@/components/PlayerHeader';
import { SmallSampleBanner } from '@/components/SmallSampleBanner';
import { pageMetadata } from '@/lib/seo/page-metadata';

export const revalidate = 3600;

type Params = Promise<{ gsisId: string }>;

export async function generateStaticParams() {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ gsisId: skillSeason.gsisId })
    .from(skillSeason)
    .where(and(eq(skillSeason.team, 'NE'), eq(skillSeason.season, 2025)));
  return rows.map((r) => ({ gsisId: r.gsisId }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { gsisId } = await params;
  const season = await getCurrentSeason();
  const [player, usage] = await Promise.all([
    getPlayer(gsisId, season),
    getSkillUsage(gsisId, { season }),
  ]);
  if (!player) return {};
  const name = player.displayName;
  const position = usage?.position ?? player.position ?? 'Skill';
  const stat =
    usage?.targetShare != null
      ? `${formatPercent(usage.targetShare)} target share`
      : undefined;
  return pageMetadata({
    title: `${name} \u00B7 ${position}`,
    description: `${name} skill-position deep dive: target share, YAC, aDOT, red-zone usage \u2014 ${season} season.`,
    og: {
      title: name,
      eyebrow: `${position.toUpperCase()} \u00B7 ${season}`,
      stat,
    },
    canonical: `/players/skill/${gsisId}`,
  });
}

export default async function SkillPage({ params }: { params: Params }) {
  const { gsisId } = await params;
  const ctx = await getSeasonContext();
  const season = ctx.season;
  const [player, usage] = await Promise.all([
    getPlayer(gsisId, season),
    getSkillUsage(gsisId, { season }),
  ]);
  if (!player) notFound();

  // Preseason transition: the player exists but the new season has no
  // snaps. Render the header with the blank-stats callout instead of 404.
  if (!usage) {
    if (!ctx.awaitingFirstGame) notFound();
    return (
      <section className="flex flex-col gap-16 py-12 md:gap-[120px] md:py-16">
        <PlayerHeader player={player} season={season} subtitle={player.position ?? undefined} />
        <NoSeasonData season={season} />
      </section>
    );
  }

  const isRb = usage.position === 'RB' || usage.position === 'HB' || usage.position === 'FB';

  return (
    <section className="flex flex-col gap-16 py-12 md:gap-[120px] md:py-16">
      <PlayerHeader player={player} season={season} subtitle={usage.position} />

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
