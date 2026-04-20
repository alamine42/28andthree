import type { Metadata } from 'next';
import { getCurrentSeason } from '@/lib/data/current-season';
import {
  type CoachSegmentWithRollup,
  getCoachSegments,
  getFourthDownDecisions,
} from '@/lib/data/coaching';
import { pageMetadata } from '@/lib/seo/page-metadata';
import { CoachSegmentBanner } from '@/components/coaching/CoachSegmentBanner';
import { CoachingHero } from '@/components/coaching/CoachingHero';
import { PlayCallMixTable } from '@/components/coaching/PlayCallMixTable';
import { SituationalGrid } from '@/components/coaching/SituationalGrid';
import { ScoreStatePanel } from '@/components/coaching/ScoreStatePanel';
import { PersonnelPanel } from '@/components/coaching/PersonnelPanel';
import { FourthDownLedger } from '@/components/coaching/FourthDownLedger';
import { BlitzCard } from '@/components/coaching/BlitzCard';
import { SectionHeader } from '@/components/SectionHeader';

export const revalidate = 3600;

const TEAM = 'NE' as const;

type Role = 'HC' | 'OC' | 'DC';

export async function generateMetadata(): Promise<Metadata> {
  const season = await getCurrentSeason();
  return pageMetadata({
    title: 'Coaching tendencies',
    description: `Patriots ${season} coaching: play-call splits by down, situational rates, score-state pressure, personnel groupings, blitz rate, and a 4th-down ledger vs. the nfl4th model.`,
    og: {
      title: 'Patriots coaching, the tendencies that decide games',
      eyebrow: `COACHING \u00B7 ${season}`,
    },
    canonical: '/coaching',
  });
}

export default async function CoachingPage() {
  const season = await getCurrentSeason();
  const [segments, fourthDowns] = await Promise.all([
    getCoachSegments(TEAM, season),
    getFourthDownDecisions(TEAM, season),
  ]);

  const hasData = segments.length > 0;
  const ocRollup = latestSegment(segments, 'OC')?.rollup ?? null;
  const dcRollup = latestSegment(segments, 'DC')?.rollup ?? null;

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
        <p className="max-w-prose text-base text-text-muted md:text-lg">
          Play-call splits, situational rates, score-state pressure, and the
          4th-down ledger against Ben Baldwin&rsquo;s nfl4th model.
          Coordinator changes split into date-range rows so each tendency
          sits under the coach who produced it.
        </p>
      </header>

      {!hasData ? (
        <CoachingEmptyState />
      ) : (
        <>
          <CoachingHero
            season={season}
            offense={ocRollup}
            defense={dcRollup}
            fourthDowns={fourthDowns}
          />

          <CoachSegmentBanner segments={segments} />

          {ocRollup ? (
            <section className="flex flex-col gap-5">
              <SectionHeader
                eyebrow="Offense"
                title="Play-call mix & situation"
                anchor="offense"
              />
              <PlayCallMixTable rollup={ocRollup} />
              <SituationalGrid rollup={ocRollup} />
              <ScoreStatePanel rollup={ocRollup} />
            </section>
          ) : null}

          <section className="flex flex-col gap-5">
            <SectionHeader
              eyebrow="4th downs"
              title="Model vs. the gut"
              anchor="fourth-down"
            />
            {fourthDowns.length > 0 ? (
              <FourthDownLedger decisions={fourthDowns} />
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
                  computed for this season yet. Check back after the next
                  ETL run.
                </p>
              </aside>
            )}
          </section>

          {dcRollup ? (
            <section className="flex flex-col gap-5">
              <SectionHeader
                eyebrow="Defense"
                title="Pressure & personnel"
                anchor="defense"
              />
              <div
                className={`grid gap-8 ${dcRollup.blitzRate !== null ? 'md:grid-cols-2' : ''}`}
              >
                {dcRollup.blitzRate !== null ? (
                  <BlitzCard blitzRate={dcRollup.blitzRate} />
                ) : null}
                <PersonnelPanel rollup={dcRollup} />
              </div>
            </section>
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
            className="text-positive underline underline-offset-2 hover:text-text"
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
  segments: ReadonlyArray<CoachSegmentWithRollup>,
  role: Role,
) {
  return segments
    .filter((s) => s.role === role)
    .sort((a, b) => b.weekStart - a.weekStart)[0];
}

function CoachingEmptyState() {
  return (
    <div
      data-testid="coaching-empty-state"
      className="flex flex-col items-start gap-4 rounded-md border border-border bg-surface px-6 py-8 md:px-8 md:py-10"
    >
      <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        COACHING DATA — AWAITING ETL
      </p>
      <p className="max-w-prose text-base text-text md:text-lg">
        The weekly coaching-tendency rollups haven&rsquo;t been computed
        yet. Once the ingest runs you&rsquo;ll see per-coach play-call
        splits, situational rates, score-state pass rate, personnel
        groupings, and a 4th-down ledger against the nfl4th model.
      </p>
      <p className="font-mono text-xs text-text-muted">
        Next ETL: Tuesday 14:00 UTC · docs/runbook.md#etl-rollback
      </p>
    </div>
  );
}
