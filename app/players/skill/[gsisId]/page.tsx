import type { Metadata } from 'next';
import { and, eq } from 'drizzle-orm';
import { skillSeason } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getCurrentSeason } from '@/lib/data/current-season';
import { getLatestStatsSeason } from '@/lib/data/stats-season';
import { getPlayer, getSkillUsage } from '@/lib/data/player';
import { formatPercent } from '@/lib/format/number';
import { pageMetadata } from '@/lib/seo/page-metadata';
import { SkillPlayerPage } from '@/components/pages/SkillPlayerPage';

export const revalidate = 3600;

type Params = Promise<{ gsisId: string }>;

export async function generateStaticParams() {
  const db = getDb();
  if (!db) return [];
  // Latest season with stats — the display season is empty during the
  // preseason transition (plan §3.7).
  const statsSeason = await getLatestStatsSeason();
  if (statsSeason == null) return [];
  const rows = await db
    .select({ gsisId: skillSeason.gsisId })
    .from(skillSeason)
    .where(and(eq(skillSeason.team, 'NE'), eq(skillSeason.season, statsSeason)));
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
    getSkillUsage(gsisId, season),
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
    // Blank-shell renders are thin near-duplicates — noindex (plan §3.7).
    noindex: usage == null,
  });
}

export default async function CleanSkillPlayerPage({ params }: { params: Params }) {
  const { gsisId } = await params;
  const season = await getCurrentSeason();
  return <SkillPlayerPage gsisId={gsisId} season={season} historical={false} />;
}
