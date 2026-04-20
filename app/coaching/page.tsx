import { getCurrentSeason } from '@/lib/data/current-season';
import { getCoachSegments, getFourthDownDecisions } from '@/lib/data/coaching';
import { CoachSegmentBanner } from '@/components/coaching/CoachSegmentBanner';
import { PlayCallMixTable } from '@/components/coaching/PlayCallMixTable';
import { ScatterPlot, type ScatterPoint } from '@/components/charts/ScatterPlot';

export const revalidate = 3600;

const TEAM = 'NE' as const;

export default async function CoachingPage() {
  const season = await getCurrentSeason();
  const [segments, fourthDowns] = await Promise.all([
    getCoachSegments(TEAM, season),
    getFourthDownDecisions(TEAM, season),
  ]);

  const hasData = segments.length > 0;
  const hasFourthDown = fourthDowns.length > 0;

  // One representative rollup per role for the headline tables. When a
  // coordinator changes mid-season we show the most recent segment; the
  // banner above already communicates the split.
  const ocRollup = latestSegment(segments, 'OC')?.rollup;
  const dcRollup = latestSegment(segments, 'DC')?.rollup;

  return (
    <section className="flex flex-col gap-12 py-12 md:gap-16 md:py-16">
      <header className="flex flex-col gap-5">
        <p
          className="font-mono text-2xs uppercase tracking-widest text-text-muted"
          data-testid="coaching-eyebrow"
        >
          {season} SEASON · COACHING TENDENCIES
        </p>
        <h1 className="max-w-4xl font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display">
          Patriots coaching, the tendencies that decide games.
        </h1>
      </header>

      {!hasData ? (
        <p
          data-testid="coaching-empty-state"
          className="max-w-prose font-mono text-2xs uppercase tracking-widest text-text-muted"
        >
          Coaching data unavailable — check back after the next ETL run.
        </p>
      ) : (
        <>
          <CoachSegmentBanner segments={segments} />

          {ocRollup ? <PlayCallMixTable rollup={ocRollup} /> : null}

          {ocRollup ? <SituationalSplits rollup={ocRollup} /> : null}

          {hasFourthDown ? (
            <section
              className="flex flex-col gap-3"
              data-testid="fourth-down-section"
            >
              <h2 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
                4th-down aggressiveness
              </h2>
              <ScatterPlot
                data={toScatterPoints(fourthDowns)}
                xLabel="Model WP boost if Pats go for it"
                yLabel="Went for it (0 or 1)"
                title="Pats 4th-down decisions vs. model recommendation"
              />
            </section>
          ) : (
            <aside
              data-testid="fourth-down-pending"
              className="flex flex-col gap-2 rounded-sm border-l-2 border-positive bg-surface px-4 py-3"
            >
              <p className="font-mono text-2xs uppercase tracking-widest text-positive">
                4th down — model pending
              </p>
              <p className="max-w-prose text-sm text-text">
                Recommendations from the 4th-down model haven&rsquo;t been
                computed for this season yet. Check back after the next ETL
                run.
              </p>
            </aside>
          )}

          {dcRollup?.blitzRate != null ? (
            <BlitzPanel
              blitzRate={dcRollup.blitzRate}
              data-testid="blitz-panel"
            />
          ) : null}
        </>
      )}

      <aside
        className="flex flex-col gap-2 rounded-sm border-l-2 border-positive bg-surface px-4 py-3"
        data-testid="coaching-methodology-callout"
      >
        <p className="font-mono text-2xs uppercase tracking-widest text-positive">
          Methodology
        </p>
        <p className="max-w-prose text-sm text-text">
          Coordinator segments render per SPEC §3.5a: when a role changes
          mid-season, you&rsquo;ll see two rows. 4th-down recommendations
          come from Ben Baldwin&rsquo;s nfl4th model, computed in the ETL.{' '}
          <a
            href="/methodology#coaching"
            className="text-positive underline underline-offset-2"
          >
            Full methodology
          </a>
          .
        </p>
      </aside>
    </section>
  );
}

function latestSegment(
  segments: Awaited<ReturnType<typeof getCoachSegments>>,
  role: 'HC' | 'OC' | 'DC',
) {
  return segments
    .filter((s) => s.role === role)
    .sort((a, b) => b.weekStart - a.weekStart)[0];
}

function SituationalSplits({ rollup }: { rollup: NonNullable<Awaited<ReturnType<typeof getCoachSegments>>[number]['rollup']> }) {
  const rows: Array<{ label: string; key: 'shotgunRate' | 'playActionRate' | 'motionRate' | 'noHuddleRate' }> = [
    { label: 'Shotgun', key: 'shotgunRate' },
    { label: 'Play-action', key: 'playActionRate' },
    { label: 'Pre-snap motion', key: 'motionRate' },
    { label: 'No-huddle', key: 'noHuddleRate' },
  ];
  return (
    <div data-testid="situational-splits" className="flex flex-col gap-2">
      <h2 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        Situational rates
      </h2>
      <ul className="flex flex-col">
        {rows.map((r) => {
          const v = rollup[r.key];
          return (
            <li
              key={r.key}
              className="flex items-baseline justify-between border-b border-border py-2"
            >
              <span className="text-sm text-text">{r.label}</span>
              <span
                className="font-mono text-sm tabular-nums text-text"
                data-numeric="true"
              >
                {v === null ? '—' : `${Math.round(v * 100)}%`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BlitzPanel({ blitzRate }: { blitzRate: number; 'data-testid'?: string }) {
  return (
    <div data-testid="blitz-panel" className="flex flex-col gap-2">
      <h2 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        Blitz rate
      </h2>
      <p
        className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-display"
        data-numeric="true"
      >
        {Math.round(blitzRate * 100)}%
      </p>
    </div>
  );
}

function toScatterPoints(
  decisions: Awaited<ReturnType<typeof getFourthDownDecisions>>,
): ScatterPoint[] {
  return decisions.map((d) => ({
    x: d.wpBoostGo,
    y: d.wentForIt ? 1 : 0,
    highlighted: true,
    label: `Week ${d.week} · ${d.wentForIt ? 'went' : 'kicked'} · model ${d.goRecommended ? 'recommended GO' : 'recommended KICK'}`,
  }));
}
