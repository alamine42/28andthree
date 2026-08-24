import { notFound } from 'next/navigation';
import { isValidPhase, type Phase } from '@/lib/constants/phases';
import { PhaseDetailPage } from '@/components/pages/PhaseDetailPage';
import { requireHistoricalSeason } from '@/lib/season-route';
import type { Metadata } from 'next';
import { phaseDisplayName } from '@/lib/format/phase';
import { getPhaseDetail } from '@/lib/data/phases';
import { formatEpa } from '@/lib/format/number';
import { parseSeasonParam } from '@/lib/season-view';
import { pageMetadata } from '@/lib/seo/page-metadata';

export const revalidate = 86400;

export default async function HistoricalPhaseDetail({
  params,
}: {
  params: Promise<{ season: string; slug: string }>;
}) {
  const { season: seasonSegment, slug } = await params;
  if (!isValidPhase(slug)) notFound();
  const season = await requireHistoricalSeason(seasonSegment, `/phases/${slug}`);
  return <PhaseDetailPage phase={slug as Phase} season={season} historical={true} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string; slug: string }>;
}): Promise<Metadata> {
  const { season: seasonSegment, slug } = await params;
  const season = parseSeasonParam(seasonSegment);
  if (season == null || !isValidPhase(slug)) return {};
  const display = phaseDisplayName(slug as Phase);
  const detail = await getPhaseDetail(slug as Phase, 'NE', season);
  const rank = detail?.rank != null ? String(detail.rank).padStart(2, '0') : undefined;
  const epa = detail?.epaPerPlay != null ? formatEpa(detail.epaPerPlay) : null;
  return pageMetadata({
    title: `${display} · ${season}`,
    description: `Patriots ${display.toLowerCase()} in ${season}: final rank and EPA per play against the 32-team league, weekly trend, top contributors.`,
    og: {
      title: display,
      eyebrow: `PHASES · ${season}`,
      rank,
      stat: epa ? `${epa} EPA/play` : undefined,
    },
    canonical: `/phases/${slug}?season=${season}`,
  });
}
