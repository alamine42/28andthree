import { PlayersHubPage } from '@/components/pages/PlayersHubPage';
import { requireHistoricalSeason } from '@/lib/season-route';

export const revalidate = 86400;

export default async function HistoricalPlayersHub({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const season = await requireHistoricalSeason((await params).season, '/players');
  return <PlayersHubPage season={season} historical={true} />;
}
