import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 0.05,
    sendDefaultPii: false,
    beforeSend(event) {
      // Query strings may contain the ?debug=boom flag; mirror the client-side scrub.
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url);
          u.search = '';
          event.request.url = u.toString();
        } catch {
          // ignore
        }
      }
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
