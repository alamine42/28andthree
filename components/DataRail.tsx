import Link from 'next/link';
import type { Route } from 'next';
import { RailBlock } from '@/components/PageShell';

// E13 direction B. Sources and methodology, in the rail on every data
// page. The footer carries the same links, but a reader who wants to know
// where a number came from has to scroll past the whole page to reach
// them; in the rail they sit beside the number.
//
// Deliberately no "last refresh" timestamp here. SiteFooter owns that line
// and is the single source for it — duplicating a freshness claim in two
// places invites them to disagree. (Note: the footer is currently rendered
// without `lastRefreshIso` from the root layout, so it always reads
// "never" — a real bug, tracked separately, not papered over here.)
export function DataRail() {
  return (
    <RailBlock title="Data">
      <dl className="space-y-2 font-mono text-2xs">
        <Row label="Source" href="https://github.com/nflverse" value="nflverse" external />
        <Row label="Models" value="nflfastR · nfl4th" />
        <Row label="Status" href="/status" value="ETL heartbeat" />
      </dl>
      <Link
        href={'/methodology' as Route}
        className="mt-3 inline-flex min-h-[44px] items-center border-l-2 border-positive bg-surface px-3 py-2 text-xs text-text-muted transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive"
      >
        How these numbers are computed →
      </Link>
    </RailBlock>
  );
}

function Row({
  label,
  value,
  href,
  external,
}: {
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="uppercase tracking-widest text-text-muted">{label}</dt>
      <dd className="text-text">
        {href ? (
          external ? (
            <a
              href={href}
              rel="noopener noreferrer"
              target="_blank"
              className="inline-flex min-h-[44px] items-center underline decoration-border-strong underline-offset-4 hover:decoration-text md:min-h-0"
            >
              {value}
            </a>
          ) : (
            <Link
              href={href as Route}
              className="inline-flex min-h-[44px] items-center underline decoration-border-strong underline-offset-4 hover:decoration-text md:min-h-0"
            >
              {value}
            </Link>
          )
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
