import type { Metadata } from 'next';
import { getCurrentSeason } from '@/lib/data/current-season';
import { CoachingPage } from '@/components/pages/CoachingPage';
import { pageMetadata } from '@/lib/seo/page-metadata';

// E11: this route never reads searchParams — historical views arrive via
// the middleware rewrite to /s/[season]/coaching (plan §3.1).
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const season = await getCurrentSeason();
  return pageMetadata({
    title: 'Coaching tendencies',
    description: `Patriots ${season} coaching: play-call splits by down, situational rates, score-state pressure, personnel groupings, blitz rate, and a 4th-down ledger vs. the nfl4th model.`,
    og: {
      title: 'Patriots coaching, the tendencies that decide games',
      eyebrow: `COACHING \u00B7 ${season}`,
    },
    canonical: '/coaching',
  });
}

export default async function CleanCoachingPage() {
  const season = await getCurrentSeason();
  return <CoachingPage season={season} historical={false} />;
}
