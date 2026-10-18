import Link from 'next/link';
import type { Route } from 'next';
import { BShell, DataRail, PageHead, RailBlock, RailRow } from '../_shell';

// State 6 — the error boundary. A render or query failure, not a missing
// page. The distinction matters: 404 means "nothing here", this means
// "something here broke", and the recovery is retry, not navigate.
export default function BError() {
  return (
    <BShell active="Team" screen="Error boundary" rail={<Rail />}>
      <PageHead
        eyebrow="Error · the page failed to render"
        title="Something broke on our side."
        lede="This is not a missing page. A query or a render failed, and the error is logged."
      />

      <div className="border-l-2 border-negative bg-surface px-4 py-3">
        <p className="font-mono text-2xs uppercase tracking-widest text-negative">Reference</p>
        <p className="mt-1 font-mono text-sm tabular-nums text-text">a4f2e91c</p>
        <p className="mt-2 max-w-prose text-sm text-text-muted">
          Quote that reference if you report this. It ties to the Sentry event — no personal data is
          attached to it.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="bg-accent px-4 py-2 text-sm text-text hover:bg-accent-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive"
        >
          Try again
        </button>
        <Link
          href={'/proto/b' as Route}
          className="border border-border-strong px-4 py-2 text-sm text-text-muted hover:text-text"
        >
          Season overview
        </Link>
      </div>

      <p className="mt-6 max-w-prose text-sm text-text-muted">
        Numbers already on screen elsewhere are unaffected — this boundary wraps one route, so the
        rest of the site still renders the last good ETL run.
      </p>
    </BShell>
  );
}

function Rail() {
  return (
    <>
      <RailBlock title="Status">
        <dl className="space-y-2">
          <RailRow label="Last good ETL" value="Tue 10:06 AM ET" />
          <RailRow label="Site status" value="/status" />
        </dl>
      </RailBlock>
      <DataRail />
    </>
  );
}
