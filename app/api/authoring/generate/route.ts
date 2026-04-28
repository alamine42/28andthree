import { NextResponse } from 'next/server';
import { generateDraft } from '@/lib/authoring/generate';
import { CONTENT_TYPES, type ContentType } from '@/lib/authoring/extractors/types';
import { AUTHORING_TRIGGERS, type AuthoringTrigger } from '@/db/schema';

// POST /api/authoring/generate — per-piece generation entrypoint.
// Auth handled by middleware (cookie OR bearer). Called by cron and studio.

const ALLOWED_TYPES: ReadonlySet<string> = new Set(CONTENT_TYPES);
const ALLOWED_TRIGGERS: ReadonlySet<string> = new Set(AUTHORING_TRIGGERS);

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!isObject(body)) {
    return NextResponse.json({ error: 'body must be an object' }, { status: 400 });
  }

  const { contentType, contextKey, trigger, regenerateSection } = body as Record<
    string,
    unknown
  >;
  if (typeof contentType !== 'string' || !ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'invalid contentType' }, { status: 400 });
  }
  if (typeof contextKey !== 'string' || contextKey.length === 0) {
    return NextResponse.json({ error: 'contextKey required' }, { status: 400 });
  }
  if (typeof trigger !== 'string' || !ALLOWED_TRIGGERS.has(trigger)) {
    return NextResponse.json({ error: 'invalid trigger' }, { status: 400 });
  }

  try {
    const result = await generateDraft({
      contentType: contentType as ContentType,
      contextKey,
      trigger: trigger as AuthoringTrigger,
      regenerateSection: typeof regenerateSection === 'string' ? regenerateSection : undefined,
    });
    return NextResponse.json({
      ok: true,
      draftId: result.draftId,
      factcheckStatus: result.factcheck.status,
      costUsd: result.costUsd,
      cacheHitRate: result.cacheHitRate,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'unknown error',
      },
      { status: 500 },
    );
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
