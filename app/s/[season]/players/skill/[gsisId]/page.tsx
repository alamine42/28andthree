import { SkillPlayerPage } from '@/components/pages/SkillPlayerPage';
import { requireHistoricalSeason } from '@/lib/season-route';
import type { Metadata } from 'next';
import { getPlayer, getSkillUsage } from '@/lib/data/player';
import { parseSeasonParam } from '@/lib/season-view';
import { pageMetadata } from '@/lib/seo/page-metadata';

export const revalidate = 86400;

export default async function HistoricalSkill({
  params,
}: {
  params: Promise<{ season: string; gsisId: string }>;
}) {
  const { season: seasonSegment, gsisId } = await params;
  const season = await requireHistoricalSeason(seasonSegment, `/players/skill/${gsisId}`);
  return <SkillPlayerPage gsisId={gsisId} season={season} historical={true} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string; gsisId: string }>;
}): Promise<Metadata> {
  const { season: seasonSegment, gsisId } = await params;
  const season = parseSeasonParam(seasonSegment);
  if (season == null) return {};
  const [player, usage] = await Promise.all([
    getPlayer(gsisId, season),
    getSkillUsage(gsisId, { season }),
  ]);
  if (!player) return {};
  const position = usage?.position ?? player.position ?? 'Skill';
  return pageMetadata({
    title: `${player.displayName} · ${position} · ${season}`,
    description: `${player.displayName} skill-position deep dive — ${season} season.`,
    og: {
      title: player.displayName,
      eyebrow: `${position.toUpperCase()} · ${season}`,
    },
    canonical: `/players/skill/${gsisId}?season=${season}`,
    noindex: usage == null,
  });
}
