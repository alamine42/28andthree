import type { ReactNode } from 'react';

// E13 direction B. Two shells own page width, so the root layout no longer
// caps anything:
//
//   PageShell  — data pages. 1600px cap, main column plus a 320px rail at
//                >=lg. The cap grows by the rail's width, so the main
//                column keeps roughly the measure it had at 1240px: the
//                rail is additive, not a squeeze.
//   ProseShell — editorial pages (methodology, about). 1240px cap, no
//                rail, and they keep the 120px section rhythm and the full
//                hero that data pages give up.
//
// Below lg the rail stacks under the main column, which is what the single
// column did before, so mobile is unchanged.

const GUTTER = 'px-4 md:px-6 lg:px-8';
// The shell owns vertical padding, not the page, so the main column and
// the rail start on the same line. When the page owned it the rail floated
// up by the padding amount and the two columns read as unrelated.
const PAD_Y = 'py-8 md:py-12';

export function PageShell({
  children,
  rail,
}: {
  children: ReactNode;
  /** Secondary content. Omit for a data page that has nothing to pin. */
  rail?: ReactNode;
}) {
  if (!rail) {
    return <div className={`mx-auto w-full max-w-content ${GUTTER} ${PAD_Y}`}>{children}</div>;
  }
  return (
    <div className={`mx-auto w-full max-w-[1600px] ${GUTTER} ${PAD_Y}`}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">{children}</div>
        <aside data-testid="page-rail" className="flex flex-col gap-8">
          {rail}
        </aside>
      </div>
    </div>
  );
}

export function ProseShell({ children }: { children: ReactNode }) {
  return <div className={PROSE_SHELL}>{children}</div>;
}

/** The ProseShell classes, for a page whose own root element can carry them.
 * Wrapping a long editorial page in <ProseShell> re-indents its whole body
 * for no behavioural gain; applying this to the existing root keeps the diff
 * to one line and the measure in one place. */
export const PROSE_SHELL = `mx-auto w-full max-w-content ${GUTTER}`;

export { PAD_Y as SHELL_PAD_Y };

/** The head that replaces the hero on data pages: eyebrow, one display
 * line, one lede line. The hero it replaces cost ~280px before the first
 * number — on a dashboard that is the most valuable space on the page. */
export function PageHead({
  eyebrow,
  title,
  lede,
  marker,
  breadcrumb,
  testId,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  /** Historical chip, small-sample caution — state that must stay visible. */
  marker?: ReactNode;
  breadcrumb?: ReactNode;
  testId?: string;
}) {
  return (
    <header className="mb-6">
      {breadcrumb}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <p
            data-testid={testId}
            className="flex flex-wrap items-center gap-x-2 font-mono text-2xs uppercase tracking-widest text-text-muted"
          >
            {eyebrow}
          </p>
          <h1 className="mt-1 max-w-4xl font-display text-2xl font-bold leading-tight tracking-tightest text-text">
            {title}
          </h1>
        </div>
        {lede ? <p className="max-w-[48ch] text-sm text-text-muted">{lede}</p> : null}
      </div>
      {marker ? <div className="mt-3">{marker}</div> : null}
    </header>
  );
}

/** A block in the rail: a heading rule, then a tight body. The rail is for
 * reference, never for primary reading. */
export function RailBlock({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-border pb-2">
        <h2 className="font-mono text-2xs uppercase tracking-widest text-text-muted">{title}</h2>
        {/* --text-dim fails WCAG AA at 2xs against --bg; axe flagged it on
            every page carrying a rail. --text-muted is the smallest tone
            that passes (DESIGN.md §Color). */}
        {note ? <span className="font-mono text-2xs text-text-muted">{note}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function RailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-2 font-mono text-2xs">
      <dt className="uppercase tracking-widest text-text-muted">{label}</dt>
      <dd className="tabular-nums text-text">{value}</dd>
    </div>
  );
}
