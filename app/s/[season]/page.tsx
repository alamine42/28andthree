import { TeamOverviewPage } from '@/components/pages/TeamOverviewPage';
import { requireHistoricalSeason } from '@/lib/season-route';
import type { Metadata } from 'next';
import { parseSeasonParam } from '@/lib/season-view';
import { pageMetadata } from '@/lib/seo/page-metadata';

// E11: internal historical route — reached only via the middleware
// rewrite of /?season=YYYY. Immutable data: cache for a day; the ETL
// revalidation flush covers rollover (plan §3.1, §3.3).
export const revalidate = 86400;

export default async function HistoricalHome({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const season = await requireHistoricalSeason((await params).season, '/');
  return <TeamOverviewPage season={season} historical={true} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string }>;
}): Promise<Metadata> {
  const season = parseSeasonParam((await params).season);
  if (season == null) return {};
  return pageMetadata({
    // Unlike the index route, this deeper segment DOES get the root
    // title.template — no explicit brand suffix here.
    title: `New England, ${season} in one page`,
    description: `League rank across every phase of play for the ${season} New England Patriots, weekly trends, and results. The complete season, archived.`,
    og: {
      title: `New England, ${season} in one page`,
      eyebrow: `TEAM · ${season} SEASON · FINAL`,
    },
    // Historical pages are distinct archive content: self-canonical in the
    // public ?season= form (plan §3.7).
    canonical: `/?season=${season}`,
  });
}
