import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidPhase, type Phase } from '@/lib/constants/phases';
import { phaseDisplayName } from '@/lib/format/phase';
import { getCurrentSeason } from '@/lib/data/current-season';
import { getPhaseDetail } from '@/lib/data/phases';
import { formatEpa } from '@/lib/format/number';
import { PhaseDetailPage } from '@/components/pages/PhaseDetailPage';
import { pageMetadata } from '@/lib/seo/page-metadata';

// E11: this route never reads searchParams — historical views arrive via
// the middleware rewrite to /s/[season]/phases/[slug] (plan §3.1), so the
// clean URL stays static/ISR.
export const revalidate = 3600;

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  // Pre-render the 12 known phases for SSG path hints.
  const { PHASES } = await import('@/lib/constants/phases');
  return PHASES.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidPhase(slug)) return {};
  const phase = slug as Phase;
  const display = phaseDisplayName(phase);
  const season = await getCurrentSeason();
  const detail = await getPhaseDetail(phase, 'NE', season);
  const rank = detail?.rank != null ? String(detail.rank).padStart(2, '0') : undefined;
  const epa = detail?.epaPerPlay != null ? formatEpa(detail.epaPerPlay) : null;

  return pageMetadata({
    title: display,
    description: `Patriots ${display.toLowerCase()} rank and EPA per play, season-to-date ${season} against the 32-team league, with weekly trend and top contributors.`,
    og: {
      title: display,
      eyebrow: `PHASES · ${season}`,
      rank,
      stat: epa ? `${epa} EPA/play` : undefined,
    },
    canonical: `/phases/${slug}`,
  });
}

export default async function CleanPhaseDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  if (!isValidPhase(slug)) notFound();
  const season = await getCurrentSeason();
  return <PhaseDetailPage phase={slug as Phase} season={season} historical={false} />;
}
