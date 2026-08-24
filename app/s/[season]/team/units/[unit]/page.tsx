import { notFound } from 'next/navigation';
import { isValidUnitSlug, type UnitSlug } from '@/lib/constants/units';
import { UnitPage } from '@/components/pages/UnitPage';
import { requireHistoricalSeason } from '@/lib/season-route';
import type { Metadata } from 'next';
import { UNIT_DISPLAY_NAMES } from '@/lib/constants/units';
import { parseSeasonParam } from '@/lib/season-view';
import { pageMetadata } from '@/lib/seo/page-metadata';

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string; unit: string }>;
}): Promise<Metadata> {
  const { season: seasonSegment, unit } = await params;
  const season = parseSeasonParam(seasonSegment);
  if (season == null || !isValidUnitSlug(unit)) return {};
  const display = UNIT_DISPLAY_NAMES[unit];
  return pageMetadata({
    title: `${display} unit · ${season}`,
    description: `Patriots ${display.toLowerCase()} unit in ${season}: team-level aggregates — pressure, coverage EPA, run-stop, explosive rates.`,
    og: {
      title: `${display} unit`,
      eyebrow: `TEAM UNITS · ${season}`,
    },
    canonical: `/team/units/${unit}?season=${season}`,
  });
}
