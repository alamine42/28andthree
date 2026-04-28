import { and, eq } from 'drizzle-orm';
import { games } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getTopContributors } from '@/lib/data/contributors';
import { getPhaseRankSnapshot, type PhaseSnapshot } from '@/lib/data/phases';
import type { Phase } from '@/lib/constants/phases';
import {
  validateNumericClaims,
  validatePlayerNames,
  type ExtractorContext,
  type NumericClaim,
} from './types';

// Opponent preview extractor. Reads from existing DAL + games table to
// assemble structured input for the LLM. All DB roundtrips parallelized.
//
// Per plan §3.5: pure (same inputs → same outputs), no LLM calls, no
// filesystem IO. The LLM never sees raw DB rows; it sees this shaped JSON
// and the corresponding numericClaims/playerNames arrays.

const PREVIEW_PHASES: ReadonlyArray<Phase> = [
  'pass_offense',
  'rush_offense',
  'pass_defense',
  'run_defense',
];

export type OpponentPreviewData = {
  opponent: string;
  week: number;
  season: number;
  homeAway: 'home' | 'away';
  ne: PhaseGroup;
  opp: PhaseGroup;
  contributors: { phase: Phase; players: string[] }[];
};

type PhaseGroup = {
  passO: PhaseStat;
  runO: PhaseStat;
  passD: PhaseStat;
  runD: PhaseStat;
};

type PhaseStat = {
  epaPerPlay: number | null;
  rank: number | null;
};

export async function extractOpponentPreviewContext(params: {
  opponent: string;
  week: number;
  season: number;
}): Promise<ExtractorContext<OpponentPreviewData>> {
  const { opponent, week, season } = params;
  const db = getDb();
  if (!db) {
    throw new Error('opponent-preview extractor: no DB connection');
  }

  // Fan out: phase ranks for both teams + per-phase contributors + game lookup,
  // all in parallel. On Neon (~50ms/roundtrip) this is the dominant pre-LLM
  // latency; serializing these would add ~300ms.
  const [neSnap, oppSnap, contributorRows, gameRows] = await Promise.all([
    getPhaseRankSnapshot('NE', season),
    getPhaseRankSnapshot(opponent, season),
    Promise.all(
      PREVIEW_PHASES.map(async (phase) => ({
        phase,
        rows: await getTopContributors(phase, 'NE', season).catch(() => []),
      })),
    ),
    db
      .select({
        gameId: games.gameId,
        homeTeam: games.homeTeam,
        awayTeam: games.awayTeam,
      })
      .from(games)
      .where(and(eq(games.season, season), eq(games.week, week)))
      .limit(20),
  ]);

  // Fail fast on schedule miss — silently defaulting to 'away' would emit
  // wrong context to the LLM (codex WARNING #3).
  const game = gameRows.find(
    (r) =>
      (r.homeTeam === 'NE' && r.awayTeam === opponent) ||
      (r.homeTeam === opponent && r.awayTeam === 'NE'),
  );
  if (!game) {
    throw new Error(
      `opponent-preview extractor: no game in season ${season} week ${week} between NE and ${opponent}`,
    );
  }
  const homeAway: 'home' | 'away' = game.homeTeam === 'NE' ? 'home' : 'away';

  const ne = phaseGroupFromSnapshot(neSnap);
  const opp = phaseGroupFromSnapshot(oppSnap);

  const contributors: { phase: Phase; players: string[] }[] = [];
  const playerNames: string[] = [];
  for (const { phase, rows } of contributorRows) {
    const names = rows
      .filter((r) => r.role !== 'unit')
      .map((r) => r.displayName)
      .filter((n): n is string => Boolean(n));
    contributors.push({ phase, players: names });
    playerNames.push(...names);
  }

  const numericClaims: NumericClaim[] = [];
  pushPhaseClaims(numericClaims, 'NE', ne);
  pushPhaseClaims(numericClaims, opponent, opp);

  validateNumericClaims(numericClaims);
  validatePlayerNames(playerNames);

  const data: OpponentPreviewData = {
    opponent,
    week,
    season,
    homeAway,
    ne,
    opp,
    contributors,
  };

  return {
    contentType: 'opponent_preview',
    contextKey: `${season}-w${String(week).padStart(2, '0')}-${opponent.toLowerCase()}`,
    data,
    numericClaims,
    playerNames: dedupe(playerNames),
    generatedAt: new Date(),
  };
}

function phaseGroupFromSnapshot(snap: PhaseSnapshot[]): PhaseGroup {
  const byPhase = new Map(snap.map((s) => [s.phase, s]));
  const get = (phase: Phase): PhaseStat => {
    const r = byPhase.get(phase);
    return { epaPerPlay: r?.epaPerPlay ?? null, rank: r?.rank ?? null };
  };
  return {
    passO: get('pass_offense'),
    runO: get('rush_offense'),
    passD: get('pass_defense'),
    runD: get('run_defense'),
  };
}

function pushPhaseClaims(claims: NumericClaim[], team: string, group: PhaseGroup): void {
  const phaseLabels: Array<[keyof PhaseGroup, string]> = [
    ['passO', 'pass offense'],
    ['runO', 'run offense'],
    ['passD', 'pass defense'],
    ['runD', 'run defense'],
  ];
  for (const [key, label] of phaseLabels) {
    const stat = group[key];
    if (stat.epaPerPlay !== null) {
      claims.push({
        label: `${team} ${label} EPA/play`,
        value: roundEpa(stat.epaPerPlay),
        rank: stat.rank ?? undefined,
        unit: 'epa',
      });
    }
  }
}

function roundEpa(v: number): number {
  return Math.round(v * 100) / 100;
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
