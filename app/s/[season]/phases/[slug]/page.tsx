import { notFound } from 'next/navigation';
import { isValidPhase, type Phase } from '@/lib/constants/phases';
import { PhaseDetailPage } from '@/components/pages/PhaseDetailPage';
import { requireHistoricalSeason } from '@/lib/season-route';

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
