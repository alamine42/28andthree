'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import './globals.css';

// Root-level error boundary. Fires when RootLayout itself throws — e.g.,
// during font provider evaluation or env-var parsing — so it MUST render
// its own <html> + <body>. Keeps the palette from globals.css but omits
// the site chrome since that chrome is what failed.
export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-screen bg-bg text-text antialiased">
        <main
          data-testid="global-error"
          className="mx-auto flex min-h-screen w-full max-w-content flex-col justify-center gap-8 px-4 py-16 md:px-8"
        >
          <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
            Something broke (root)
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display">
            The site layout failed to load.
          </h1>
          <p className="max-w-prose font-mono text-xs text-text-muted">
            We were notified automatically. Please retry; if the problem
            persists, the build or the environment is misconfigured.
          </p>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm bg-accent px-6 font-mono text-2xs uppercase tracking-widest text-text transition-colors hover:bg-accent-dim"
            >
              Try again
            </button>
          </div>
          {error.digest ? (
            <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
              Ref: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
