import { and, eq, sql } from 'drizzle-orm';
import { rosterSnapshots } from '@/db/schema';
import { getDb } from '@/lib/db';
import {
  categoryFor,
  roleFor,
  type PlayerCategory,
  type PlayerRole,
} from '@/lib/format/player-routes';

export type RosterEntry = {
  gsisId: string;
  displayName: string;
  position: string | null;
  jerseyNumber: number | null;
  headshotUrl: string | null;
  role: PlayerRole;
  category: PlayerCategory;
};

// Stable sort order for the roster grid: QB → RB → WR/TE → OL → DL → LB/DB →
// ST → unknown. Matches how a fan scans a depth chart.
const ROLE_SORT: Readonly<Record<PlayerRole, number>> = {
  qb: 0,
  skill: 1,
  ol: 2,
  dline: 3,
  defense: 4,
  special: 5,
};

/** Latest season the roster ETL has populated for a given team. Avoids
 *  `getCurrentSeason()` which keys off `team_phase_weekly` and goes stale
 *  between the preseason ETL run and the week-1 snap (review finding #8). */
export async function getCurrentRosterSeason(team = 'NE'): Promise<number | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select({ season: sql<number>`MAX(${rosterSnapshots.season})::int` })
    .from(rosterSnapshots)
    .where(eq(rosterSnapshots.team, team));
  return rows[0]?.season ?? null;
}

/** Current roster for a given team/season, sorted by role bucket then jersey
 *  number (nulls last). One query, ~53 rows. Status filtering (ACT/PS/IR) is
 *  not available — `roster_snapshots` doesn't carry that column yet; every
 *  row nflverse emits surfaces on the hub (review finding #5). */
export async function getPatsRoster(
  season: number,
  team = 'NE',
): Promise<RosterEntry[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db
    .select({
      gsisId: rosterSnapshots.gsisId,
      displayName: rosterSnapshots.displayName,
      position: rosterSnapshots.position,
      jerseyNumber: rosterSnapshots.jerseyNumber,
      headshotUrl: rosterSnapshots.headshotUrl,
    })
    .from(rosterSnapshots)
    .where(and(eq(rosterSnapshots.team, team), eq(rosterSnapshots.season, season)));

  const entries: RosterEntry[] = rows.map((r) => ({
    gsisId: r.gsisId,
    displayName: r.displayName,
    position: r.position,
    jerseyNumber: r.jerseyNumber,
    headshotUrl: r.headshotUrl,
    role: roleFor(r.position),
    category: categoryFor(r.position),
  }));

  entries.sort((a, b) => {
    const roleDiff = ROLE_SORT[a.role] - ROLE_SORT[b.role];
    if (roleDiff !== 0) return roleDiff;
    const aj = a.jerseyNumber ?? Number.POSITIVE_INFINITY;
    const bj = b.jerseyNumber ?? Number.POSITIVE_INFINITY;
    if (aj !== bj) return aj - bj;
    return a.displayName.localeCompare(b.displayName);
  });

  return entries;
}
