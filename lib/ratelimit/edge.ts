import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Edge-compatible rate limiter for Next middleware. Sliding window 60/min/IP
// per plan §3.9. Falls back to an in-memory limiter when Upstash creds are
// absent so local dev + integration tests can still exercise the 429 path.
//
// Note: the in-memory fallback is per-edge-instance, not global — in a
// multi-region production deploy it would under-count. Upstash is mandatory
// in prod (HANDOVER §2); this file's fallback is strictly a dev convenience.

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 60;
const PREFIX = 'ratelimit:edge-mw';

export type EdgeLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
};

type Limiter = {
  limit(key: string): Promise<EdgeLimitResult>;
};

let cached: Limiter | undefined;

export function getEdgeRateLimiter(): Limiter {
  if (cached) return cached;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn(
      'edge rate limiter: Upstash not configured; using in-memory fallback',
    );
    cached = createMemoryLimiter();
    return cached;
  }

  const redis = new Redis({ url, token });
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX_REQUESTS, `${WINDOW_SECONDS} s`),
    analytics: false,
    prefix: PREFIX,
  });
  cached = {
    async limit(key) {
      const res = await rl.limit(key);
      return { success: res.success, remaining: res.remaining, reset: res.reset };
    },
  };
  return cached;
}

export function ipFromRequest(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

export function resetEdgeRateLimiterForTests(): void {
  cached = undefined;
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

function createMemoryLimiter(): Limiter {
  const buckets = new Map<string, number[]>();
  return {
    async limit(key) {
      const now = Date.now();
      const windowStart = now - WINDOW_SECONDS * 1000;
      const hits = (buckets.get(key) ?? []).filter((t) => t >= windowStart);
      if (hits.length >= MAX_REQUESTS) {
        const oldest = hits[0] ?? now;
        return {
          success: false,
          remaining: 0,
          reset: oldest + WINDOW_SECONDS * 1000,
        };
      }
      hits.push(now);
      buckets.set(key, hits);
      return {
        success: true,
        remaining: MAX_REQUESTS - hits.length,
        reset: now + WINDOW_SECONDS * 1000,
      };
    },
  };
}
