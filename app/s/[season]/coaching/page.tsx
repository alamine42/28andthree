import { CoachingPage } from '@/components/pages/CoachingPage';
import { requireHistoricalSeason } from '@/lib/season-route';

export const revalidate = 86400;

export default async function HistoricalCoaching({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const season = await requireHistoricalSeason((await params).season, '/coaching');
  return <CoachingPage season={season} historical={true} />;
}
