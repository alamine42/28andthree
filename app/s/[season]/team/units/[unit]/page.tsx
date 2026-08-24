import { notFound } from 'next/navigation';
import { isValidUnitSlug, type UnitSlug } from '@/lib/constants/units';
import { UnitPage } from '@/components/pages/UnitPage';
import { requireHistoricalSeason } from '@/lib/season-route';

export const revalidate = 86400;

export default async function HistoricalUnit({
  params,
}: {
  params: Promise<{ season: string; unit: string }>;
}) {
  const { season: seasonSegment, unit } = await params;
  if (!isValidUnitSlug(unit)) notFound();
  const season = await requireHistoricalSeason(seasonSegment, `/team/units/${unit}`);
  return <UnitPage unit={unit as UnitSlug} season={season} historical={true} />;
}
