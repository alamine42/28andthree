import { DataRail } from '@/components/DataRail';
import { HeroStats } from '@/components/HeroStats';
import { HistoricalMarker } from '@/components/HistoricalMarker';
import { PageHead, PageShell, RailBlock, RailRow } from '@/components/PageShell';
import { PhaseTable } from '@/components/PhaseTable';
import { SeasonNotice } from '@/components/SeasonNotice';
import { WeekResultsList } from '@/components/WeekResultsList';
import { getSeasonContext, type SeasonContext } from '@/lib/data/current-season';
import { getPatsPhaseSparklines, getPhaseRankSnapshot } from '@/lib/data/phases';
import { getRecentGames, getTeamSeasonOverview } from '@/lib/data/team';
import { formatRank, formatSignedInt } from '@/lib/format/number';
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
    <PageShell rail={<Rail overview={overview} games={games} />}>
      <section className="flex flex-col gap-8 md:gap-[60px]">
        {historical ? null : <SeasonNotice />}
        <div>
          <PageHead
            testId="season-eyebrow"
            eyebrow={
              <>
                <span className="tabular-nums">{season}</span> <span>{eyebrowSuffix}</span>
              </>
            }
            title={`New England, ${season} in one page.`}
            lede="League rank across every phase of play. Weekly trend, recent results, 32-team distribution."
            marker={historical ? <HistoricalMarker season={season} backHref="/" /> : null}
          />

          <HeroStats overview={overview} />
        </div>

        <PhaseTable
          snapshot={snapshot}
          sparklines={sparklines}
          seasonQuery={historical ? season : null}
        />
      </section>
    </PageShell>
  );
}

/** Secondary content, pinned beside the page instead of stacked under it:
 * recent results, the season summary, and where the numbers come from. */
function Rail({
  overview,
  games,
}: {
  overview: Awaited<ReturnType<typeof getTeamSeasonOverview>>;
  games: Awaited<ReturnType<typeof getRecentGames>>;
}) {
  const played = overview.record.wins + overview.record.losses + overview.record.ties;
  return (
    <>
      {games.length > 0 ? (
        <RailBlock title="Results" note={`last ${games.length}`}>
          <WeekResultsList games={games} />
        </RailBlock>
      ) : null}
      <RailBlock title="Season">
        <dl className="space-y-2">
          <RailRow
            label="Record"
            value={`${overview.record.wins}-${overview.record.losses}${
              overview.record.ties > 0 ? `-${overview.record.ties}` : ''
            }`}
          />
          <RailRow label="Point diff" value={formatSignedInt(overview.pointDiff)} />
          <RailRow
            label={`Rank vs ${overview.season - 1}`}
            value={
              overview.prevSeasonRank != null
                ? `${formatRank(overview.currentSeasonRank)} \u2190 ${formatRank(overview.prevSeasonRank)}`
                : '\u2014'
            }
          />
          <RailRow label="Games played" value={String(played)} />
        </dl>
      </RailBlock>
      <DataRail />
    </>
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
        SEASON · KICKOFF IN <span className="tabular-nums text-text">{ctx.kickoffInDays}</span> DAYS
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
            <span className="tabular-nums text-text">{snap.daysUntilNextGame}</span> DAYS
          </>
        );
      }
      return 'SEASON · FINAL · OFFSEASON';
    }
  }
}
