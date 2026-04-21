import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

// CSP is now built + attached per-request in middleware.ts so each
// response can carry a unique nonce (E6-09). Static headers below don't
// change per request so they stay here.
const securityHeaders: Array<{ key: string; value: string }> = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/status',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },
  experimental: {
    typedRoutes: true,
  },
};

// Wrap with Sentry so source maps upload in CI (needs SENTRY_AUTH_TOKEN). The
// wrapper is a no-op when NEXT_PUBLIC_SENTRY_DSN is absent.
const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: undefined,
  hideSourceMaps: true,
};

export default withSentryConfig(nextConfig, sentryConfig);
