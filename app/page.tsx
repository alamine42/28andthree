import type { Metadata } from 'next';
import { HeroStats } from '@/components/HeroStats';
import { PhaseGrid } from '@/components/PhaseGrid';
import { WeekResultsStrip } from '@/components/WeekResultsStrip';
import { getCurrentSeason } from '@/lib/data/current-season';
import { getPatsPhaseSparklines, getPhaseRankSnapshot } from '@/lib/data/phases';
import { getRecentGames, getTeamSeasonOverview } from '@/lib/data/team';
import { getSchedulePhase, type ScheduleSnapshot } from '@/lib/schedule/phase';
import { pageMetadata } from '@/lib/seo/page-metadata';

// Fallback TTL if on-demand revalidation misses (one hour — plan §3.2).
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const season = await getCurrentSeason();
  return pageMetadata({
    // Explicit brand suffix: Next's title.template from the root layout
    // isn't applied to generateMetadata() return values on the index route
    // in Next 16 (it works fine on deeper segments like /phases/[slug]).
    title: `New England, ${season} in one page \u00B7 28 and Three`,
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
  const snap = await getSchedulePhase();

  const [overview, snapshot, sparklines, games] = await Promise.all([
    getTeamSeasonOverview(TEAM, season),
    getPhaseRankSnapshot(TEAM, season),
    getPatsPhaseSparklines(TEAM, season),
    getRecentGames(TEAM, season, 6),
  ]);

  const eyebrow = buildEyebrow(snap);

  return (
    <section className="flex flex-col gap-10 py-8 md:gap-[60px] md:py-12">
      <header className="flex flex-col gap-3">
        <p
          className="font-mono text-2xs uppercase tracking-widest text-text-muted"
          data-testid="season-eyebrow"
        >
          {eyebrow}
        </p>
        <h1 className="max-w-4xl font-display text-2xl font-bold leading-tight tracking-tightest text-text md:text-3xl">
          New England, {season} in one page.
        </h1>
        <p className="max-w-prose text-sm text-text-muted md:text-base">
          League rank across every phase of play. Weekly trend, recent results,
          32-team distribution.
        </p>
      </header>

      <HeroStats overview={overview} />

      <PhaseGrid snapshot={snapshot} sparklines={sparklines} />

      <WeekResultsStrip games={games} />
    </section>
  );
}

// Schedule-derived eyebrow copy. Replaces the >=100 plays heuristic that
// could not distinguish "season final, weeks ago" from "season just ended".
// See plan v2 §2 (docs/plans/e9-schedule-aware-plan.md) for the copy table.
const PLAYOFF_ROUND_LABEL = {
  wild_card: 'WILD CARD',
  divisional: 'DIVISIONAL',
  conference: 'CONFERENCE',
  super_bowl: 'SUPER BOWL',
} as const;

function buildEyebrow(snap: ScheduleSnapshot): string {
  switch (snap.phase) {
    case 'regular':
      return `${snap.season} SEASON · IN PROGRESS`;
    case 'playoffs': {
      const label = snap.playoffRound ? PLAYOFF_ROUND_LABEL[snap.playoffRound] : 'PLAYOFFS';
      return `${snap.season} PLAYOFFS · ${label}`;
    }
    case 'offseason': {
      const tail =
        snap.daysUntilNextGame != null
          ? `NEXT GAME IN ${snap.daysUntilNextGame} DAYS`
          : 'OFFSEASON';
      return `${snap.season} SEASON · FINAL · ${tail}`;
    }
  }
}
