import { and, desc, eq, sql } from 'drizzle-orm';
import { games, teamPhaseSeason } from '@/db/schema';
import { getDb } from '@/lib/db';

export type TeamSeasonOverview = {
  season: number;
  record: { wins: number; losses: number; ties: number };
  pointDiff: number | null;
  currentSeasonRank: number | null;
  currentSeasonEpa: number | null;
  prevSeasonRank: number | null;
};

/** Overall-phase rank + record for a given team-season. `null` rank when
 * the season rollup hasn't crossed the sample-size threshold yet (week-1
 * of a new season). Review finding #7. */
export async function getTeamSeasonOverview(
  team: string,
  season: number,
): Promise<TeamSeasonOverview> {
  const db = getDb();
  if (!db) {
    return emptyOverview(season);
  }

  const [current, prev, record] = await Promise.all([
    db
      .select({ rank: teamPhaseSeason.rank, epa: teamPhaseSeason.epaPerPlay })
      .from(teamPhaseSeason)
      .where(
        and(
          eq(teamPhaseSeason.team, team),
          eq(teamPhaseSeason.season, season),
          eq(teamPhaseSeason.phase, 'overall'),
        ),
      )
      .limit(1),
    db
      .select({ rank: teamPhaseSeason.rank })
      .from(teamPhaseSeason)
      .where(
        and(
          eq(teamPhaseSeason.team, team),
          eq(teamPhaseSeason.season, season - 1),
          eq(teamPhaseSeason.phase, 'overall'),
        ),
      )
      .limit(1),
    fetchRecord(db, team, season),
  ]);

  return {
    season,
    record: record.record,
    pointDiff: record.pointDiff,
    currentSeasonRank: current[0]?.rank ?? null,
    currentSeasonEpa: current[0]?.epa ?? null,
    prevSeasonRank: prev[0]?.rank ?? null,
  };
}

// --- Internals --------------------------------------------------------------

function emptyOverview(season: number): TeamSeasonOverview {
  return {
    season,
    record: { wins: 0, losses: 0, ties: 0 },
    pointDiff: null,
    currentSeasonRank: null,
    currentSeasonEpa: null,
    prevSeasonRank: null,
  };
}

type DbClient = NonNullable<ReturnType<typeof getDb>>;

async function fetchRecord(
  db: DbClient,
  team: string,
  season: number,
): Promise<{ record: { wins: number; losses: number; ties: number }; pointDiff: number | null }> {
  // Compute wins/losses/ties + point diff from the games table in one pass.
  // Only REG + completed games count.
  const row = await db
    .select({
      wins: sql<number>`
        SUM(CASE
          WHEN ${games.homeTeam} = ${team} AND ${games.homeScore} > ${games.awayScore} THEN 1
          WHEN ${games.awayTeam} = ${team} AND ${games.awayScore} > ${games.homeScore} THEN 1
          ELSE 0 END)::int`,
      losses: sql<number>`
        SUM(CASE
          WHEN ${games.homeTeam} = ${team} AND ${games.homeScore} < ${games.awayScore} THEN 1
          WHEN ${games.awayTeam} = ${team} AND ${games.awayScore} < ${games.homeScore} THEN 1
          ELSE 0 END)::int`,
      ties: sql<number>`
        SUM(CASE
          WHEN ${games.homeScore} = ${games.awayScore}
               AND (${games.homeTeam} = ${team} OR ${games.awayTeam} = ${team})
          THEN 1 ELSE 0 END)::int`,
      pointDiff: sql<number>`
        SUM(CASE
          WHEN ${games.homeTeam} = ${team} THEN (${games.homeScore} - ${games.awayScore})
          WHEN ${games.awayTeam} = ${team} THEN (${games.awayScore} - ${games.homeScore})
          ELSE 0 END)::int`,
    })
    .from(games)
    .where(
      and(
        eq(games.season, season),
        eq(games.seasonType, 'REG'),
        eq(games.completed, true),
        sql`(${games.homeTeam} = ${team} OR ${games.awayTeam} = ${team})`,
      ),
    );

  const r = row[0];
  return {
    record: {
      wins: r?.wins ?? 0,
      losses: r?.losses ?? 0,
      ties: r?.ties ?? 0,
    },
    pointDiff: r?.pointDiff ?? null,
  };
}

// Re-export games DAL helpers from the same file since they share the same
// concerns — per-team game history.

export type GameResult = {
  gameId: string;
  season: number;
  week: number;
  gameDate: Date;
  opponent: string;
  isHome: boolean;
  teamScore: number | null;
  oppScore: number | null;
  teamEpaPerPlay: number | null;
  oppEpaPerPlay: number | null;
};

/** Last N REG games for the given team, newest first. */
export async function getRecentGames(
  team: string,
  season: number,
  n = 6,
): Promise<GameResult[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(games)
    .where(
      and(
        eq(games.season, season),
        eq(games.seasonType, 'REG'),
        eq(games.completed, true),
        sql`(${games.homeTeam} = ${team} OR ${games.awayTeam} = ${team})`,
      ),
    )
    .orderBy(desc(games.week))
    .limit(n);

  return rows.map((g): GameResult => {
    const isHome = g.homeTeam === team;
    return {
      gameId: g.gameId,
      season: g.season,
      week: g.week,
      gameDate: new Date(g.gameDate),
      opponent: isHome ? g.awayTeam : g.homeTeam,
      isHome,
      teamScore: isHome ? g.homeScore : g.awayScore,
      oppScore: isHome ? g.awayScore : g.homeScore,
      teamEpaPerPlay: isHome ? g.homeOffenseEpaPerPlay : g.awayOffenseEpaPerPlay,
      oppEpaPerPlay: isHome ? g.awayOffenseEpaPerPlay : g.homeOffenseEpaPerPlay,
    };
  });
}
