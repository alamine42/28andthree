import type { Metadata } from 'next';
import { PlayersHubPage } from '@/components/pages/PlayersHubPage';
import { pageMetadata } from '@/lib/seo/page-metadata';

// E11: this route never reads searchParams — historical rosters arrive via
// the middleware rewrite to /s/[season]/players (plan §3.1).
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: 'Players',
  description:
    'Every player on the current-season Patriots roster. Click through for QB, skill-position, and unit-level deep dives.',
  og: {
    title: 'Patriots, the whole roster',
    eyebrow: 'PLAYERS',
  },
  canonical: '/players',
});

export default async function CleanPlayersHubPage() {
  return <PlayersHubPage season={null} historical={false} />;
}
