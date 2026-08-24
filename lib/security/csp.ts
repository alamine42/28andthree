// Content-Security-Policy builder. Two profiles:
//
//   production — enforced, no 'unsafe-eval'. 'unsafe-inline' stays on
//   script-src because Next 16's SSR bootstrap still emits inline
//   <script> tags at build time without per-request nonces (the nonce
//   path forces dynamic rendering, which we don't want for a mostly-ISR
//   site). When Next ships a clean nonce-plus-static story, drop the
//   'unsafe-inline' here.
//
//   development — enforced but permissive. Adds 'unsafe-eval' so
//   Turbopack HMR keeps working.
//
// Directives aim for prod-tight: default-src 'self', no object, no
// form-action escape, HSTS, upgrade-insecure-requests, and narrow
// connect-src for Sentry only.

export type CspEnv = 'development' | 'test' | 'production';

export function buildCsp(env: CspEnv, nonce: string): string {
  // NO nonce in script-src, in any env: once a nonce is present the
  // browser ignores 'unsafe-inline' (per CSP spec). Production mints a
  // fresh nonce per request while ISR serves CACHED HTML whose inline
  // hydration scripts carry the nonce baked at prerender time — mismatch,
  // every inline script blocked, client components never mount on cache
  // HITs (found live when E11's header switcher stayed a static
  // fallback). Nonce-based CSP requires dynamic rendering of every page;
  // this is a deliberately ISR-heavy site, so the header-comment design
  // ('unsafe-inline' until Next has a nonce-plus-static story) is the
  // policy. The nonce parameter is kept for the x-nonce request-header
  // plumbing but no longer appears in the policy.
  void nonce;
  const scriptSrc =
    env === 'production'
      ? ["'self'", "'unsafe-inline'"]
      : ["'self'", "'unsafe-inline'", "'unsafe-eval'"];

  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    ['script-src', scriptSrc],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'https://static.www.nfl.com']],
    ['font-src', ["'self'", 'data:']],
    [
      'connect-src',
      [
        "'self'",
        'https://*.sentry.io',
        'https://*.ingest.sentry.io',
        ...(env === 'development' ? ['ws:', 'wss:'] : []),
      ],
    ],
    ['frame-ancestors', ["'none'"]],
    ['frame-src', ["'none'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
  ];

  const parts = directives.map(([k, vs]) => `${k} ${vs.join(' ')}`);
  if (env === 'production') {
    parts.push('upgrade-insecure-requests');
  }
  return parts.join('; ');
}

export function makeNonce(): string {
  // Web Crypto is available in both the Edge runtime and modern Node.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // btoa would fail for the raw byte string; convert via Array → String → btoa.
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function currentCspEnv(): CspEnv {
  // Next 16 edge middleware bundles `process.env.NODE_ENV=production` at
  // compile time even under `next dev`, so it's unreliable as a signal.
  // VERCEL_ENV is only set in Vercel deployments and is the authoritative
  // production indicator; anything else falls back to dev.
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.NODE_ENV === 'test') return 'test';
  return 'development';
}
