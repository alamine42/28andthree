'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { DataRail } from '@/components/DataRail';
import { PageHead, PageShell, RailBlock, RailRow } from '@/components/PageShell';

// Route-group error boundary. Keeps the site chrome (header/footer) from
// RootLayout intact. Reports to Sentry on mount; renders a quiet, on-brand
// apology without leaking the stack trace.
//
// Production App Router drops `error.stack` and exposes only `error.digest`
// (the Sentry / Next error fingerprint) on the client. We surface the digest
// in tiny muted mono so a user pasting a screenshot gives us a correlation
// key, but never show the message itself.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <PageShell rail={<ErrorRail digest={error.digest} />}>
      <section data-testid="route-error" className="flex flex-col gap-8 md:gap-12">
        <PageHead
          eyebrow="Something broke"
          title="A fumble. Sorry about that."
          lede="The page failed to render and we were notified automatically. Try again; if it keeps happening, a data path is probably broken."
        />

        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm bg-accent px-6 font-mono text-2xs uppercase tracking-widest text-text transition-colors hover:bg-accent-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-positive"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex min-h-[44px] items-center font-mono text-2xs uppercase tracking-widest text-text-muted transition-colors hover:text-text focus-visible:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-positive"
          >
            &larr; Back to the season overview
          </a>
        </div>

        {error.digest ? (
          <p
            data-testid="error-digest"
            className="font-mono text-2xs uppercase tracking-widest text-text-muted"
          >
            Ref: <span className="text-text-muted">{error.digest}</span>
          </p>
        ) : null}
      </section>
    </PageShell>
  );
}

/** A failed render is not a missing page: recovery is retry, not
 * navigation, and the digest is what ties a report to the Sentry event. */
function ErrorRail({ digest }: { digest?: string }) {
  return (
    <>
      <RailBlock title="Reference">
        <dl className="space-y-2">
          <RailRow label="Digest" value={digest ?? '\u2014'} />
        </dl>
        <p className="mt-2 font-mono text-2xs text-text-muted">
          Quote this if you report the failure. No personal data is attached to it.
        </p>
      </RailBlock>
      <RailBlock title="Still working">
        <p className="text-xs text-text-muted">
          This boundary wraps one route. The rest of the site still renders the last good ETL run.
        </p>
      </RailBlock>
      <DataRail />
    </>
  );
}
