import type { Metadata } from 'next';
import { PHASE_GROUPS, type Phase } from '@/lib/constants/phases';
import { getCurrentSeason } from '@/lib/data/current-season';
import { getPhaseSeasonHistory, SEASON_SAMPLE_FLOOR } from '@/lib/data/trends';
import { EARLIEST_SEASON } from '@/lib/season-view';
import { SeasonRankChart } from '@/components/charts/SeasonRankChart';
import { SeasonHistoryCard } from '@/components/SeasonHistoryCard';
import { SectionHeader } from '@/components/SectionHeader';
import { pageMetadata } from '@/lib/seo/page-metadata';

// E12 (bd patsbythenumbers-pt2): season-by-season history of the 12 team
// phases. Season-AGNOSTIC by design — the inverse of E11's per-season
// browsing, so it lives outside app/s, takes no ?season=, and renders no
// HistoricalMarker. Adding it to SEASON_SCOPED_PATTERNS would be a bug.

export const revalidate = 3600;

const TEAM = 'NE' as const;

export const metadata: Metadata = pageMetadata({
  title: 'Trends',
  description:
    'Every Patriots phase ranked season by season since 2020 — pass offense to special teams, league rank and EPA/play on one axis.',
  og: {
    title: 'Six seasons, twelve phases',
    eyebrow: 'TRENDS',
  },
  canonical: '/trends',
});

/** Grid order for the small multiples. `overall` is the headline chart
 * above, so it is deliberately absent here. */
const GRID_GROUPS: ReadonlyArray<{ label: string; phases: readonly Phase[] }> = [
  { label: 'Offense', phases: PHASE_GROUPS.offensive_base },
  { label: 'Defense', phases: PHASE_GROUPS.defensive_base },
  { label: 'Situational', phases: PHASE_GROUPS.situational },
  { label: 'Explosive & special teams', phases: PHASE_GROUPS.explosive_and_st },
];

export default async function TrendsPage() {
  const currentSeason = await getCurrentSeason();
  const history = await getPhaseSeasonHistory(TEAM, currentSeason);
  const byPhase = new Map(history.map((s) => [s.phase, s]));

  const overall = byPhase.get('overall');
  const anyPublished = history.some((s) => s.publishedCount > 0);

  return (
    <section className="flex flex-col gap-12 py-12 md:gap-16 md:py-16">
      <header className="flex flex-col gap-5">
        <p
          className="font-mono text-2xs uppercase tracking-widest text-text-muted"
          data-testid="trends-eyebrow"
        >
          TRENDS · {EARLIEST_SEASON}–{currentSeason}
        </p>
        <h1 className="max-w-4xl font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display">
          Twelve phases, season by season.
        </h1>
        <p className="max-w-prose text-base text-text-muted md:text-lg">
          Each line is a league rank, not a raw number. League-wide EPA/play
          drifts from season to season, so 4th in {EARLIEST_SEASON} and 4th
          today mean the same thing while <span className="whitespace-nowrap">+0.08</span>{' '}
          does not. EPA/play rides along under each point.
        </p>
      </header>

      {!anyPublished ? (
        <p
          data-testid="trends-empty"
          className="rounded-sm border border-dashed border-border p-6 font-mono text-2xs uppercase tracking-widest text-text-muted"
        >
          No season has cleared the sample floor yet.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-6">
            <SectionHeader
              eyebrow="HEADLINE"
              title="Overall EPA differential"
              anchor="overall"
            />
            <p className="max-w-prose text-sm text-text-muted">
              Offensive EPA/play minus defensive EPA/play allowed — the one
              number that carries a whole season.
            </p>
            {overall ? (
              <SeasonRankChart points={overall.points} phaseLabel="Overall" />
            ) : null}
          </div>

          <div className="flex flex-col gap-10">
            <SectionHeader
              eyebrow="BY PHASE"
              title="Every phase, one axis"
              anchor="phases"
            />
            {GRID_GROUPS.map((group) => (
              <div key={group.label} className="flex flex-col gap-4">
                <h3 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
                  {group.label}
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {group.phases.map((phase) => {
                    const series = byPhase.get(phase);
                    return series ? (
                      <SeasonHistoryCard key={phase} series={series} />
                    ) : null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <aside className="border-l-2 border-positive bg-surface p-5 text-sm text-text-muted">
        <p className="max-w-prose">
          A season only appears once the Patriots have run at least{' '}
          {SEASON_SAMPLE_FLOOR} plays in that phase. Below the floor the point
          is left blank rather than plotted — an in-progress September carries
          no meaningful rank. Gaps in a line are missing data, never zero.
        </p>
      </aside>
    </section>
  );
}
