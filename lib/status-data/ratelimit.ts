import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getServerEnv } from '@/lib/env';

// 60 req/min/IP per plan §3.9. Sliding window because token-bucket burstiness
// would let a leaked token amplify traffic past the intended average.
const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 60;

export type RateLimitResult = { success: boolean; reset: number };

type Limiter = {
  limit(key: string): Promise<RateLimitResult>;
};

let cached: Limiter | undefined;

export function getRateLimiter(): Limiter {
  if (cached) return cached;
  const env = getServerEnv();
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    // No Upstash configured: the endpoint will short-circuit at the auth
    // check, but if it didn't we'd want deterministic behavior for local dev
    // rather than an unbounded rate limiter. Log once so it's visible.
    console.warn('status-data: Upstash not configured; rate limiter runs in permit-all mode');
    cached = _permitAllLimiter();
    return cached;
  }
  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX_REQUESTS, `${WINDOW_SECONDS} s`),
    analytics: false,
    prefix: 'ratelimit:status-data',
  });
  cached = {
    async limit(key) {
      const { success, reset } = await rl.limit(key);
      return { success, reset };
    },
  };
  return cached;
}

function _permitAllLimiter(): Limiter {
  return {
    async limit(_key: string) {
      return { success: true, reset: 0 };
    },
  };
}

/** Extract a stable identifier from the request. Favor x-forwarded-for on
 * Vercel, fall back to a placeholder so local dev doesn't crash. */
export function ipFromRequest(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

export function resetRateLimiterForTests(): void {
  cached = undefined;
}
