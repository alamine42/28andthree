import { SkillPlayerPage } from '@/components/pages/SkillPlayerPage';
import { requireHistoricalSeason } from '@/lib/season-route';

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
