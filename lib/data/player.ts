import { and, eq, desc } from 'drizzle-orm';
import {
  players,
  qbSeason,
  qbWeekly,
  rosterSnapshots,
  skillSeason,
  skillWeekly,
} from '@/db/schema';
import { getDb } from '@/lib/db';

export type PlayerIdentity = {
  gsisId: string;
  displayName: string;
  position: string | null;
  team: string | null;
  jerseyNumber: number | null;
  headshotUrl: string | null;
};

/** Resolve a player's identity for a given season. Prefers roster_snapshots
 * (season-correct team/jersey); falls back to players.current_* only if no
 * snapshot exists. Review finding #12. */
export async function getPlayer(
  gsisId: string,
  season?: number,
): Promise<PlayerIdentity | null> {
  const db = getDb();
  if (!db) return null;

  if (season !== undefined) {
    const [snap] = await db
      .select()
      .from(rosterSnapshots)
      .where(and(eq(rosterSnapshots.gsisId, gsisId), eq(rosterSnapshots.season, season)))
      .limit(1);
    if (snap) {
      return {
        gsisId: snap.gsisId,
        displayName: snap.displayName,
        position: snap.position,
        team: snap.team,
        jerseyNumber: snap.jerseyNumber,
        headshotUrl: snap.headshotUrl,
      };
    }
  }

  const [row] = await db.select().from(players).where(eq(players.gsisId, gsisId)).limit(1);
  if (!row) return null;
  return {
    gsisId: row.gsisId,
    displayName: row.displayName,
    position: row.position,
    team: row.currentTeam,
    jerseyNumber: row.currentJerseyNumber,
    headshotUrl: row.headshotUrl,
  };
}

// ---- QB deep dive -----------------------------------------------------------

export type QbDeepDive = {
  season: number;
  team: string;
  gamesPlayed: number;
  primaryStarterGames: number;
  dropbacks: number;
  attempts: number;
  completions: number;
  yards: number;
  epaPerDropback: number | null;
  cpoe: number | null;
  adot: number | null;
  successRate: number | null;
  pressureRate: number | null;
  cleanPocketEpaPerDropback: number | null;
  pressuredEpaPerDropback: number | null;
  deepEpaPerAttempt: number | null;
  weekly: QbWeeklyPoint[];
};

export type QbWeeklyPoint = {
  week: number;
  team: string;
  dropbacks: number;
  epaPerDropback: number | null;
  primaryStarter: boolean;
};

export async function getQbDeepDive(
  gsisId: string,
  opts: { season: number; primaryStarterOnly?: boolean; team?: string },
): Promise<QbDeepDive | null> {
  const db = getDb();
  if (!db) return null;

  const where = [eq(qbSeason.gsisId, gsisId), eq(qbSeason.season, opts.season)];
  if (opts.team) where.push(eq(qbSeason.team, opts.team));

  const [s] = await db.select().from(qbSeason).where(and(...where)).limit(1);
  if (!s) return null;

  const weeklyWhere = [
    eq(qbWeekly.gsisId, gsisId),
    eq(qbWeekly.season, opts.season),
  ];
  if (opts.team) weeklyWhere.push(eq(qbWeekly.team, opts.team));
  if (opts.primaryStarterOnly) weeklyWhere.push(eq(qbWeekly.primaryStarter, true));

  const weekly = await db
    .select({
      week: qbWeekly.week,
      team: qbWeekly.team,
      dropbacks: qbWeekly.dropbacks,
      epaPerDropback: qbWeekly.epaPerDropback,
      primaryStarter: qbWeekly.primaryStarter,
    })
    .from(qbWeekly)
    .where(and(...weeklyWhere))
    .orderBy(qbWeekly.week);

  return {
    season: s.season,
    team: s.team,
    gamesPlayed: s.gamesPlayed,
    primaryStarterGames: s.primaryStarterGames,
    dropbacks: s.dropbacks,
    attempts: s.attempts,
    completions: s.completions,
    yards: s.yards,
    epaPerDropback: s.epaPerDropback,
    cpoe: s.cpoe,
    adot: s.adot,
    successRate: s.successRate,
    pressureRate: s.pressureRate,
    cleanPocketEpaPerDropback: s.cleanPocketEpaPerDropback,
    pressuredEpaPerDropback: s.pressuredEpaPerDropback,
    deepEpaPerAttempt: s.deepEpaPerAttempt,
    weekly,
  };
}

/** Current-season primary starter for a team. Used by /players/qb without an
 * id (e.g., "who is the Pats' QB?"). */
export async function getCurrentStarter(
  team: string,
  season: number,
): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({ gsisId: qbSeason.gsisId })
    .from(qbSeason)
    .where(and(eq(qbSeason.team, team), eq(qbSeason.season, season)))
    .orderBy(desc(qbSeason.primaryStarterGames))
    .limit(1);
  return row?.gsisId ?? null;
}

// ---- Skill usage -----------------------------------------------------------

export type SkillUsage = {
  season: number;
  team: string;
  position: string;
  gamesPlayed: number;
  targets: number | null;
  receptions: number | null;
  yardsReceiving: number | null;
  yacTotal: number | null;
  yacPerReception: number | null;
  targetShare: number | null;
  adotOnTargets: number | null;
  redzoneTargets: number | null;
  redzoneReceptions: number | null;
  carries: number | null;
  yardsRushing: number | null;
  ypc: number | null;
  weekly: SkillWeeklyPoint[];
};

export type SkillWeeklyPoint = {
  week: number;
  team: string;
  targets: number | null;
  receptions: number | null;
  carries: number | null;
  yardsReceiving: number | null;
};

export async function getSkillUsage(
  gsisId: string,
  opts: { season: number; team?: string },
): Promise<SkillUsage | null> {
  const db = getDb();
  if (!db) return null;

  const where = [eq(skillSeason.gsisId, gsisId), eq(skillSeason.season, opts.season)];
  if (opts.team) where.push(eq(skillSeason.team, opts.team));

  // Explicit column list: the E5-04a migration adds epaReceiving/epaRushing
  // which the skill page doesn't consume yet. Listing only what we need
  // keeps the build green pre-migration.
  const [s] = await db
    .select({
      season: skillSeason.season,
      team: skillSeason.team,
      position: skillSeason.position,
      gamesPlayed: skillSeason.gamesPlayed,
      targets: skillSeason.targets,
      receptions: skillSeason.receptions,
      yardsReceiving: skillSeason.yardsReceiving,
      yacTotal: skillSeason.yacTotal,
      yacPerReception: skillSeason.yacPerReception,
      targetShare: skillSeason.targetShare,
      adotOnTargets: skillSeason.adotOnTargets,
      redzoneTargets: skillSeason.redzoneTargets,
      redzoneReceptions: skillSeason.redzoneReceptions,
      carries: skillSeason.carries,
      yardsRushing: skillSeason.yardsRushing,
      ypc: skillSeason.ypc,
    })
    .from(skillSeason)
    .where(and(...where))
    .limit(1);
  if (!s) return null;

  const weeklyWhere = [eq(skillWeekly.gsisId, gsisId), eq(skillWeekly.season, opts.season)];
  if (opts.team) weeklyWhere.push(eq(skillWeekly.team, opts.team));

  const weekly = await db
    .select({
      week: skillWeekly.week,
      team: skillWeekly.team,
      targets: skillWeekly.targets,
      receptions: skillWeekly.receptions,
      carries: skillWeekly.carries,
      yardsReceiving: skillWeekly.yardsReceiving,
    })
    .from(skillWeekly)
    .where(and(...weeklyWhere))
    .orderBy(skillWeekly.week);

  return {
    season: s.season,
    team: s.team,
    position: s.position,
    gamesPlayed: s.gamesPlayed,
    targets: s.targets,
    receptions: s.receptions,
    yardsReceiving: s.yardsReceiving,
    yacTotal: s.yacTotal,
    yacPerReception: s.yacPerReception,
    targetShare: s.targetShare,
    adotOnTargets: s.adotOnTargets,
    redzoneTargets: s.redzoneTargets,
    redzoneReceptions: s.redzoneReceptions,
    carries: s.carries,
    yardsRushing: s.yardsRushing,
    ypc: s.ypc,
    weekly,
  };
}
