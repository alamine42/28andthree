'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

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
    <section
      data-testid="route-error"
      className="flex flex-col gap-12 py-16 md:gap-16 md:py-24"
    >
      <header className="flex flex-col gap-5">
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Something broke
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display">
          A fumble. Sorry about that.
        </h1>
        <p className="max-w-prose text-base text-text-muted md:text-lg">
          The page failed to render. We were notified automatically. Try
          again; if it keeps happening, the ETL or a data path is probably
          broken and we&rsquo;re already on it.
        </p>
      </header>

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
  );
}
