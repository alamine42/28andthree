import { CoachingPage } from '@/components/pages/CoachingPage';
import { requireHistoricalSeason } from '@/lib/season-route';
import type { Metadata } from 'next';
import { getCoachSegments } from '@/lib/data/coaching';
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
  // Empty archive shells are thin near-duplicates — noindex, matching the
  // player wrappers (code review pass 1). getCoachSegments is React-cached,
  // so the page body's fetch is deduped.
  const segments = await getCoachSegments('NE', season);
  return pageMetadata({
    title: `Coaching tendencies · ${season}`,
    description: `Patriots ${season} coaching: play-call splits by down, situational rates, score-state pressure, personnel groupings, blitz rate, and a 4th-down ledger vs. the nfl4th model.`,
    og: {
      title: 'Patriots coaching, the tendencies that decide games',
      eyebrow: `COACHING · ${season}`,
    },
    canonical: `/coaching?season=${season}`,
    noindex: segments.length === 0,
  });
}
