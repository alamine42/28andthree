import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { authoringRuns, authoringSchedules } from '@/db/schema';
import type { AuthoringTrigger } from '@/db/schema';
import type { ContentType } from '@/lib/authoring/extractors/types';
import { getDb } from '@/lib/db';
import { generateDraft } from '@/lib/authoring/generate';

// POST /api/authoring/cron-tick — fired every 30min by GitHub Actions.
// Authenticated via Bearer AUTHORING_CRON_TOKEN (middleware handles).
//
// Reads queued schedule rows where scheduled_at <= now() and dispatches
// each to generateDraft(). Heartbeat row in authoring_runs every tick so
// missed-tick alerting can detect outages.

const TRIGGER_CRON: AuthoringTrigger = 'cron';

export async function POST(): Promise<NextResponse> {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }

  // Heartbeat row — always written even if no schedules fire. The string
  // 'cron_heartbeat' is a sentinel; authoring_runs.content_type has no CHECK.
  await db.insert(authoringRuns).values({
    contentType: 'cron_heartbeat',
    trigger: TRIGGER_CRON,
    model: 'none',
  }).catch(() => {/* heartbeat best-effort */});

  // Atomic claim: a single UPDATE with status='queued' predicate prevents two
  // overlapping ticks from picking up the same row (codex WARNING #2). Also
  // claims rows that have been 'running' too long (>15min) — these would
  // otherwise stay stuck if a previous tick crashed mid-generation.
  const due = await db
    .update(authoringSchedules)
    .set({ status: 'running', attemptedAt: new Date(), attempts: sql`${authoringSchedules.attempts} + 1` })
    .where(
      and(
        sql`${authoringSchedules.scheduledAt} <= now()`,
        sql`(
          ${authoringSchedules.status} = 'queued'
          OR (${authoringSchedules.status} = 'running' AND ${authoringSchedules.attemptedAt} < now() - interval '15 minutes')
        )`,
        sql`${authoringSchedules.id} IN (
          SELECT id FROM ${authoringSchedules}
          WHERE ${authoringSchedules.scheduledAt} <= now()
            AND (
              ${authoringSchedules.status} = 'queued'
              OR (${authoringSchedules.status} = 'running' AND ${authoringSchedules.attemptedAt} < now() - interval '15 minutes')
            )
          ORDER BY ${authoringSchedules.scheduledAt} ASC
          LIMIT 5
          FOR UPDATE SKIP LOCKED
        )`,
      ),
    )
    .returning();

  const results: Array<{ scheduleId: string; ok: boolean; error?: string; draftId?: string }> = [];
  for (const sched of due) {
    if (!sched.contextKey) {
      await db
        .update(authoringSchedules)
        .set({ status: 'failed', errorText: 'no contextKey' })
        .where(eq(authoringSchedules.id, sched.id));
      results.push({ scheduleId: sched.id, ok: false, error: 'no contextKey' });
      continue;
    }

    try {
      const result = await generateDraft({
        contentType: sched.contentType as ContentType,
        contextKey: sched.contextKey,
        trigger: TRIGGER_CRON,
      });
      await db
        .update(authoringSchedules)
        .set({
          status: 'completed',
          completedAt: new Date(),
          draftId: result.draftId,
        })
        .where(eq(authoringSchedules.id, sched.id));
      results.push({ scheduleId: sched.id, ok: true, draftId: result.draftId });
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      await db
        .update(authoringSchedules)
        .set({ status: 'failed', errorText })
        .where(eq(authoringSchedules.id, sched.id));
      results.push({ scheduleId: sched.id, ok: false, error: errorText });
    }
  }

  return NextResponse.json({ ok: true, ranCount: results.length, results });
}
