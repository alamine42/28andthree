import { QbDeepDivePage } from '@/components/pages/QbDeepDivePage';
import { resolveSeasonSegment, seasonCanonical } from '@/lib/season-route';
import type { Metadata } from 'next';
import { getPlayer, getQbDeepDive } from '@/lib/data/player';
import { formatEpa } from '@/lib/format/number';
import { pageMetadata } from '@/lib/seo/page-metadata';

export const revalidate = 3600;

export default async function HistoricalQb({
  params,
}: {
  params: Promise<{ season: string; gsisId: string }>;
}) {
  const { season: seasonSegment, gsisId } = await params;
  const { season, historical } = await resolveSeasonSegment(seasonSegment);
  return <QbDeepDivePage gsisId={gsisId} season={season} historical={historical} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string; gsisId: string }>;
}): Promise<Metadata> {
  const { season: seasonSegment, gsisId } = await params;
  const view = await resolveSeasonSegment(seasonSegment);
  const { season } = view;
  const [player, deepDive] = await Promise.all([
    getPlayer(gsisId, season),
    getQbDeepDive(gsisId, season),
  ]);
  if (!player) return {};
  const epa = deepDive?.epaPerDropback;
  return pageMetadata({
    title: `${player.displayName} · QB · ${season}`,
    description: `${player.displayName} quarterback deep dive — ${season} season.`,
    og: {
      title: player.displayName,
      eyebrow: `QB · ${season}`,
      stat: epa != null ? `${formatEpa(epa)} EPA/dropback` : undefined,
    },
    canonical: seasonCanonical(`/players/qb/${gsisId}`, view),
    // Blank-shell renders are thin near-duplicates — noindex (plan §3.7).
    noindex: deepDive == null,
  });
}
