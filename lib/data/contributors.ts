import { and, desc, eq, sql } from 'drizzle-orm';
import type { Phase } from '@/lib/constants/phases';
import { players, qbSeason, skillSeason } from '@/db/schema';
import { getDb } from '@/lib/db';

export type ContributorCard = {
  gsisId: string;
  displayName: string;
  position: string | null;
  headshotUrl: string | null;
  primaryStat: string;
  primaryStatLabel: string;
  role: 'qb' | 'skill' | 'unit';
};

/** Return top N contributors for a phase. Offensive phases have named
 * players (QB or skill). Defensive + special-teams phases fall back to a
 * single unit card that links to /team/units/<slug>. Review finding #5. */
export async function getTopContributors(
  phase: Phase,
  team: string,
  season: number,
  limit = 3,
): Promise<ContributorCard[]> {
  const db = getDb();
  if (!db) return [];

  switch (phase) {
    case 'pass_offense':
    case 'third_down_offense':
    case 'overall':
      return topQbs(db, team, season, limit);
    case 'rush_offense':
      return topRushers(db, team, season, limit);
    case 'redzone_offense':
    case 'explosive_offense':
      return topReceivers(db, team, season, limit, phase === 'redzone_offense');
    default:
      // Defensive / special teams: unit card fallback (§3.3 defers per-defender).
      return unitFallback(phase);
  }
}

type DbClient = NonNullable<ReturnType<typeof getDb>>;

async function topQbs(
  db: DbClient,
  team: string,
  season: number,
  limit: number,
): Promise<ContributorCard[]> {
  const rows = await db
    .select({
      gsisId: qbSeason.gsisId,
      dropbacks: qbSeason.dropbacks,
      epa: qbSeason.epaPerDropback,
      displayName: players.displayName,
      position: players.position,
      headshotUrl: players.headshotUrl,
    })
    .from(qbSeason)
    .innerJoin(players, eq(players.gsisId, qbSeason.gsisId))
    .where(and(eq(qbSeason.team, team), eq(qbSeason.season, season)))
    .orderBy(desc(qbSeason.dropbacks))
    .limit(limit);

  return rows.map((r) => ({
    gsisId: r.gsisId,
    displayName: r.displayName,
    position: r.position,
    headshotUrl: r.headshotUrl,
    primaryStat: r.epa != null ? `${r.epa >= 0 ? '+' : '−'}${Math.abs(r.epa).toFixed(2)}` : '—',
    primaryStatLabel: 'EPA/dropback',
    role: 'qb',
  }));
}

async function topRushers(
  db: DbClient,
  team: string,
  season: number,
  limit: number,
): Promise<ContributorCard[]> {
  const rows = await db
    .select({
      gsisId: skillSeason.gsisId,
      carries: skillSeason.carries,
      ypc: skillSeason.ypc,
      displayName: players.displayName,
      position: players.position,
      headshotUrl: players.headshotUrl,
    })
    .from(skillSeason)
    .innerJoin(players, eq(players.gsisId, skillSeason.gsisId))
    .where(and(
      eq(skillSeason.team, team),
      eq(skillSeason.season, season),
      sql`${skillSeason.carries} IS NOT NULL AND ${skillSeason.carries} > 0`,
    ))
    .orderBy(desc(skillSeason.carries))
    .limit(limit);

  return rows.map((r) => ({
    gsisId: r.gsisId,
    displayName: r.displayName,
    position: r.position,
    headshotUrl: r.headshotUrl,
    primaryStat: r.ypc != null ? r.ypc.toFixed(1) + ' ypc' : '—',
    primaryStatLabel: `${r.carries} carries`,
    role: 'skill',
  }));
}

async function topReceivers(
  db: DbClient,
  team: string,
  season: number,
  limit: number,
  redzone: boolean,
): Promise<ContributorCard[]> {
  const orderCol = redzone ? skillSeason.redzoneTargets : skillSeason.targets;
  const rows = await db
    .select({
      gsisId: skillSeason.gsisId,
      targets: skillSeason.targets,
      targetShare: skillSeason.targetShare,
      redzoneTargets: skillSeason.redzoneTargets,
      displayName: players.displayName,
      position: players.position,
      headshotUrl: players.headshotUrl,
    })
    .from(skillSeason)
    .innerJoin(players, eq(players.gsisId, skillSeason.gsisId))
    .where(and(
      eq(skillSeason.team, team),
      eq(skillSeason.season, season),
      sql`${orderCol} IS NOT NULL AND ${orderCol} > 0`,
    ))
    .orderBy(desc(orderCol))
    .limit(limit);

  return rows.map((r) => ({
    gsisId: r.gsisId,
    displayName: r.displayName,
    position: r.position,
    headshotUrl: r.headshotUrl,
    primaryStat: redzone
      ? `${r.redzoneTargets ?? '—'} RZ targets`
      : r.targetShare != null ? Math.round(r.targetShare * 100) + '%' : '—',
    primaryStatLabel: redzone ? 'Red-zone usage' : 'Target share',
    role: 'skill',
  }));
}

function unitFallback(_phase: Phase): ContributorCard[] {
  // Single synthetic "card" that the phase page renders as a link to the
  // unit. Keeps phase pages visually balanced even when we can't credit
  // individual defenders (SPEC §3.3).
  return [
    {
      gsisId: '',
      displayName: 'Unit metrics',
      position: null,
      headshotUrl: null,
      primaryStat: 'See team page →',
      primaryStatLabel: 'Defensive unit',
      role: 'unit',
    },
  ];
}
