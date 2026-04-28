import { eq } from 'drizzle-orm';
import { games } from '@/db/schema';
import { getDb } from '@/lib/db';
import {
  validateNumericClaims,
  validatePlayerNames,
  type ExtractorContext,
  type NumericClaim,
} from './types';

// Sunday recap extractor. Reads a single completed game + relevant rollups
// from the existing DAL and shapes a structured input for the LLM.

export type RecapData = {
  gameId: string;
  season: number;
  week: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  homeOffenseEpaPerPlay: number | null;
  awayOffenseEpaPerPlay: number | null;
  // Whether NE was home in this game
  neWasHome: boolean;
};

export async function extractRecapContext(params: {
  gameId: string;
}): Promise<ExtractorContext<RecapData>> {
  const { gameId } = params;
  const db = getDb();
  if (!db) {
    throw new Error('recap extractor: no DB connection');
  }

  const rows = await db
    .select({
      gameId: games.gameId,
      season: games.season,
      week: games.week,
      homeTeam: games.homeTeam,
      awayTeam: games.awayTeam,
      homeScore: games.homeScore,
      awayScore: games.awayScore,
      homeEpa: games.homeOffenseEpaPerPlay,
      awayEpa: games.awayOffenseEpaPerPlay,
      completed: games.completed,
    })
    .from(games)
    .where(eq(games.gameId, gameId))
    .limit(1);

  const g = rows[0];
  if (!g) {
    throw new Error(`recap extractor: no game with id ${gameId}`);
  }
  if (!g.completed) {
    throw new Error(`recap extractor: game ${gameId} is not yet completed`);
  }

  const neWasHome = g.homeTeam === 'NE';
  const data: RecapData = {
    gameId: g.gameId,
    season: g.season,
    week: g.week,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    homeOffenseEpaPerPlay: g.homeEpa,
    awayOffenseEpaPerPlay: g.awayEpa,
    neWasHome,
  };

  const numericClaims: NumericClaim[] = [];
  if (g.homeScore !== null) {
    numericClaims.push({ label: `${g.homeTeam} score`, value: g.homeScore });
  }
  if (g.awayScore !== null) {
    numericClaims.push({ label: `${g.awayTeam} score`, value: g.awayScore });
  }
  if (g.homeEpa !== null) {
    numericClaims.push({
      label: `${g.homeTeam} offense EPA/play`,
      value: roundEpa(g.homeEpa),
      unit: 'epa',
    });
  }
  if (g.awayEpa !== null) {
    numericClaims.push({
      label: `${g.awayTeam} offense EPA/play`,
      value: roundEpa(g.awayEpa),
      unit: 'epa',
    });
  }

  validateNumericClaims(numericClaims);
  // Player names are not seeded yet for recap; the LLM should reference
  // only what's in `data` (currently no individual player stats). Future:
  // pull top contributors from the play-level rollup for this specific
  // game. Captured as L1-04 follow-up.
  const playerNames: string[] = [];
  validatePlayerNames(playerNames);

  return {
    contentType: 'recap',
    contextKey: gameId,
    data,
    numericClaims,
    playerNames,
    generatedAt: new Date(),
  };
}

function roundEpa(v: number): number {
  return Math.round(v * 100) / 100;
}
