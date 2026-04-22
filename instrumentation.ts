// Next.js 15 instrumentation hook. Loads the correct Sentry config per runtime
// and runs the E8 sandbox prod-safety guard (fires before any request is
// served — codex F3 patch).
import { assertSandboxNotInProd } from './lib/sandbox/env-guard';

export async function register() {
  assertSandboxNotInProd();
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs';
