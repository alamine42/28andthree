import { PlayersHubPage } from '@/components/pages/PlayersHubPage';
import { resolveSeasonSegment, seasonCanonical } from '@/lib/season-route';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/page-metadata';

export const revalidate = 86400;

export default async function HistoricalPlayersHub({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season, historical } = await resolveSeasonSegment((await params).season);
  // The hub reads its own roster season when not historical (the roster max
  // stays correct through the preseason transition), so the current view
  // takes season={null} exactly as the clean route does.
  return historical ? (
    <PlayersHubPage season={season} historical={true} />
  ) : (
    <PlayersHubPage season={null} historical={false} />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string }>;
}): Promise<Metadata> {
  const view = await resolveSeasonSegment((await params).season);
  const { season, historical } = view;
  return pageMetadata({
    title: `Players · ${season}`,
    description: historical
      ? `Every player on the ${season} Patriots roster, with deep dives for quarterbacks and skill positions.`
      : `Every player on the current-season Patriots roster. Click through for QB, skill-position, and unit-level deep dives.`,
    og: {
      title: 'Patriots, the whole roster',
      eyebrow: `PLAYERS · ${season}`,
    },
    canonical: seasonCanonical('/players', view),
  });
}
