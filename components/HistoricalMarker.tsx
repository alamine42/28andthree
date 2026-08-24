import { getSeasonContext } from '@/lib/data/current-season';

// E11: persistent marker while a past season is in view; "Back to
// {current}" links to the clean URL of the same page. Server component —
// it resolves the current season itself (React-cached, zero extra
// queries), so templates only pass the season and their clean path.
export async function HistoricalMarker({
  season,
  backHref,
}: {
  season: number;
  backHref: string;
}) {
  const { season: current } = await getSeasonContext();
  return (
    <p
      data-testid="historical-marker"
      className="flex flex-wrap items-center gap-3 font-mono text-2xs uppercase tracking-widest"
    >
      <span className="rounded-sm border border-border-strong px-2 py-0.5 text-text-muted">
        Historical · <span className="tabular-nums">{season}</span>
      </span>
      {/* Plain anchor, not <Link>: the app router silently no-ops a soft
          navigation from a rewritten ?season= URL to the same pathname's
          clean URL (Next 16; code review pass 2 follow-through). A real
          browser navigation always lands. */}
      <a
        href={backHref}
        className="inline-flex min-h-[32px] items-center text-text-muted underline underline-offset-4 decoration-border-strong transition-colors hover:text-text hover:decoration-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive"
      >
        Back to <span className="tabular-nums">{current}</span>
      </a>
    </p>
  );
}
