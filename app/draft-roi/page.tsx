import { getCurrentSeason } from '@/lib/data/current-season';
import { getDraftClassSummary, getDraftRoiByClass } from '@/lib/data/draft';
import { ClassTable } from '@/components/draft/ClassTable';

export const revalidate = 3600;

const DRAFT_CLASS_YEARS: readonly number[] = [2025, 2024, 2023, 2022, 2021];

export default async function DraftRoiPage() {
  const currentSeason = await getCurrentSeason();
  const classes = await Promise.all(
    DRAFT_CLASS_YEARS.map(async (year) => ({
      year,
      rows: await getDraftRoiByClass(year, currentSeason),
      summary: await getDraftClassSummary(year, currentSeason),
    })),
  );

  const anyData = classes.some((c) => c.rows.length > 0);

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
        <p
          data-testid="draft-empty-state"
          className="max-w-prose font-mono text-2xs uppercase tracking-widest text-text-muted"
        >
          Draft data unavailable — check back after the next ETL run.
        </p>
      ) : (
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
