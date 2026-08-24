'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

// Historical season browsing (prototype). Persistent marker while a past
// season is in view; "Back to current" drops the ?season param — the
// clean URL of the same page.
export function HistoricalMarker({
  season,
  current,
}: {
  season: number;
  current: number;
}) {
  const pathname = usePathname();
  return (
    <p
      data-testid="historical-marker"
      className="flex flex-wrap items-center gap-3 font-mono text-2xs uppercase tracking-widest"
    >
      <span className="rounded-sm border border-border-strong px-2 py-0.5 text-text-muted">
        Historical · <span className="tabular-nums">{season}</span>
      </span>
      <Link
        href={pathname as Route}
        className="inline-flex min-h-[32px] items-center text-text-muted underline underline-offset-4 decoration-border-strong transition-colors hover:text-text hover:decoration-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive"
      >
        Back to <span className="tabular-nums">&nbsp;{current}</span>
      </Link>
    </p>
  );
}
