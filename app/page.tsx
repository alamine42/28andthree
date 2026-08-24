import type { Metadata } from 'next';
import { TeamOverviewPage } from '@/components/pages/TeamOverviewPage';
import { getSeasonContext } from '@/lib/data/current-season';
import { pageMetadata } from '@/lib/seo/page-metadata';

// Fallback TTL if on-demand revalidation misses (one hour — plan §3.2).
// E11: this route never reads searchParams — historical views arrive via
// the middleware rewrite to /s/[season] (plan §3.1), so the clean URL
// stays static/ISR.
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { season } = await getSeasonContext();
  return pageMetadata({
    // Explicit brand suffix: Next's title.template from the root layout
    // isn't applied to generateMetadata() return values on the index route
    // in Next 16 (it works fine on deeper segments like /phases/[slug]).
    title: `New England, ${season} in one page · 28 and Three`,
    description: `League rank across every phase of play for the ${season} New England Patriots, weekly trends, and recent results. Advanced analytics for fans who read the box score twice.`,
    og: {
      title: `New England, ${season} in one page`,
      eyebrow: `TEAM · ${season} SEASON`,
    },
    canonical: '/',
  });
}

export default async function HomePage() {
  const { season } = await getSeasonContext();
  return <TeamOverviewPage season={season} historical={false} />;
}
