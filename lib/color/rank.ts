export type RankTier = 'positive' | 'neutral' | 'negative';

// Tiers are always measured against the full 32-team NFL league. Ranks 1..11
// are positive (top-third), 12..21 neutral, 22..32 negative. This is stable
// regardless of per-week qualifying count: a rank of 10 reads positive even
// in a week where only 28 teams met the sample-size threshold.
//
// If a component needs to convey "rank 10 of 28" shrinkage, it renders a
// qualifying-denominator caption separately — the color stays league-scoped.
// See docs/plans/e3-team-overview-plan.md §3.4 and adversarial-review #2.
const LEAGUE_SIZE = 32;
const FIRST_THIRD_CUT = Math.ceil(LEAGUE_SIZE / 3); // 11
const LAST_THIRD_START = LEAGUE_SIZE - FIRST_THIRD_CUT + 1; // 22

export function rankTier(rank: number | null | undefined): RankTier {
  if (rank == null || !Number.isFinite(rank)) return 'neutral';
  if (rank <= FIRST_THIRD_CUT) return 'positive';
  if (rank >= LAST_THIRD_START) return 'negative';
  return 'neutral';
}
