import { TeamOverviewPage } from '@/components/pages/TeamOverviewPage';
import { requireHistoricalSeason } from '@/lib/season-route';

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
