import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidUnitSlug, UNIT_DISPLAY_NAMES, UNIT_SLUGS, type UnitSlug } from '@/lib/constants/units';
import { getCurrentSeason } from '@/lib/data/current-season';
import { UnitPage } from '@/components/pages/UnitPage';
import { pageMetadata } from '@/lib/seo/page-metadata';

// E11: this route never reads searchParams — historical views arrive via
// the middleware rewrite to /s/[season]/team/units/[unit] (plan §3.1).
export const revalidate = 3600;

type Params = Promise<{ unit: string }>;

export async function generateStaticParams() {
  return UNIT_SLUGS.map((unit) => ({ unit }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { unit } = await params;
  if (!isValidUnitSlug(unit)) return {};
  const display = UNIT_DISPLAY_NAMES[unit];
  const season = await getCurrentSeason();
  return pageMetadata({
    title: `${display} unit`,
    description: `Patriots ${display.toLowerCase()} unit: team-level aggregates for ${season} — pressure, coverage EPA, run-stop, explosive rates. No individual defender ratings per SPEC \u00A73.3.`,
    og: {
      title: `${display} unit`,
      eyebrow: `TEAM UNITS \u00B7 ${season}`,
    },
    canonical: `/team/units/${unit}`,
  });
}

export default async function CleanUnitPage({ params }: { params: Params }) {
  const { unit } = await params;
  if (!isValidUnitSlug(unit)) notFound();
  const season = await getCurrentSeason();
  return <UnitPage unit={unit as UnitSlug} season={season} historical={false} />;
}
