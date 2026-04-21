import { NextResponse, type NextRequest } from 'next/server';
import { getEdgeRateLimiter, ipFromRequest } from '@/lib/ratelimit/edge';
import { buildCsp, currentCspEnv, makeNonce } from '@/lib/security/csp';

// One middleware wearing two hats:
//
//   1. CSP + nonce on every document response (E6-09). Nonces are
//      per-request and echoed back as `x-nonce` so Server Components can
//      read them via next/headers if they ever need to attach nonces to
//      custom <script> tags.
//
//   2. 60 req/min/IP rate limit on /api/* + /status/* only (E6-08).
//      Separate buckets per path family so one burst can't exhaust the
//      other. /status/data keeps its own inner 20/60s limit on top.

export const config = {
  // Match everything except static chunks, the /og image, and the image
  // optimizer — those don't need CSP rewriting and avoiding them keeps
  // the hot path cheap.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|apple-icon|icon|robots\\.txt|sitemap\\.xml|og).*)',
  ],
};

const RATE_LIMITED_PREFIXES = ['/api', '/status'] as const;

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const nonce = makeNonce();
  const csp = buildCsp(currentCspEnv(), nonce);
  const pathname = req.nextUrl.pathname;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  if (shouldRateLimit(pathname)) {
    const limiter = getEdgeRateLimiter();
    const ip = ipFromRequest(req);
    const key = `${ip}:${pathname.startsWith('/api') ? 'api' : 'status'}`;
    const { success, remaining, reset } = await limiter.limit(key);

    if (!success) {
      const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return new NextResponse(
        JSON.stringify({
          error: 'rate limited',
          retry_after_seconds: retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfterSeconds),
            'X-RateLimit-Limit': '60',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(reset / 1000)),
            'Content-Security-Policy': csp,
          },
        },
      );
    }

    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('Content-Security-Policy', csp);
    res.headers.set('X-RateLimit-Limit', '60');
    res.headers.set('X-RateLimit-Remaining', String(remaining));
    res.headers.set('X-RateLimit-Reset', String(Math.floor(reset / 1000)));
    return res;
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

function shouldRateLimit(pathname: string): boolean {
  return RATE_LIMITED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
