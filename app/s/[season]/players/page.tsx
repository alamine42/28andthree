import { PlayersHubPage } from '@/components/pages/PlayersHubPage';
import { requireHistoricalSeason } from '@/lib/season-route';
import type { Metadata } from 'next';
import { parseSeasonParam } from '@/lib/season-view';
import { pageMetadata } from '@/lib/seo/page-metadata';

export const revalidate = 86400;

export default async function HistoricalPlayersHub({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const season = await requireHistoricalSeason((await params).season, '/players');
  return <PlayersHubPage season={season} historical={true} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string }>;
}): Promise<Metadata> {
  const season = parseSeasonParam((await params).season);
  if (season == null) return {};
  return pageMetadata({
    title: `Players · ${season}`,
    description: `Every player on the ${season} Patriots roster, with deep dives for quarterbacks and skill positions.`,
    og: {
      title: 'Patriots, the whole roster',
      eyebrow: `PLAYERS · ${season}`,
    },
    canonical: `/players?season=${season}`,
  });
}
