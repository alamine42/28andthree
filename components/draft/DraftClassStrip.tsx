import type { DraftClassSummary } from '@/lib/data/draft';

type ClassCard = {
  year: number;
  total: number;
  summary: DraftClassSummary;
};

type Props = {
  classes: ReadonlyArray<ClassCard>;
};

// Top-of-page "at-a-glance" strip for /draft-roi. Hairline-gap grid mirroring
// HeroStats — each cell is an in-page anchor to the matching class section.
// Desktop: 5-col. Mobile: 2-col with last card spanning the full row.
export function DraftClassStrip({ classes }: Props) {
  return (
    <nav
      aria-label="Draft classes 2021 to 2025"
      data-testid="draft-strip"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-5"
    >
      {classes.map((c, i) => (
        <ClassCard key={c.year} card={c} isLast={i === classes.length - 1} />
      ))}
    </nav>
  );
}

function ClassCard({ card, isLast }: { card: ClassCard; isLast: boolean }) {
  const { year, total, summary } = card;
  const graded = summary.hit + summary.fair + summary.miss;
  const hitRate = graded > 0 ? summary.hit / graded : null;
  const spanCls = isLast ? 'col-span-2 md:col-span-1' : '';
  return (
    <a
      href={`#class-${year}`}
      data-testid={`draft-strip-card-${year}`}
      className={`group flex flex-col justify-between gap-4 bg-bg p-5 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive md:p-6 ${spanCls}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-2xl font-bold leading-none tracking-tightest text-text md:text-3xl">
          {year}
        </span>
        <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          {total} {total === 1 ? 'PICK' : 'PICKS'}
        </span>
      </div>

      <StackedGradeBar summary={summary} />

      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-2xs uppercase tracking-widest">
          <span className={summary.hit === 0 ? 'text-text-muted' : 'text-positive'}>
            <span className="tabular-nums">{summary.hit}</span>H
          </span>
          <Dot />
          <span className="text-text-muted">
            <span className="tabular-nums">{summary.fair}</span>F
          </span>
          <Dot />
          <span className={summary.miss === 0 ? 'text-text-muted' : 'text-text'}>
            <span className="tabular-nums">{summary.miss}</span>M
          </span>
          {summary.pending > 0 ? (
            <>
              <Dot />
              <span className="text-text-muted">
                <span className="tabular-nums">{summary.pending}</span>P
              </span>
            </>
          ) : null}
        </p>
        {hitRate !== null ? (
          <p
            data-numeric="true"
            className="font-mono text-2xs tabular-nums text-text-muted"
            title={`${summary.hit} of ${graded} graded picks are hits`}
          >
            {Math.round(hitRate * 100)}%
            <span className="ml-1 uppercase tracking-widest text-text-muted">HIT</span>
          </p>
        ) : null}
      </div>
    </a>
  );
}

function StackedGradeBar({ summary }: { summary: DraftClassSummary }) {
  const total = summary.hit + summary.fair + summary.miss + summary.pending;
  if (total === 0) {
    return <div aria-hidden="true" className="h-1.5 w-full rounded-sm bg-surface" />;
  }
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      role="img"
      aria-label={`${summary.hit} hit, ${summary.fair} fair, ${summary.miss} miss, ${summary.pending} pending`}
      className="flex h-1.5 w-full overflow-hidden rounded-sm bg-surface"
    >
      {summary.hit > 0 ? (
        <span style={{ width: pct(summary.hit) }} className="bg-positive" />
      ) : null}
      {summary.fair > 0 ? (
        <span style={{ width: pct(summary.fair) }} className="bg-border-strong" />
      ) : null}
      {summary.miss > 0 ? (
        <span style={{ width: pct(summary.miss) }} className="bg-negative" />
      ) : null}
      {summary.pending > 0 ? (
        <span style={{ width: pct(summary.pending) }} className="bg-text-dim" />
      ) : null}
    </div>
  );
}

function Dot() {
  return <span className="mx-1 text-text-muted">·</span>;
}
