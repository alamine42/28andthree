import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';

// E6-08: burst test — 60/min/IP sliding window on /api/* and /status/*.
// Each test uses a unique X-Forwarded-For IP so the middleware's in-memory
// fallback (dev mode without Upstash creds) treats them as isolated buckets.

const LIMIT = 60;
const BURST = 70;

async function burst(
  request: APIRequestContext,
  path: string,
  ip: string,
): Promise<number[]> {
  // Sequential rather than parallel — the in-memory sliding window is
  // timestamp-based and parallel requests could land in the same ms.
  const statuses: number[] = [];
  for (let i = 0; i < BURST; i++) {
    const res = await request.get(path, {
      headers: { 'X-Forwarded-For': ip },
    });
    statuses.push(res.status());
  }
  return statuses;
}

test.describe('E6-08 rate limiting', () => {
  test('/api/* bursts past 60 req/min return 429', async ({ request }) => {
    const statuses = await burst(request, '/api/revalidate', '10.0.0.1');
    const ok = statuses.slice(0, LIMIT);
    const over = statuses.slice(LIMIT);

    // First 60 pass through the middleware (route may then 401 for missing
    // token, but that's downstream — middleware let them through).
    for (const s of ok) {
      expect(s, `expected a non-429 status within the first ${LIMIT}`).not.toBe(429);
    }
    // At least one request in the 61..70 tail must be 429.
    expect(
      over.some((s) => s === 429),
      `expected at least one 429 in the last ${BURST - LIMIT} requests, got ${over.join(',')}`,
    ).toBe(true);
  });

  test('/status bursts past 60 req/min return 429 (separate bucket)', async ({
    request,
  }) => {
    const statuses = await burst(request, '/status', '10.0.0.2');
    const over = statuses.slice(LIMIT);
    expect(over.some((s) => s === 429)).toBe(true);
  });

  test('429 response carries Retry-After + X-RateLimit headers', async ({
    request,
  }) => {
    const ip = '10.0.0.3';
    let limitedRes: APIResponse | null = null;
    for (let i = 0; i < BURST; i++) {
      const res = await request.get('/api/revalidate', {
        headers: { 'X-Forwarded-For': ip },
      });
      if (res.status() === 429) {
        limitedRes = res;
        break;
      }
    }
    expect(limitedRes, 'did not observe a 429 within the burst').not.toBeNull();
    const headers = limitedRes!.headers();
    expect(Number(headers['retry-after'])).toBeGreaterThan(0);
    expect(headers['x-ratelimit-limit']).toBe('60');
    expect(headers['x-ratelimit-remaining']).toBe('0');
  });

  test('independent IPs do not share a bucket', async ({ request }) => {
    const ipA = '10.0.0.4';
    const ipB = '10.0.0.5';
    // Deplete IP A's bucket with a full burst.
    const aStatuses = await burst(request, '/api/revalidate', ipA);
    expect(aStatuses.slice(LIMIT).some((s) => s === 429)).toBe(true);

    // IP B's first request must still pass.
    const b = await request.get('/api/revalidate', {
      headers: { 'X-Forwarded-For': ipB },
    });
    expect(b.status()).not.toBe(429);
  });
});
