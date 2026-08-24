import { HeroStats } from '@/components/HeroStats';
import { HistoricalMarker } from '@/components/HistoricalMarker';
import { PhaseGrid } from '@/components/PhaseGrid';
import { SeasonNotice } from '@/components/SeasonNotice';
import { WeekResultsStrip } from '@/components/WeekResultsStrip';
import { getSeasonContext, type SeasonContext } from '@/lib/data/current-season';
import { getPatsPhaseSparklines, getPhaseRankSnapshot } from '@/lib/data/phases';
import { getRecentGames, getTeamSeasonOverview } from '@/lib/data/team';
import { getSchedulePhase, type ScheduleSnapshot } from '@/lib/schedule/phase';

// E11: shared home-page template. The clean route renders it with the
// current season (static/ISR untouched); the /s/[season] wrapper renders
// it with a past season. Plan §3.4.

const TEAM = 'NE' as const;

export async function TeamOverviewPage({
  season,
  historical,
}: {
  season: number;
  historical: boolean;
}) {
  const ctx = await getSeasonContext();

  const [snap, overview, snapshot, sparklines, games] = await Promise.all([
    getSchedulePhase(),
    getTeamSeasonOverview(TEAM, season),
    getPhaseRankSnapshot(TEAM, season),
    getPatsPhaseSparklines(TEAM, season),
    getRecentGames(TEAM, season, 6),
  ]);

  const eyebrowSuffix = historical ? 'SEASON · FINAL' : buildEyebrowSuffix(snap, ctx);

  return (
    <section className="flex flex-col gap-10 py-8 md:gap-[60px] md:py-12">
      {historical ? null : <SeasonNotice />}
      <header className="flex flex-col gap-3">
        <p
          className="flex flex-wrap items-center gap-x-2 font-mono text-2xs uppercase tracking-widest text-text-muted"
          data-testid="season-eyebrow"
        >
          <span className="tabular-nums">{season}</span>{' '}
          <span>{eyebrowSuffix}</span>
        </p>
        {historical ? <HistoricalMarker season={season} backHref="/" /> : null}
        <h1 className="max-w-4xl font-display text-2xl font-bold leading-tight tracking-tightest text-text md:text-3xl">
          New England, {season} in one page.
        </h1>
        <p className="max-w-prose text-sm text-text-muted md:text-base">
          League rank across every phase of play. Weekly trend, recent results,
          32-team distribution.
        </p>
      </header>

      <HeroStats overview={overview} />

      <PhaseGrid
        snapshot={snapshot}
        sparklines={sparklines}
        seasonQuery={historical ? season : null}
      />

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

// The season number renders separately in the eyebrow; this builds the
// copy that follows it.
function buildEyebrowSuffix(snap: ScheduleSnapshot, ctx: SeasonContext): React.ReactNode {
  // Preseason transition: the page shows the new season (blank stats +
  // SeasonNotice), so the eyebrow counts down to its kickoff instead of
  // labeling the finished season. In the Week-1 lag (kickoff passed, no
  // snaps loaded yet) kickoffInDays is null and the snap copy below
  // already reads "SEASON · IN PROGRESS".
  if (ctx.awaitingFirstGame && ctx.kickoffInDays != null) {
    return (
      <>
        SEASON · KICKOFF IN <span className="text-text">{ctx.kickoffInDays}</span> DAYS
      </>
    );
  }
  switch (snap.phase) {
    case 'regular':
      return 'SEASON · IN PROGRESS';
    case 'playoffs': {
      const label = snap.playoffRound ? PLAYOFF_ROUND_LABEL[snap.playoffRound] : 'PLAYOFFS';
      return `PLAYOFFS · ${label}`;
    }
    case 'offseason': {
      if (snap.daysUntilNextGame != null) {
        // Surface the days-until count brighter than the rest so the
        // "how long until football?" answer reads at a glance.
        return (
          <>
            SEASON · FINAL · NEXT GAME IN{' '}
            <span className="text-text">{snap.daysUntilNextGame}</span> DAYS
          </>
        );
      }
      return 'SEASON · FINAL · OFFSEASON';
    }
  }
}
