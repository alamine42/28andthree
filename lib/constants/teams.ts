// Canonical NFL team abbreviations (32). nflverse uses these verbatim in PBP for
// every season in our window (2020–2025). Historical relocations (OAK→LV 2020,
// SD→LAC 2017, STL→LAR 2016) are out of window and intentionally absent.
export const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB',  'HOU', 'IND', 'JAX', 'KC',
  'LAC', 'LAR', 'LV',  'MIA', 'MIN', 'NE',  'NO',  'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF',  'TB',  'TEN', 'WAS',
] as const;

export type NflTeam = (typeof NFL_TEAMS)[number];

const TEAM_SET: ReadonlySet<string> = new Set(NFL_TEAMS);

export function isValidTeam(abbr: unknown): abbr is NflTeam {
  return typeof abbr === 'string' && TEAM_SET.has(abbr);
}

// ESPN / some nflverse downstream exports use WSH for the Commanders; canonical
// PBP uses WAS. Normalize on ingest so aggregations don't silently split on team.
const ABBR_ALIAS: Readonly<Record<string, string>> = {
  WSH: 'WAS',
};

export function normalizeTeamAbbr(abbr: string | null | undefined): string | null {
  if (abbr == null || abbr === '') return null;
  return ABBR_ALIAS[abbr] ?? abbr;
}
