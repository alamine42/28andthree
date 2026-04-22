import type { TeamSeasonOverview, GameResult } from '@/lib/data/team';

// Sandbox fixture: NE 2025 team overview. Hand-curated to render a
// strong season (2nd overall) with a +25 rank delta vs 2024 — exercises
// the up-arrow + delta caption path on the home hero.
export const teamOverview2025: TeamSeasonOverview = {
  season: 2025,
  record: { wins: 14, losses: 3, ties: 0 },
  pointDiff: 170,
  currentSeasonRank: 2,
  currentSeasonEpa: 0.20,
  prevSeasonRank: 27, // 2024 was rough; delta = 25 places improved
};

// Last 6 games (week 12-17 of 2025), reversed-display order in WeekResultsStrip.
// Includes one tie and one loss to exercise all three result-codes.
function gameDate(week: number): Date {
  // Week 1 = 2025-09-04 (Thursday); add 7 days per week.
  const base = new Date('2025-09-04T00:00:00Z').getTime();
  return new Date(base + (week - 1) * 7 * 24 * 60 * 60 * 1000);
}

export const recentGames2025: GameResult[] = [
  {
    gameId: '2025_12_NE_NYJ', season: 2025, week: 12, gameDate: gameDate(12),
    opponent: 'NYJ', isHome: false,
    teamScore: 28, oppScore: 13, teamEpaPerPlay: 0.31, oppEpaPerPlay: -0.04,
  },
  {
    gameId: '2025_13_NE_BUF', season: 2025, week: 13, gameDate: gameDate(13),
    opponent: 'BUF', isHome: true,
    teamScore: 24, oppScore: 27, teamEpaPerPlay: 0.08, oppEpaPerPlay: 0.18,
  },
  {
    gameId: '2025_14_NE_MIA', season: 2025, week: 14, gameDate: gameDate(14),
    opponent: 'MIA', isHome: false,
    teamScore: 35, oppScore: 14, teamEpaPerPlay: 0.42, oppEpaPerPlay: -0.12,
  },
  {
    gameId: '2025_15_NE_ARI', season: 2025, week: 15, gameDate: gameDate(15),
    opponent: 'ARI', isHome: true,
    teamScore: 20, oppScore: 20, teamEpaPerPlay: 0.05, oppEpaPerPlay: 0.05,
  },
  {
    gameId: '2025_16_NE_DEN', season: 2025, week: 16, gameDate: gameDate(16),
    opponent: 'DEN', isHome: false,
    teamScore: 31, oppScore: 17, teamEpaPerPlay: 0.28, oppEpaPerPlay: -0.06,
  },
  {
    gameId: '2025_17_NE_PIT', season: 2025, week: 17, gameDate: gameDate(17),
    opponent: 'PIT', isHome: true,
    teamScore: 24, oppScore: 21, teamEpaPerPlay: 0.15, oppEpaPerPlay: 0.09,
  },
];
