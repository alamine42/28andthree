import { TeamOverviewPage } from '@/components/pages/TeamOverviewPage';
import { resolveSeasonSegment, seasonCanonical } from '@/lib/season-route';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/page-metadata';

// E11: internal route for season-scoped views — reached only via the
// middleware rewrite of /?season=YYYY. Historical data is immutable, so a
// day would do, but this tree also renders the current season (#25), and
// the fallback TTL has to match the clean route's hour: the ETL flush
// skips silently when REVALIDATE_TOKEN is unset (runbook "Failure mode to
// watch for"), and on those runs a longer TTL would leave ?season=current
// behind its own canonical URL. Flushing an immutable archive page hourly
// costs one re-render; disagreeing with the canonical page costs trust.
export const revalidate = 3600;

export default async function HistoricalHome({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season, historical } = await resolveSeasonSegment((await params).season);
  return <TeamOverviewPage season={season} historical={historical} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string }>;
}): Promise<Metadata> {
  const view = await resolveSeasonSegment((await params).season);
  const { season, historical } = view;
  return pageMetadata({
    // Unlike the index route, this deeper segment DOES get the root
    // title.template — no explicit brand suffix here.
    title: `New England, ${season} in one page`,
    description: historical
      ? `League rank across every phase of play for the ${season} New England Patriots, weekly trends, and results. The complete season, archived.`
      : `League rank across every phase of play for the ${season} New England Patriots, weekly trends, and recent results. Advanced analytics for fans who read the box score twice.`,
    og: {
      title: `New England, ${season} in one page`,
      eyebrow: `TEAM · ${season} SEASON${historical ? ' · FINAL' : ''}`,
    },
    // Historical pages are distinct archive content: self-canonical in the
    // public ?season= form (plan §3.7). The current season points at the
    // clean path instead — same page, one canonical URL.
    canonical: seasonCanonical('/', view),
  });
}
