import path from 'node:path';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

// Sandbox isolation (E8-09): when NEXT_PUBLIC_SANDBOX_MODE is not '1',
// alias every sandbox stub + fixture module to a throw-on-call empty
// stub. Tree-shaking alone is insufficient because dynamic imports in
// DAL wrappers create live edges; the alias severs those at build time
// so no fixture bytes enter the prod bundle. CI enforces this with a
// grep sentinel — see .github/workflows/sandbox-isolation.yml.
const SANDBOX_ON = process.env.NEXT_PUBLIC_SANDBOX_MODE === '1';
// Turbopack wants project-relative paths (POSIX); webpack accepts absolute.
const EMPTY_STUB_REL = './lib/sandbox/empty-stub.ts';
const EMPTY_STUB_ABS = path.resolve(process.cwd(), 'lib/sandbox/empty-stub.ts');

// Every import specifier the DAL wrappers / layout can reach into
// sandbox land. Aliased to the throw-on-call empty stub in prod builds
// so no fixture bytes ship.
const SANDBOX_ALIAS_KEYS = [
  '@/lib/sandbox/fixtures/team',
  '@/lib/sandbox/fixtures/phases',
  '@/lib/sandbox/fixtures/draft',
  '@/lib/sandbox/fixtures/coaching',
  '@/lib/sandbox/stubs/team',
  '@/lib/sandbox/stubs/phases',
  '@/lib/sandbox/stubs/draft',
  '@/lib/sandbox/stubs/coaching',
  '@/lib/sandbox/stubs/current-season',
  '@/lib/sandbox/stubs/contributors',
];
const turbopackAliasMap: Record<string, string> = SANDBOX_ON
  ? {}
  : Object.fromEntries(SANDBOX_ALIAS_KEYS.map((k) => [k, EMPTY_STUB_REL]));
const webpackAliasMap: Record<string, string> = SANDBOX_ON
  ? {}
  : Object.fromEntries(SANDBOX_ALIAS_KEYS.map((k) => [k, EMPTY_STUB_ABS]));

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
  // Next.js 16 default bundler. resolveAlias severs the dynamic-import
  // edges before Turbopack walks them, so no fixture bytes enter the
  // prod bundle. Mirrors the webpack alias below — both are needed
  // because sentry sometimes forces webpack for specific chunks.
  turbopack: {
    resolveAlias: turbopackAliasMap,
  },
  webpack: (config) => {
    if (!SANDBOX_ON) {
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        ...webpackAliasMap,
      };
    }
    return config;
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
