import type { Metadata } from 'next';
import { and, eq } from 'drizzle-orm';
import { qbSeason } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getCurrentSeason } from '@/lib/data/current-season';
import { getPlayer, getQbDeepDive } from '@/lib/data/player';
import { formatEpa } from '@/lib/format/number';
import { pageMetadata } from '@/lib/seo/page-metadata';
import { QbDeepDivePage } from '@/components/pages/QbDeepDivePage';

export const revalidate = 3600;

type Params = Promise<{ gsisId: string }>;

/** Pre-render current-season Pats QBs at build time (plan §3.12: cap
 * pre-render to ~50 players, not 480). Other QBs ISR-on-demand. */
export async function generateStaticParams() {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ gsisId: qbSeason.gsisId })
    .from(qbSeason)
    .where(and(eq(qbSeason.team, 'NE'), eq(qbSeason.season, 2025)));
  return rows.map((r) => ({ gsisId: r.gsisId }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { gsisId } = await params;
  const season = await getCurrentSeason();
  const [player, deepDive] = await Promise.all([
    getPlayer(gsisId, season),
    getQbDeepDive(gsisId, { season }),
  ]);
  if (!player) return {};
  const name = player.displayName;
  const epa = deepDive?.epaPerDropback;
  const stat = epa != null ? `${formatEpa(epa)} EPA/dropback` : undefined;
  return pageMetadata({
    title: `${name} \u00B7 QB`,
    description: `${name} quarterback deep dive: EPA per dropback, CPOE, aDOT, pressure splits, weekly trend \u2014 ${season} season.`,
    og: {
      title: name,
      eyebrow: `QB \u00B7 ${season}`,
      stat,
    },
    canonical: `/players/qb/${gsisId}`,
    // Blank-shell renders (no stats for the viewed season) are thin
    // near-duplicates — keep them out of the index (plan §3.7).
    noindex: deepDive == null,
  });
}

export default async function CleanQbDeepDivePage({ params }: { params: Params }) {
  const { gsisId } = await params;
  const season = await getCurrentSeason();
  return <QbDeepDivePage gsisId={gsisId} season={season} historical={false} />;
}
