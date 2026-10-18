import Link from 'next/link';
import type { Route } from 'next';
import { RailBlock } from '@/components/PageShell';

// E13 direction B. Sources and methodology, in the rail on every data
// page. The footer carries the same links, but a reader who wants to know
// where a number came from has to scroll past the whole page to reach
// them; in the rail they sit beside the number.
//
// The freshness line reads the same cached DAL as SiteFooter, so the two
// can never disagree about when the numbers landed — the reason this block
// originally shipped without a timestamp at all.
//
// Kept synchronous, prop-driven, and free of any DB import: app/error.tsx
// is a client component (it reports to Sentry in an effect), so everything
// this module touches is bundled for the browser. Importing the refresh DAL
// here dragged `pg` into the client bundle and 500'd every route. The
// fetching wrapper lives in DataRailLive.tsx for that reason. The error page
// passes nothing and shows "unknown", which is the truth there anyway — if
// the render failed, a freshness query is not to be trusted either.
export function DataRail({ lastRefresh }: { lastRefresh?: string | null }) {
  return (
    <RailBlock title="Data">
      <dl className="space-y-2 font-mono text-2xs">
        <Row label="Last refresh" value={lastRefresh ?? 'unknown'} />
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
              // No prefetch. This rail renders on every data page, and Next
              // prefetches viewport links by default — so each page view fired
              // a background request at /status, which is force-dynamic,
              // no-store, and rate-limited to 60/min/IP in middleware. It
              // burned that budget for a page almost nobody clicks, and made
              // the E2E suite 429 on its own /status fetch.
              prefetch={false}
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
