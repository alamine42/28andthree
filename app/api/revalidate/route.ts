import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { isRevalidatablePath, REVALIDATE_LAYOUT_PATHS, REVALIDATE_PATHS } from '@/lib/revalidation/tags';
import { getServerEnv } from '@/lib/env';

// On-demand revalidation webhook. Called by the ETL workflow after a
// successful run with a JSON body of {paths: string[]}. Only paths in the
// allowlist (REVALIDATE_PATHS) are honored — prevents a leaked token from
// cache-busting arbitrary routes.

export async function POST(req: Request): Promise<Response> {
  const env = getServerEnv();
  const expected = env.REVALIDATE_TOKEN;
  if (!expected) {
    return json({ error: 'revalidation not configured' }, 503);
  }

  const provided = req.headers.get('x-revalidate-token') ?? '';
  if (!constantTimeEqual(provided, expected)) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  const paths = extractPaths(body);
  if (paths === null) {
    return json({ error: 'invalid request — expected { paths: string[] }' }, 400);
  }

  // Default: revalidate everything if no specific paths supplied. Caller can
  // pass an empty array to trigger a full flush without listing each path.
  const target = paths.length > 0 ? paths : REVALIDATE_PATHS;
  const accepted = target.filter(isRevalidatablePath);
  for (const p of accepted) revalidatePath(p);
  // Full flush also clears the historical /s subtree (layout-scoped —
  // covers per-player pages that cannot be enumerated). E11 plan §3.3.
  const layouts: string[] = [];
  if (paths.length === 0) {
    for (const l of REVALIDATE_LAYOUT_PATHS) {
      revalidatePath(l.path, l.type);
      layouts.push(l.path);
    }
  }
  return json({ revalidated: accepted, revalidatedLayouts: layouts }, 200);
}

function extractPaths(body: unknown): string[] | null {
  if (body == null || typeof body !== 'object') return null;
  const raw = (body as { paths?: unknown }).paths;
  if (!Array.isArray(raw)) return null;
  if (raw.some((p) => typeof p !== 'string')) return null;
  return raw as string[];
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
