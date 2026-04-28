import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import {
  authoringDrafts,
  authoringRuns,
  type AuthoringDraft,
  type AuthoringDraftStatus,
  type NewAuthoringDraft,
  type NewAuthoringRun,
} from '@/db/schema';
import { getDb } from '@/lib/db';
import type { ContentType } from './extractors/types';
import type { FactcheckResult } from './factcheck';

// Persistence helpers for authoring_drafts + authoring_runs. Per plan §3.8
// (post-codex CRITICAL #1): drafts live in DB only, no filesystem mirror.
// Concurrent-edit detection uses content_sha256 — caller passes the
// last-known hash, and saveDraftMarkdown returns 409-shaped error if it
// has changed.

export type SaveResult =
  | { ok: true; draft: AuthoringDraft }
  | { ok: false; reason: 'conflict' | 'not_found' };

export function hashMarkdown(markdown: string): string {
  return createHash('sha256').update(markdown, 'utf8').digest('hex');
}

export function buildSlug(contentType: ContentType, contextKey: string): string {
  return `${contextKey}-${contentType}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

/** Create or upsert a draft. Used by generateDraft() after the LLM returns. */
export async function upsertDraft(input: {
  slug: string;
  contentType: ContentType;
  markdown: string;
  factcheck: FactcheckResult;
  costUsd: number | null;
  metadata?: Record<string, unknown>;
}): Promise<AuthoringDraft> {
  const db = getDb();
  if (!db) throw new Error('upsertDraft: no DB connection');

  const id = input.slug;
  const contentSha256 = hashMarkdown(input.markdown);
  const factcheckStatus = input.factcheck.status;
  const findings = input.factcheck.findings.length === 0 ? null : input.factcheck.findings;

  const insert: NewAuthoringDraft = {
    id,
    slug: input.slug,
    contentType: input.contentType,
    markdownContent: input.markdown,
    contentSha256,
    status: 'draft',
    factcheckStatus,
    factcheckFindings: findings,
    costUsd: input.costUsd,
    metadata: input.metadata ?? null,
  };

  const result = await db
    .insert(authoringDrafts)
    .values(insert)
    .onConflictDoUpdate({
      target: authoringDrafts.id,
      set: {
        markdownContent: input.markdown,
        contentSha256,
        factcheckStatus,
        factcheckFindings: findings,
        costUsd: input.costUsd,
        metadata: input.metadata ?? null,
        // Regeneration replaces content + resets status back to 'draft' so
        // the operator re-enters the review gate. Without this, an already-
        // approved draft would retain its status while its body is silently
        // swapped — codex review caught this.
        status: 'draft',
        approvedAt: null,
        exportedAt: null,
        publishedAt: null,
        rejectedAt: null,
        rejectedReason: null,
        beehiivPostId: null,
        beehiivPostUrl: null,
        generatedAt: sql`now()`,
      },
    })
    .returning();
  const row = result[0];
  if (!row) throw new Error('upsertDraft: insert returned no rows');
  return row;
}

/** Save edited markdown. Conflict if the caller's lastKnownHash differs from
 * the current row's content_sha256 — protects against concurrent edits. */
export async function saveDraftMarkdown(input: {
  draftId: string;
  markdown: string;
  lastKnownHash: string | null;
}): Promise<SaveResult> {
  const db = getDb();
  if (!db) throw new Error('saveDraftMarkdown: no DB connection');

  const current = await db
    .select()
    .from(authoringDrafts)
    .where(eq(authoringDrafts.id, input.draftId))
    .limit(1);
  if (current.length === 0) return { ok: false, reason: 'not_found' };

  const currentRow = current[0];
  if (!currentRow) return { ok: false, reason: 'not_found' };
  if (input.lastKnownHash !== null && currentRow.contentSha256 !== input.lastKnownHash) {
    return { ok: false, reason: 'conflict' };
  }

  const newHash = hashMarkdown(input.markdown);
  const updated = await db
    .update(authoringDrafts)
    .set({ markdownContent: input.markdown, contentSha256: newHash })
    .where(eq(authoringDrafts.id, input.draftId))
    .returning();
  const updatedRow = updated[0];
  if (!updatedRow) return { ok: false, reason: 'not_found' };
  return { ok: true, draft: updatedRow };
}

/** State transition with consistency. Allowed transitions are encoded here;
 * caller passes the desired target, this function rejects illegal moves. */
export async function transitionDraftStatus(input: {
  draftId: string;
  to: AuthoringDraftStatus;
  reason?: string;
  publishedUrl?: string;
}): Promise<SaveResult> {
  const db = getDb();
  if (!db) throw new Error('transitionDraftStatus: no DB connection');

  const current = await db
    .select()
    .from(authoringDrafts)
    .where(eq(authoringDrafts.id, input.draftId))
    .limit(1);
  if (current.length === 0) return { ok: false, reason: 'not_found' };

  const currentRow = current[0];
  if (!currentRow) return { ok: false, reason: 'not_found' };
  const from = currentRow.status;
  if (!isAllowedTransition(from, input.to)) {
    throw new Error(`illegal transition: ${from} → ${input.to}`);
  }

  const set: Partial<typeof authoringDrafts.$inferInsert> = { status: input.to };
  if (input.to === 'approved') set.approvedAt = new Date();
  if (input.to === 'exported') set.exportedAt = new Date();
  if (input.to === 'published') {
    set.publishedAt = new Date();
    if (input.publishedUrl) set.beehiivPostUrl = input.publishedUrl;
  }
  if (input.to === 'rejected') {
    set.rejectedAt = new Date();
    if (input.reason) set.rejectedReason = input.reason;
  }

  const updated = await db
    .update(authoringDrafts)
    .set(set)
    .where(eq(authoringDrafts.id, input.draftId))
    .returning();
  const updatedRow = updated[0];
  if (!updatedRow) return { ok: false, reason: 'not_found' };
  return { ok: true, draft: updatedRow };
}

/** State machine encoded as adjacency. See plan §3.11. */
const ALLOWED_TRANSITIONS: ReadonlyMap<AuthoringDraftStatus, ReadonlySet<AuthoringDraftStatus>> =
  new Map<AuthoringDraftStatus, ReadonlySet<AuthoringDraftStatus>>([
    ['draft', new Set(['approved', 'rejected', 'archived'])],
    ['approved', new Set(['exported', 'rejected', 'archived', 'draft'])],
    ['exported', new Set(['published', 'approved', 'archived'])],
    ['published', new Set(['archived'])],
    ['rejected', new Set(['draft', 'archived'])],
    ['archived', new Set(['draft'])],
  ]);

export function isAllowedTransition(
  from: AuthoringDraftStatus,
  to: AuthoringDraftStatus,
): boolean {
  if (from === to) return true; // idempotent
  return ALLOWED_TRANSITIONS.get(from)?.has(to) ?? false;
}

/** Append a telemetry row. Best-effort — failures here log but don't
 * abort the calling generation. */
export async function logRun(run: NewAuthoringRun): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(authoringRuns).values(run);
  } catch (error) {
    console.error('logRun failed (non-fatal):', error);
  }
}
