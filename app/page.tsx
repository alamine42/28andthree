import type { Metadata } from 'next';
import { HeroStats } from '@/components/HeroStats';
import { PhaseGrid } from '@/components/PhaseGrid';
import { WeekResultsStrip } from '@/components/WeekResultsStrip';
import { getCurrentSeason } from '@/lib/data/current-season';
import { getPatsPhaseSparklines, getPhaseRankSnapshot } from '@/lib/data/phases';
import { getRecentGames, getTeamSeasonOverview } from '@/lib/data/team';
import { pageMetadata } from '@/lib/seo/page-metadata';

// Fallback TTL if on-demand revalidation misses (one hour — plan §3.2).
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const season = await getCurrentSeason();
  return pageMetadata({
    title: `New England, ${season} in one page`,
    description: `League rank across every phase of play for the ${season} New England Patriots, weekly trends, and recent results. Advanced analytics for fans who read the box score twice.`,
    og: {
      title: `New England, ${season} in one page`,
      eyebrow: `TEAM · ${season} SEASON`,
    },
    canonical: '/',
  });
}

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
    <section className="flex flex-col gap-16 py-16 md:gap-[120px] md:py-24">
      <header className="flex flex-col gap-5">
        <p
          className="font-mono text-2xs uppercase tracking-widest text-text-muted"
          data-testid="season-eyebrow"
        >
          {eyebrow}
        </p>
        <h1 className="max-w-4xl font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display">
          New England, {season} in one page.
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
