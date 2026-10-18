import { SkillPlayerPage } from '@/components/pages/SkillPlayerPage';
import { resolveSeasonSegment, seasonCanonical } from '@/lib/season-route';
import type { Metadata } from 'next';
import { getPlayer, getSkillUsage } from '@/lib/data/player';
import { pageMetadata } from '@/lib/seo/page-metadata';

export const revalidate = 86400;

export default async function HistoricalSkill({
  params,
}: {
  params: Promise<{ season: string; gsisId: string }>;
}) {
  const { season: seasonSegment, gsisId } = await params;
  const { season, historical } = await resolveSeasonSegment(seasonSegment);
  return <SkillPlayerPage gsisId={gsisId} season={season} historical={historical} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string; gsisId: string }>;
}): Promise<Metadata> {
  const { season: seasonSegment, gsisId } = await params;
  const view = await resolveSeasonSegment(seasonSegment);
  const { season } = view;
  const [player, usage] = await Promise.all([
    getPlayer(gsisId, season),
    getSkillUsage(gsisId, season),
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
    canonical: seasonCanonical(`/players/skill/${gsisId}`, view),
    noindex: usage == null,
  });
}
