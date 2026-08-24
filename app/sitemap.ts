import type { MetadataRoute } from 'next';
import { PHASES } from '@/lib/constants/phases';
import { UNIT_SLUGS } from '@/lib/constants/units';
import { getSeasonContext } from '@/lib/data/current-season';
import { getLatestStatsSeason } from '@/lib/data/stats-season';
import { EARLIEST_SEASON } from '@/lib/season-view';
import { getDb } from '@/lib/db';
import { qbSeason, skillSeason } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

// Sitemap is generated at build time (or at the next ISR revalidation).
// Excludes internal routes (/status, /tokens, /og, /api/*) — those are
// marked noindex at the page level per E6-03 and don't need crawler hints.

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ?? 'https://28andthree.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const fixed: MetadataRoute.Sitemap = [
    entry('/', now, 'daily', 1.0),
    entry('/players', now, 'weekly', 0.8),
    entry('/draft-roi', now, 'weekly', 0.7),
    entry('/coaching', now, 'weekly', 0.8),
    entry('/methodology', now, 'monthly', 0.5),
    ...PHASES.map((slug) => entry(`/phases/${slug}`, now, 'daily', 0.9)),
    ...UNIT_SLUGS.map((slug) => entry(`/team/units/${slug}`, now, 'weekly', 0.6)),
  ];

  const playerRoutes = await listPlayerRoutes();
  const historicalRoutes = await listHistoricalRoutes();
  return [...fixed, ...historicalRoutes, ...playerRoutes];
}

/** E11 (plan §3.7): team-level historical URLs in the public ?season=
 * form, for every completed season below current. Player historical URLs
 * stay out (thin-content risk). */
async function listHistoricalRoutes(): Promise<MetadataRoute.Sitemap> {
  try {
    const { season: current } = await getSeasonContext();
    const now = new Date();
    const out: MetadataRoute.Sitemap = [];
    for (let s = EARLIEST_SEASON; s < current; s++) {
      out.push(entry(`/?season=${s}`, now, 'yearly', 0.4));
      out.push(entry(`/coaching?season=${s}`, now, 'yearly', 0.3));
      for (const slug of PHASES) out.push(entry(`/phases/${slug}?season=${s}`, now, 'yearly', 0.3));
      for (const slug of UNIT_SLUGS) out.push(entry(`/team/units/${slug}?season=${s}`, now, 'yearly', 0.2));
    }
    return out;
  } catch {
    return [];
  }
}

async function listPlayerRoutes(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();
  if (!db) return [];
  // Latest season WITH stats — not the display season (plan §3.7).
  const season = await getLatestStatsSeason();
  if (season == null) return [];

  // Current-season Pats roster only — not all 480 league-wide players.
  try {
    const [qbs, skill] = await Promise.all([
      db
        .select({ gsisId: qbSeason.gsisId })
        .from(qbSeason)
        .where(and(eq(qbSeason.team, 'NE'), eq(qbSeason.season, season))),
      db
        .select({ gsisId: skillSeason.gsisId })
        .from(skillSeason)
        .where(and(eq(skillSeason.team, 'NE'), eq(skillSeason.season, season))),
    ]);
    const now = new Date();
    return [
      ...qbs.map((r) => entry(`/players/qb/${r.gsisId}`, now, 'weekly', 0.6)),
      ...skill.map((r) => entry(`/players/skill/${r.gsisId}`, now, 'weekly', 0.5)),
    ];
  } catch {
    // Pre-ETL or DB unreachable: return nothing instead of crashing the
    // sitemap build. Fixed routes are enough to pass the ≥ 25 URL acceptance
    // once the roster seeds.
    return [];
  }
}

function entry(
  path: string,
  lastModified: Date,
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>,
  priority: number,
): MetadataRoute.Sitemap[number] {
  return {
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency,
    priority,
  };
}
