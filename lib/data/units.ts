import { and, eq } from 'drizzle-orm';
import {
  teamDefenseSeason, teamDefenseWeekly,
  teamDlSeason, teamDlWeekly,
  teamOlSeason, teamOlWeekly,
} from '@/db/schema';
import { getDb } from '@/lib/db';

export type DefenseUnitStats = {
  pressureRate: number | null;
  coverageEpaAllowed: number | null;
  runStopRate: number | null;
  explosivePlaysAllowed: number | null;
};
export type OlUnitStats = {
  passBlockWinRate: number | null;
  runBlockRate: number | null;
  pressuresAllowed: number | null;
  epaOnDropbacks: number | null;
};
export type DlUnitStats = {
  pressuresGenerated: number | null;
  passRushWinRate: number | null;
  runStopRate: number | null;
  sackRate: number | null;
};

export async function getDefenseUnit(
  team: string,
  season: number,
): Promise<DefenseUnitStats | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(teamDefenseSeason)
    .where(and(eq(teamDefenseSeason.team, team), eq(teamDefenseSeason.season, season)))
    .limit(1);
  if (!row) return null;
  return {
    pressureRate: row.pressureRate,
    coverageEpaAllowed: row.coverageEpaAllowed,
    runStopRate: row.runStopRate,
    explosivePlaysAllowed: row.explosivePlaysAllowed,
  };
}

export async function getOlUnit(team: string, season: number): Promise<OlUnitStats | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(teamOlSeason)
    .where(and(eq(teamOlSeason.team, team), eq(teamOlSeason.season, season)))
    .limit(1);
  if (!row) return null;
  return {
    passBlockWinRate: row.passBlockWinRate,
    runBlockRate: row.runBlockRate,
    pressuresAllowed: row.pressuresAllowed,
    epaOnDropbacks: row.epaOnDropbacks,
  };
}

export async function getDlUnit(team: string, season: number): Promise<DlUnitStats | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(teamDlSeason)
    .where(and(eq(teamDlSeason.team, team), eq(teamDlSeason.season, season)))
    .limit(1);
  if (!row) return null;
  return {
    pressuresGenerated: row.pressuresGenerated,
    passRushWinRate: row.passRushWinRate,
    runStopRate: row.runStopRate,
    sackRate: row.sackRate,
  };
}

// Weekly helpers (used by a future trend chart; included here for completeness).

export async function getDefenseUnitWeekly(team: string, season: number) {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(teamDefenseWeekly)
    .where(and(eq(teamDefenseWeekly.team, team), eq(teamDefenseWeekly.season, season)))
    .orderBy(teamDefenseWeekly.week);
}

export async function getOlUnitWeekly(team: string, season: number) {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(teamOlWeekly)
    .where(and(eq(teamOlWeekly.team, team), eq(teamOlWeekly.season, season)))
    .orderBy(teamOlWeekly.week);
}

export async function getDlUnitWeekly(team: string, season: number) {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(teamDlWeekly)
    .where(and(eq(teamDlWeekly.team, team), eq(teamDlWeekly.season, season)))
    .orderBy(teamDlWeekly.week);
}
