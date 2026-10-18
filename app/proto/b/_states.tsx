import Link from 'next/link';
import type { Route } from 'next';
import { Eyebrow } from '../_components/shared';

// The states every data screen has to carry. These mirror the live
// components (NoSeasonData, HistoricalMarker, SmallSampleBanner,
// SeasonNotice) so the prototype shows how direction B holds them, not a
// prettier invention of them.

export type ScreenState = 'loaded' | 'small-sample' | 'historical' | 'no-data' | 'awaiting-etl';

const STATES: { id: ScreenState; label: string }[] = [
  { id: 'loaded', label: 'Loaded' },
  { id: 'small-sample', label: 'n < 30' },
  { id: 'historical', label: 'Historical' },
  { id: 'no-data', label: 'No data' },
];

/** Prototype-only control. Not part of direction B — it exists so each
 * state can be reviewed on demand instead of waiting for the condition. */
export function StateSwitcher({
  base,
  current,
  states,
}: {
  base: string;
  current: ScreenState;
  /** Subset for screens that cannot reach every state. */
  states?: ScreenState[];
}) {
  const shown = states ? STATES.filter((s) => states.includes(s.id)) : STATES;
  return (
    <div className="flex flex-wrap items-center gap-2 border border-dashed border-border-strong px-3 py-2">
      <span className="font-mono text-2xs uppercase tracking-widest text-text-dim">
        Prototype state
      </span>
      {shown.map((s) => (
        <Link
          key={s.id}
          href={`${base}?state=${s.id}` as Route}
          className={`border px-2 py-0.5 font-mono text-2xs uppercase tracking-widest ${
            s.id === current
              ? 'border-positive text-positive'
              : 'border-border-strong text-text-muted hover:text-text'
          }`}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}

/** HistoricalMarker, in the page head rather than floating above it. */
export function HistoricalChip({ season, backHref }: { season: number; backHref: string }) {
  return (
    <p className="flex flex-wrap items-center gap-3 font-mono text-2xs uppercase tracking-widest">
      <span className="border border-border-strong px-2 py-0.5 text-text-muted">
        Historical · <span className="tabular-nums">{season}</span>
      </span>
      <a
        href={backHref}
        className="inline-flex min-h-[32px] items-center text-text-muted underline decoration-border-strong underline-offset-4 hover:text-text hover:decoration-text"
      >
        Back to <span className="tabular-nums">2026</span>
      </a>
    </p>
  );
}

/** SmallSampleBanner / the n<30 caution. DESIGN.md callout: surface bg,
 * 2px positive left border, no icon, no colour flood. */
export function SmallSampleCallout({
  n = 24,
  threshold = 30,
  kind = 'plays',
}: {
  n?: number;
  threshold?: number;
  kind?: string;
}) {
  // Matches the live SmallSampleBanner: above the threshold there is no
  // caution at all. A banner that fires regardless of n trains readers to
  // ignore it, which costs us the one place the caution matters.
  if (n >= threshold) return null;
  return (
    <aside
      role="note"
      className="flex flex-col gap-1 border-l-2 border-positive bg-surface px-4 py-3"
    >
      <Eyebrow>Small sample</Eyebrow>
      <p className="text-sm text-text">
        {n} {kind} season-to-date. Below the {threshold}-{kind.replace(/s$/, '')} floor; the rank is
        provisional and will move.
      </p>
    </aside>
  );
}

/** NoSeasonData. The copy must not promise data that will never arrive. */
export function NoDataCallout({
  season,
  variant = 'upcoming',
  message,
}: {
  season: number;
  variant?: 'upcoming' | 'historical';
  message?: string;
}) {
  const copy =
    message ??
    (variant === 'historical'
      ? `No ${season} stats for this view.`
      : `No ${season} stats for this view yet. New numbers land every Tuesday.`);
  return (
    <p className="border-l-2 border-positive bg-surface px-4 py-3 text-sm text-text-muted">
      {copy}
    </p>
  );
}

/** The awaiting-ETL shell — what /coaching shows today. */
export function AwaitingEtl({ title, body, next }: { title: string; body: string; next: string }) {
  return (
    <div className="border border-border bg-surface p-6">
      <Eyebrow>{title}</Eyebrow>
      <p className="mt-3 max-w-prose text-base text-text">{body}</p>
      <p className="mt-4 font-mono text-2xs text-text-dim">{next}</p>
    </div>
  );
}
