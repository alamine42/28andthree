import * as Sentry from '@sentry/nextjs';

// Browser-side Sentry. No-op when DSN is absent, so preview + local dev don't
// spam the project.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 0.05,
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      // Strip query strings from URLs to avoid leaking anything we don't expect.
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url);
          u.search = '';
          event.request.url = u.toString();
        } catch {
          // leave as-is
        }
      }
      // Drop request cookies + auth headers in case any SDK put them there.
      if (event.request?.cookies) event.request.cookies = undefined;
      if (event.request?.headers) {
        for (const k of Object.keys(event.request.headers)) {
          if (/^(cookie|authorization|x-admin-token)$/i.test(k)) {
            delete event.request.headers[k];
          }
        }
      }
      return event;
    },
  });
}
