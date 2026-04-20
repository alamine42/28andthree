import type { Metadata } from 'next';
import { getCurrentSeason } from '@/lib/data/current-season';
import { type DraftClassSummary, type DraftRoiRow, getDraftRoiByClass } from '@/lib/data/draft';
import { ClassTable } from '@/components/draft/ClassTable';
import { DraftClassStrip } from '@/components/draft/DraftClassStrip';
import { pageMetadata } from '@/lib/seo/page-metadata';

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: 'Draft ROI',
  description:
    'Every Patriots pick 2021\u20132025 graded HIT / FAIR / MISS against a slot-expected-value curve fit from league-wide outcomes.',
  og: {
    title: 'Mayo & Wolf, by the draft class',
    eyebrow: 'DRAFT \u00B7 2021\u20132025',
  },
  canonical: '/draft-roi',
});

const DRAFT_CLASS_YEARS: readonly number[] = [2025, 2024, 2023, 2022, 2021];

export default async function DraftRoiPage() {
  const currentSeason = await getCurrentSeason();
  const classes = await Promise.all(
    DRAFT_CLASS_YEARS.map(async (year) => {
      const rows = await getDraftRoiByClass(year, currentSeason);
      return { year, rows, summary: summarize(rows) };
    }),
  );

  const anyData = classes.some((c) => c.rows.length > 0);
  const stripData = classes.map((c) => ({
    year: c.year,
    total: c.rows.length,
    summary: c.summary,
  }));

  return (
    <section className="flex flex-col gap-12 py-12 md:gap-16 md:py-16">
      <header className="flex flex-col gap-5">
        <p
          className="font-mono text-2xs uppercase tracking-widest text-text-muted"
          data-testid="draft-eyebrow"
        >
          DRAFT · 2021–2025
        </p>
        <h1 className="max-w-4xl font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display">
          Mayo &amp; Wolf, by the draft class.
        </h1>
        <p className="max-w-prose text-base text-text-muted md:text-lg">
          Five classes, fifty-odd picks. Slot-expected value is the curve fit
          against 2015–2024 league-wide outcomes at the same slot. Actual
          value is EPA-weighted contribution to date for skill positions;
          for trench + secondary picks it&rsquo;s a unit-proxy tier (marked
          with an asterisk).
        </p>
      </header>

      {!anyData ? (
        <DraftEmptyState />
      ) : (
        <>
          <DraftClassStrip classes={stripData} />

          <div className="flex flex-col gap-14">
            {classes.map(({ year, rows, summary }) =>
              rows.length > 0 ? (
                <ClassTable
                  key={year}
                  draftSeason={year}
                  rows={rows}
                  summary={summary}
                />
              ) : null,
            )}
          </div>
        </>
      )}

      <aside
        className="flex flex-col gap-2 rounded-sm border-l-2 border-positive bg-surface px-4 py-3"
        data-testid="draft-methodology-callout"
      >
        <p className="font-mono text-2xs uppercase tracking-widest text-positive">
          Methodology
        </p>
        <p className="max-w-prose text-sm text-text">
          HIT ≥ 1.25× slot-expected value · FAIR 0.75–1.25× · MISS &lt; 0.75× ·
          PENDING for sub-2-season picks and K/P/LS.{' '}
          <a
            href="/methodology#draft-grade"
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

function summarize(rows: ReadonlyArray<DraftRoiRow>): DraftClassSummary {
  const counts: DraftClassSummary = { hit: 0, fair: 0, miss: 0, pending: 0 };
  for (const r of rows) {
    if (r.grade === 'HIT') counts.hit++;
    else if (r.grade === 'FAIR') counts.fair++;
    else if (r.grade === 'MISS') counts.miss++;
    else counts.pending++;
  }
  return counts;
}

function DraftEmptyState() {
  return (
    <div
      data-testid="draft-empty-state"
      className="flex flex-col items-start gap-4 rounded-md border border-border bg-surface px-6 py-8 md:px-8 md:py-10"
    >
      <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        DRAFT DATA — AWAITING ETL
      </p>
      <p className="max-w-prose text-base text-text md:text-lg">
        The slot-expected-value curve and the Pats pick roster haven&rsquo;t
        landed yet. Once the ingest runs, each draft class renders as a
        HIT&thinsp;/&thinsp;FAIR&thinsp;/&thinsp;MISS table with actual vs.
        expected contribution.
      </p>
      <p className="font-mono text-xs text-text-muted">
        Next ETL: Tuesday 14:00 UTC · docs/runbook.md#etl-rollback
      </p>
    </div>
  );
}
