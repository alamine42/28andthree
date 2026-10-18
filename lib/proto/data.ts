// PROTOTYPE DATA — /proto routes only. Not a data source.
//
// The Patriots rows carry the real 2026 values read off the live site so the
// layouts are judged against true numbers. Every other team's row is
// fabricated to fill a 32-row league table. /proto is gated behind
// NEXT_PUBLIC_SANDBOX_MODE and every page carries a prototype banner, so no
// fabricated number can reach a reader who thinks it is real (SPEC §3.5a).

import type { Phase } from '@/lib/constants/phases';
import type { DistributionRow, TrendPoint } from '@/lib/data/phases';

export type ProtoPhase = {
  phase: Phase;
  rank: number;
  epa: number;
  spark: number[];
};

export const SEASON = 2026;

export const team = {
  wins: 3,
  losses: 2,
  pointDiff: 16,
  rank: 11,
  epa: 0.05,
  rankDeltaVsPrevSeason: -9,
  week: 5,
};

export const phases: ProtoPhase[] = [
  { phase: 'pass_offense', rank: 9, epa: 0.17, spark: [0.04, 0.09, -0.02, 0.14, 0.22] },
  { phase: 'rush_offense', rank: 23, epa: -0.14, spark: [-0.08, -0.19, -0.21, -0.12, -0.14] },
  { phase: 'pass_defense', rank: 8, epa: -0.02, spark: [0.06, -0.09, -0.12, 0.01, -0.05] },
  { phase: 'run_defense', rank: 30, epa: 0.02, spark: [0.09, 0.14, 0.04, 0.11, 0.06] },
  { phase: 'redzone_offense', rank: 20, epa: -0.04, spark: [-0.11, 0.02, -0.08, -0.01, -0.04] },
  { phase: 'redzone_defense', rank: 18, epa: 0.06, spark: [0.12, 0.04, 0.09, 0.02, 0.06] },
  { phase: 'third_down_offense', rank: 14, epa: -0.07, spark: [-0.14, -0.04, -0.12, 0.01, -0.07] },
  { phase: 'third_down_defense', rank: 18, epa: -0.05, spark: [0.02, -0.08, 0.04, -0.09, -0.05] },
  { phase: 'explosive_offense', rank: 8, epa: 0.08, spark: [0.01, 0.06, 0.04, 0.11, 0.08] },
  { phase: 'explosive_defense', rank: 9, epa: 0.06, spark: [0.09, 0.02, 0.07, 0.04, 0.06] },
  { phase: 'special_teams', rank: 19, epa: 0.05, spark: [-0.02, 0.04, 0.01, 0.09, 0.05] },
];

export type ProtoGame = {
  week: number;
  opponent: string;
  isHome: boolean;
  teamScore: number;
  oppScore: number;
  epaDiff: number;
};

export const games: ProtoGame[] = [
  { week: 1, opponent: 'SEA', isHome: false, teamScore: 10, oppScore: 13, epaDiff: -0.18 },
  { week: 2, opponent: 'PIT', isHome: true, teamScore: 20, oppScore: 3, epaDiff: 0.29 },
  { week: 3, opponent: 'JAX', isHome: false, teamScore: 6, oppScore: 35, epaDiff: -0.49 },
  { week: 4, opponent: 'BUF', isHome: false, teamScore: 29, oppScore: 26, epaDiff: 0.06 },
  { week: 5, opponent: 'LV', isHome: true, teamScore: 45, oppScore: 17, epaDiff: 0.44 },
];

export type LeagueRow = {
  team: string;
  name: string;
  record: string;
  rank: number;
  epa: number;
  passOff: number;
  rushOff: number;
  passDef: number;
  runDef: number;
  thirdOff: number;
  explosive: number;
};

// FABRICATED except the NE row. Ranks per column are a permutation of 1..32
// so each column reads like a real league table.
const ORDER = [
  ['BAL', 'Baltimore'],
  ['DET', 'Detroit'],
  ['KC', 'Kansas City'],
  ['BUF', 'Buffalo'],
  ['PHI', 'Philadelphia'],
  ['SF', 'San Francisco'],
  ['GB', 'Green Bay'],
  ['HOU', 'Houston'],
  ['MIN', 'Minnesota'],
  ['LAC', 'Los Angeles C'],
  ['NE', 'New England'],
  ['TB', 'Tampa Bay'],
  ['CIN', 'Cincinnati'],
  ['PIT', 'Pittsburgh'],
  ['SEA', 'Seattle'],
  ['ARI', 'Arizona'],
  ['WAS', 'Washington'],
  ['DEN', 'Denver'],
  ['ATL', 'Atlanta'],
  ['LAR', 'Los Angeles R'],
  ['CHI', 'Chicago'],
  ['MIA', 'Miami'],
  ['IND', 'Indianapolis'],
  ['NO', 'New Orleans'],
  ['NYJ', 'New York J'],
  ['JAX', 'Jacksonville'],
  ['DAL', 'Dallas'],
  ['LV', 'Las Vegas'],
  ['TEN', 'Tennessee'],
  ['NYG', 'New York G'],
  ['CLE', 'Cleveland'],
  ['CAR', 'Carolina'],
] as const;

// Deterministic shuffle: fixed offsets per column, so the table is stable
// across renders and nobody can mistake it for a live feed.
function column(offset: number): number[] {
  return ORDER.map((_, i) => ((i * 7 + offset) % 32) + 1);
}

/** Indexed read with a fallback, so `noUncheckedIndexedAccess` is satisfied
 * without non-null assertions. The index is always in range by construction. */
function at(col: number[], i: number): number {
  return col[i] ?? 1;
}
const PASS_OFF = column(3);
const RUSH_OFF = column(11);
const PASS_DEF = column(19);
const RUN_DEF = column(27);
const THIRD_OFF = column(5);
const EXPLOSIVE = column(23);

export const league: LeagueRow[] = ORDER.map(([abbr, name], i) => {
  const isNE = abbr === 'NE';
  return {
    team: abbr,
    name,
    record: isNE ? '3-2' : `${4 - (i % 4)}-${1 + (i % 4)}`,
    rank: i + 1,
    epa: isNE ? team.epa : Number((0.34 - i * 0.022).toFixed(2)),
    passOff: isNE ? 9 : at(PASS_OFF, i),
    rushOff: isNE ? 23 : at(RUSH_OFF, i),
    passDef: isNE ? 8 : at(PASS_DEF, i),
    runDef: isNE ? 30 : at(RUN_DEF, i),
    thirdOff: isNE ? 14 : at(THIRD_OFF, i),
    explosive: isNE ? 8 : at(EXPLOSIVE, i),
  };
});

export const NAV = [
  { label: 'Team', href: '/' },
  { label: 'Phases', href: '/phases' },
  { label: 'Players', href: '/players' },
  { label: 'Draft', href: '/draft-roi' },
  { label: 'Coaching', href: '/coaching' },
  { label: 'Trends', href: '/trends' },
] as const;

// ---- Phase detail ---------------------------------------------------------

export const passOffenseTrend: TrendPoint[] = [
  { week: 1, raw: 0.04, rolling4: null, leagueMedian: 0.02 },
  { week: 2, raw: 0.09, rolling4: null, leagueMedian: 0.03 },
  { week: 3, raw: -0.02, rolling4: null, leagueMedian: 0.01 },
  { week: 4, raw: 0.14, rolling4: 0.0625, leagueMedian: 0.04 },
  { week: 5, raw: 0.22, rolling4: 0.1075, leagueMedian: 0.03 },
];

/** 32 teams on the pass-offense axis. NE carries its real rank and EPA. */
export const passOffenseDistribution: DistributionRow[] = league.map((r) => ({
  team: r.team,
  plays: 180 + ((r.passOff * 7) % 90),
  epaPerPlay: r.team === 'NE' ? 0.17 : Number((0.42 - (r.passOff - 1) * 0.021).toFixed(3)),
  rank: r.passOff,
  insufficientSample: false,
}));

export type Contributor = { name: string; position: string; line: string; value: string };

export const passOffenseContributors: Contributor[] = [
  { name: 'Drake Maye', position: 'QB', line: '163 dropbacks', value: '+0.21 EPA/db' },
  { name: 'A.J. Brown', position: 'WR', line: '41 targets', value: '+0.34 EPA/tgt' },
  { name: 'Hunter Henry', position: 'TE', line: '27 targets', value: '+0.19 EPA/tgt' },
];

// ---- Roster ---------------------------------------------------------------

export type ProtoPlayer = {
  name: string;
  position: string;
  number: number;
  /** Players with a deep-dive page. Line + secondary cards go to unit pages. */
  deepDive: boolean;
};

export const roster: ProtoPlayer[] = [
  { name: 'Drake Maye', position: 'QB', number: 10, deepDive: true },
  { name: 'Behren Morton', position: 'QB', number: 15, deepDive: true },
  { name: 'Tommy DeVito', position: 'QB', number: 16, deepDive: true },
  { name: 'A.J. Brown', position: 'WR', number: 1, deepDive: true },
  { name: 'DeMario Douglas', position: 'WR', number: 3, deepDive: true },
  { name: 'Corey Kiner', position: 'RB', number: 9, deepDive: true },
  { name: 'Mack Hollins', position: 'WR', number: 13, deepDive: true },
  { name: 'Chandler Brayboy', position: 'WR', number: 15, deepDive: true },
  { name: 'Kyle Williams', position: 'WR', number: 18, deepDive: true },
  { name: 'Jimmy Kibble', position: 'WR', number: 19, deepDive: true },
  { name: 'Nick DeGennaro', position: 'WR', number: 23, deepDive: true },
  { name: 'Hassan Haskins', position: 'RB', number: 26, deepDive: true },
  { name: 'Jeremiah Webb', position: 'WR', number: 29, deepDive: true },
  { name: 'Jam Miller', position: 'RB', number: 30, deepDive: true },
  { name: 'TreVeyon Henderson', position: 'RB', number: 32, deepDive: true },
  { name: 'Lan Larison', position: 'RB', number: 34, deepDive: true },
  { name: 'Hunter Henry', position: 'TE', number: 85, deepDive: true },
  { name: 'Mike Onwenu', position: 'OL', number: 71, deepDive: false },
  { name: 'Will Campbell', position: 'OL', number: 66, deepDive: false },
  { name: 'Christian Barmore', position: 'DL', number: 90, deepDive: false },
  { name: 'Keion White', position: 'DL', number: 99, deepDive: false },
  { name: 'Christian Gonzalez', position: 'DB', number: 0, deepDive: false },
  { name: 'Marcus Jones', position: 'DB', number: 25, deepDive: false },
  { name: 'Craig Woodson', position: 'DB', number: 31, deepDive: false },
];

export const ROSTER_FILTERS = [
  { label: 'All', count: roster.length },
  { label: 'QB', count: 3 },
  { label: 'RB', count: 5 },
  { label: 'WR+TE', count: 9 },
  { label: 'OL', count: 2 },
  { label: 'DEF', count: 5 },
] as const;

// ---- QB deep dive ---------------------------------------------------------

export const qb = {
  name: 'Drake Maye',
  position: 'QB',
  number: 10,
  dropbacks: 163,
  epaPerDropback: 0.21,
  cpoe: 3.4,
  adot: 8.6,
  pressureRate: 0.28,
  cleanPocketEpa: 0.34,
  pressuredEpa: -0.21,
  deepEpa: 0.41,
  successRate: 0.52,
  weekly: [
    { week: 1, epa: -0.04 },
    { week: 2, epa: 0.19 },
    { week: 3, epa: -0.22 },
    { week: 4, epa: 0.26 },
    { week: 5, epa: 0.41 },
  ],
};

// ---- Draft ROI ------------------------------------------------------------

export type DraftPick = {
  pick: number;
  round: number;
  name: string;
  position: string;
  expected: number;
  actual: number | null;
  grade: 'HIT' | 'FAIR' | 'MISS' | 'PENDING';
  proxy: boolean;
};

export const draftClass2024: DraftPick[] = [
  {
    pick: 3,
    round: 1,
    name: 'Drake Maye',
    position: 'QB',
    expected: 58.2,
    actual: 91.4,
    grade: 'HIT',
    proxy: false,
  },
  {
    pick: 37,
    round: 2,
    name: 'Ja’Lynn Polk',
    position: 'WR',
    expected: 41.8,
    actual: 12.1,
    grade: 'MISS',
    proxy: false,
  },
  {
    pick: 68,
    round: 3,
    name: 'Caedan Wallace',
    position: 'OT',
    expected: 28.4,
    actual: null,
    grade: 'FAIR',
    proxy: true,
  },
  {
    pick: 103,
    round: 4,
    name: 'Layden Robinson',
    position: 'OG',
    expected: 19.6,
    actual: null,
    grade: 'FAIR',
    proxy: true,
  },
  {
    pick: 110,
    round: 4,
    name: 'Javon Baker',
    position: 'WR',
    expected: 18.9,
    actual: 4.2,
    grade: 'MISS',
    proxy: false,
  },
  {
    pick: 180,
    round: 6,
    name: 'Marcellas Dial',
    position: 'CB',
    expected: 9.1,
    actual: null,
    grade: 'PENDING',
    proxy: true,
  },
];

export const draftClasses = [
  { year: 2026, picks: 9, hit: 0, fair: 0, miss: 0, pending: 9 },
  { year: 2025, picks: 11, hit: 0, fair: 0, miss: 0, pending: 11 },
  { year: 2024, picks: 8, hit: 1, fair: 4, miss: 3, pending: 0 },
  { year: 2023, picks: 12, hit: 3, fair: 3, miss: 9, pending: 0 },
  { year: 2022, picks: 10, hit: 3, fair: 6, miss: 2, pending: 0 },
  { year: 2021, picks: 8, hit: 2, fair: 6, miss: 0, pending: 0 },
];
