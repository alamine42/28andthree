import { HeroStats } from '@/components/HeroStats';
import { PhaseGrid } from '@/components/PhaseGrid';
import { WeekResultsStrip } from '@/components/WeekResultsStrip';
import { getCurrentSeason } from '@/lib/data/current-season';
import { getPatsPhaseSparklines, getPhaseRankSnapshot } from '@/lib/data/phases';
import { getRecentGames, getTeamSeasonOverview } from '@/lib/data/team';

// Fallback TTL if on-demand revalidation misses (one hour — plan §3.2).
export const revalidate = 3600;

const TEAM = 'NE' as const;

export default async function HomePage() {
  const season = await getCurrentSeason();

  const [overview, snapshot, sparklines, games] = await Promise.all([
    getTeamSeasonOverview(TEAM, season),
    getPhaseRankSnapshot(TEAM, season),
    getPatsPhaseSparklines(TEAM, season),
    getRecentGames(TEAM, season, 6),
  ]);

  const eyebrow = buildEyebrow(season, snapshot);

  return (
    <section className="flex flex-col gap-16 py-16 md:gap-24 md:py-24">
      <header className="flex flex-col gap-5">
        <p
          className="font-mono text-2xs uppercase tracking-widest text-text-muted"
          data-testid="season-eyebrow"
        >
          {eyebrow}
        </p>
        <h1 className="max-w-4xl font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display">
          New England, 2025 in one page.
        </h1>
        <p className="max-w-prose text-base text-text-muted md:text-lg">
          League rank across every phase of play. Weekly trend, recent results, and
          where the Pats sit in the 32-team distribution. Advanced analytics for
          fans who read the box score twice.
        </p>
      </header>

      <HeroStats overview={overview} />

      <PhaseGrid snapshot={snapshot} sparklines={sparklines} />

      <WeekResultsStrip games={games} />
    </section>
  );
}

function buildEyebrow(
  season: number,
  snapshot: ReadonlyArray<{ plays: number }>,
): string {
  // If the season rollup has meaningful data (any phase has >=100 plays), we
  // call the season "final"; otherwise it's still in progress.
  const meaningfulPlays = snapshot.some((s) => s.plays >= 100);
  const label = meaningfulPlays ? 'FINAL' : 'IN PROGRESS';
  return `${season} SEASON · ${label}`;
}
