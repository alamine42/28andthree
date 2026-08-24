import { QbDeepDivePage } from '@/components/pages/QbDeepDivePage';
import { requireHistoricalSeason } from '@/lib/season-route';

export const revalidate = 86400;

export default async function HistoricalQb({
  params,
}: {
  params: Promise<{ season: string; gsisId: string }>;
}) {
  const { season: seasonSegment, gsisId } = await params;
  const season = await requireHistoricalSeason(seasonSegment, `/players/qb/${gsisId}`);
  return <QbDeepDivePage gsisId={gsisId} season={season} historical={true} />;
}
