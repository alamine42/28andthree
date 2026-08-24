import { CoachingPage } from '@/components/pages/CoachingPage';
import { requireHistoricalSeason } from '@/lib/season-route';
import type { Metadata } from 'next';
import { parseSeasonParam } from '@/lib/season-view';
import { pageMetadata } from '@/lib/seo/page-metadata';

export const revalidate = 86400;

export default async function HistoricalCoaching({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const season = await requireHistoricalSeason((await params).season, '/coaching');
  return <CoachingPage season={season} historical={true} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string }>;
}): Promise<Metadata> {
  const season = parseSeasonParam((await params).season);
  if (season == null) return {};
  return pageMetadata({
    title: `Coaching tendencies · ${season}`,
    description: `Patriots ${season} coaching: play-call splits by down, situational rates, score-state pressure, personnel groupings, blitz rate, and the 4th-down ledger.`,
    og: {
      title: 'Patriots coaching, the tendencies that decide games',
      eyebrow: `COACHING · ${season}`,
    },
    canonical: `/coaching?season=${season}`,
  });
}
