import { NextResponse, type NextRequest } from 'next/server';
import { getEdgeRateLimiter, ipFromRequest } from '@/lib/ratelimit/edge';
import { resolveSeasonRouting } from '@/lib/season-view';
import { buildCsp, currentCspEnv, makeNonce } from '@/lib/security/csp';

// One middleware wearing three hats:
//
//   1. CSP + nonce on every document response (E6-09). Nonces are
//      per-request and echoed back as `x-nonce` so Server Components can
//      read them via next/headers if they ever need to attach nonces to
//      custom <script> tags.
//
//   2. 60 req/min/IP rate limit on /api/* + /status/* only (E6-08).
//      Separate buckets per path family so one burst can't exhaust the
//      other. /status/data keeps its own inner 20/60s limit on top.
//
//   3. E11 historical seasons: ?season=YYYY on a season-scoped path
//      rewrites to the internal static tree /s/[season]/... so clean URLs
//      keep their ISR entries; external hits on /s redirect back to the
//      public form. Decision core is pure + DB-free (lib/season-view.ts).

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
  // E10b L0-10: admin auth gate runs first on /admin/* and /api/authoring/*.
  // Dual path: cookie (operator) OR Bearer token (cron). Codex CRITICAL #2.
  const adminGate = checkAdminAuth(req);
  if (adminGate) return adminGate;

  const nonce = makeNonce();
  // Only attach CSP when the request hits a Vercel deploy — local `next dev`
  // can't serve inline hydration scripts with a nonce (Next doesn't
  // propagate to them), so any CSP with a nonce breaks interactivity.
  // Vercel sets `x-vercel-deployment-url` on every Edge Network request.
  const runningOnVercel = req.headers.has('x-vercel-deployment-url');
  const csp = runningOnVercel ? buildCsp(currentCspEnv(), nonce) : null;
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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(reset / 1000)),
      };
      if (csp) headers['Content-Security-Policy'] = csp;
      return new NextResponse(
        JSON.stringify({
          error: 'rate limited',
          retry_after_seconds: retryAfterSeconds,
        }),
        { status: 429, headers },
      );
    }

    const res = NextResponse.next({ request: { headers: requestHeaders } });
    if (csp) res.headers.set('Content-Security-Policy', csp);
    res.headers.set('X-RateLimit-Limit', '60');
    res.headers.set('X-RateLimit-Remaining', String(remaining));
    res.headers.set('X-RateLimit-Reset', String(Math.floor(reset / 1000)));
    return res;
  }

  const seasonRoute = resolveSeasonRouting(
    pathname,
    req.nextUrl.searchParams.get('season'),
  );
  if (seasonRoute) {
    const url = req.nextUrl.clone();
    url.pathname = seasonRoute.pathname;
    if (seasonRoute.kind === 'redirect') {
      // Preserve the incoming query (utm params, a valid ?season= on a
      // malformed /s path); a valid /s segment overrides the season.
      if (seasonRoute.seasonOverride != null) {
        url.searchParams.set('season', String(seasonRoute.seasonOverride));
      }
      return NextResponse.redirect(url, 308);
    }
    // Drop the season param from the internal URL: the /s route reads its
    // segment, and a query-free destination keeps one cache entry per
    // season instead of one per query-string variant.
    url.searchParams.delete('season');
    const res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    if (csp) res.headers.set('Content-Security-Policy', csp);
    return res;
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  if (csp) res.headers.set('Content-Security-Policy', csp);
  return res;
}

function shouldRateLimit(pathname: string): boolean {
  return RATE_LIMITED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

// Admin auth gate. Returns a NextResponse if the request should be blocked or
// redirected; null if the request should fall through to the rest of the
// middleware chain.
function checkAdminAuth(req: NextRequest): NextResponse | null {
  const path = req.nextUrl.pathname;
  const isAdminUI = path.startsWith('/admin') && path !== '/admin/login';
  const isAuthoringApi = path.startsWith('/api/authoring');
  if (!isAdminUI && !isAuthoringApi) return null;

  const sessionKey = process.env.ADMIN_SESSION_KEY;
  const cronToken = process.env.AUTHORING_CRON_TOKEN;
  if (!sessionKey) {
    return NextResponse.json(
      { error: 'admin disabled — ADMIN_SESSION_KEY not set' },
      { status: 503 },
    );
  }

  // Bearer token path (cron, CI). Bad bearer falls through to cookie check.
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (cronToken && timingSafeEqual(token, cronToken)) {
      return null;
    }
  }

  // Cookie path (operator browser).
  const cookie = req.cookies.get('28t_admin_session')?.value;
  if (cookie && timingSafeEqual(cookie, sessionKey)) {
    return null;
  }

  if (isAdminUI) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

// Constant-time string compare. Edge runtime doesn't have crypto.timingSafeEqual,
// so this is the manual XOR-loop equivalent. Walks the full max-length to avoid
// leaking length information via early return — codex pass-2 finding.
function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  // Seed accumulator with the length-diff so unequal lengths always fail.
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}
