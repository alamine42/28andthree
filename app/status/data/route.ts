import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getPhaseDistribution } from '@/lib/status-data/dal';
import { getRateLimiter, ipFromRequest } from '@/lib/status-data/ratelimit';
import { queryParamSchema } from '@/lib/status-data/schema';
import { getServerEnv } from '@/lib/env';

// Cutoff after which the preview-only gate lifts. 30 days from E2 plan
// commit (2026-04-18). After this date, authorized prod requests succeed
// per plan §3.9 (review finding #3). Edit manually or via env override.
const PREVIEW_ONLY_GATE_END_MS = Date.UTC(2026, 4, 18, 0, 0, 0); // 2026-05-18

export async function GET(req: NextRequest) {
  const env = getServerEnv();
  const logCtx = {
    ua: req.headers.get('user-agent') ?? '-',
    ip: ipFromRequest(req),
  };

  // 1. Preview-only gate for the first 30 days in prod.
  if (env.VERCEL_ENV === 'production' && Date.now() < PREVIEW_ONLY_GATE_END_MS) {
    return json({ error: 'not found' }, 404);
  }

  // 2. Fail closed if the endpoint wasn't provisioned.
  if (!env.STATUS_ADMIN_TOKEN) {
    return json({ error: 'endpoint not configured' }, 503);
  }

  // 3. Rate limit (durable via Upstash when configured).
  const limiter = getRateLimiter();
  const { success, reset } = await limiter.limit(logCtx.ip);
  if (!success) {
    log('status-data ratelimited', { ...logCtx, status: 429 });
    return json({ error: 'rate limited' }, 429, {
      'Retry-After': String(Math.max(1, Math.ceil(reset / 1000))),
    });
  }

  // 4. Auth: constant-time header compare.
  const provided = req.headers.get('x-admin-token') ?? '';
  const tokenHash = shortHash(provided);
  if (!constantTimeStringEqual(provided, env.STATUS_ADMIN_TOKEN)) {
    log('status-data unauthorized', { ...logCtx, token_prefix: tokenHash, status: 401 });
    return json({ error: 'unauthorized' }, 401);
  }

  // 5. Input validation.
  const rawParams = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = queryParamSchema.safeParse(rawParams);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    log('status-data bad_params', { ...logCtx, status: 400, detail: issues });
    return json({ error: 'invalid query', detail: issues }, 400);
  }

  // 6. Fetch + return.
  try {
    const rows = await getPhaseDistribution(parsed.data);
    log('status-data ok', { ...logCtx, status: 200, rows: rows.length });
    return json(rows, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    log('status-data db_error', { ...logCtx, status: 500, detail: message });
    return json({ error: 'database error' }, 500);
  }
}

function json(body: unknown, status: number, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

function constantTimeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function shortHash(s: string): string {
  if (!s) return '-';
  return createHash('sha256').update(s).digest('hex').slice(0, 8);
}

function log(msg: string, fields: Record<string, unknown>): void {
  // Structured JSON log; Vercel captures stdout as logs.
  console.log(JSON.stringify({ msg, ...fields }));
}
