import { NextResponse, type NextRequest } from 'next/server';
import { getEdgeRateLimiter, ipFromRequest } from '@/lib/ratelimit/edge';

// E6-08: edge rate limit — 60 req/min/IP on /api/* and /status/*.
// Layered with the existing /status/data 20/60s limit in lib/status-data:
// this middleware is the coarse per-IP cap; the route-level limit is the
// finer per-endpoint cap.

export const config = {
  matcher: ['/api/:path*', '/status', '/status/:path*'],
};

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const limiter = getEdgeRateLimiter();
  const ip = ipFromRequest(req);
  const key = `${ip}:${pathFamily(req.nextUrl.pathname)}`;

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
        },
      },
    );
  }

  const res = NextResponse.next();
  res.headers.set('X-RateLimit-Limit', '60');
  res.headers.set('X-RateLimit-Remaining', String(remaining));
  res.headers.set('X-RateLimit-Reset', String(Math.floor(reset / 1000)));
  return res;
}

// Separate counting for /api and /status traffic so a burst against one
// family can't exhaust the other. /status/data keeps its own inner limit
// on top of this coarse envelope.
function pathFamily(pathname: string): 'api' | 'status' {
  return pathname.startsWith('/api') ? 'api' : 'status';
}
