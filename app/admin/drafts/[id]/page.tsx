import { eq } from 'drizzle-orm';
import { redirect, notFound } from 'next/navigation';
import type { Route } from 'next';
import { authoringDrafts, type AuthoringDraftStatus } from '@/db/schema';
import { getDb } from '@/lib/db';
import {
  saveDraftMarkdown,
  transitionDraftStatus,
} from '@/lib/authoring/persistence';
import type { FactcheckFinding } from '@/lib/authoring/factcheck';
import { PageHeader } from '@/components/admin/Eyebrow';
import { DraftStatusBadge, FactcheckBadge } from '@/components/admin/StatusBadge';

// L0-13b: draft editor. Markdown textarea + factcheck status + status
// transitions. Server Actions handle save / approve / reject. Read-only when
// status is exported / published / rejected / archived.

const EDITABLE_STATUSES: ReadonlySet<AuthoringDraftStatus> = new Set(['draft', 'approved']);

async function saveAction(formData: FormData): Promise<void> {
  'use server';
  const draftId = String(formData.get('draftId') ?? '');
  const markdown = String(formData.get('markdown') ?? '');
  const lastKnownHash = String(formData.get('lastKnownHash') ?? '');
  const result = await saveDraftMarkdown({
    draftId,
    markdown,
    lastKnownHash: lastKnownHash || null,
  });
  if (!result.ok) {
    redirect(`/admin/drafts/${draftId}?error=${result.reason}` as Route);
  }
  redirect(`/admin/drafts/${draftId}?saved=1` as Route);
}

async function transitionAction(formData: FormData): Promise<void> {
  'use server';
  const draftId = String(formData.get('draftId') ?? '');
  const to = String(formData.get('to') ?? '') as AuthoringDraftStatus;
  const reason = String(formData.get('reason') ?? '');
  const publishedUrl = String(formData.get('publishedUrl') ?? '');
  try {
    await transitionDraftStatus({ draftId, to, reason, publishedUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'transition failed';
    redirect(
      `/admin/drafts/${draftId}?error=${encodeURIComponent(message)}` as Route,
    );
  }
  redirect(`/admin/drafts/${draftId}` as Route);
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function DraftEditor({ params, searchParams }: Props) {
  const { id } = await params;
  const { saved, error } = await searchParams;
  const db = getDb();
  if (!db) return <p className="font-mono text-sm text-negative">DB not configured.</p>;

  const rows = await db
    .select()
    .from(authoringDrafts)
    .where(eq(authoringDrafts.id, id))
    .limit(1);
  const draft = rows[0];
  if (!draft) notFound();

  const editable = EDITABLE_STATUSES.has(draft.status);
  const findings = (draft.factcheckFindings as FactcheckFinding[] | null) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={draft.contentType.replace(/_/g, ' ')}
        title={draft.slug}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <FactcheckBadge status={draft.factcheckStatus} />
            <DraftStatusBadge status={draft.status} />
          </div>
        }
      />

      {/* Toast: saved / error feedback */}
      {saved ? (
        <p
          role="status"
          className="rounded-sm border-l-2 border-positive bg-surface px-3 py-2 font-mono text-2xs uppercase tracking-widest text-positive"
        >
          Saved.
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-sm border-l-2 border-negative bg-surface px-3 py-2 font-mono text-2xs uppercase tracking-widest text-negative"
        >
          {error === 'conflict'
            ? 'Concurrent edit detected — reload and try again.'
            : `Error: ${error}`}
        </p>
      ) : null}

      {/* Factcheck findings */}
      {findings.length > 0 ? (
        <details
          open={draft.factcheckStatus === 'fail'}
          className="rounded-sm border-l-2 border-negative bg-surface"
        >
          <summary className="cursor-pointer px-3 py-2 font-mono text-2xs uppercase tracking-widest text-negative">
            Factcheck findings ({findings.length})
          </summary>
          <ul className="border-t border-border px-3 py-2 font-mono text-xs">
            {findings.map((f, i) => (
              <li key={i} className="border-b border-border py-1.5 last:border-b-0">
                <span className="text-text-muted">[{f.type}]</span>{' '}
                <span className="text-text">{f.token}</span>
                <span className="ml-2 text-text-muted">— {f.context}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Editor */}
      <form action={saveAction} className="flex flex-col gap-2">
        <input type="hidden" name="draftId" value={draft.id} />
        <input
          type="hidden"
          name="lastKnownHash"
          value={draft.contentSha256 ?? ''}
        />
        <label className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Markdown {editable ? '' : '(read-only)'}
        </label>
        <textarea
          name="markdown"
          defaultValue={draft.markdownContent}
          readOnly={!editable}
          rows={28}
          spellCheck={false}
          className="w-full rounded-sm border border-border bg-bg p-3 font-mono text-xs leading-relaxed text-text outline-none transition-colors focus:border-border-strong"
        />
        {editable ? (
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-sm bg-surface-2 px-4 py-2 font-mono text-2xs uppercase tracking-widest text-text transition-colors hover:bg-border-strong"
            >
              Save
            </button>
          </div>
        ) : null}
      </form>

      {/* Action bar — adapts to current status */}
      <div className="border-t border-border pt-4">
        {(draft.status === 'draft' || draft.status === 'rejected') && (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
            <form action={transitionAction}>
              <input type="hidden" name="draftId" value={draft.id} />
              <input type="hidden" name="to" value="approved" />
              <button
                type="submit"
                disabled={draft.factcheckStatus === 'fail'}
                title={
                  draft.factcheckStatus === 'fail'
                    ? 'Resolve factcheck findings before approving'
                    : 'Approve this draft for export'
                }
                className="w-full rounded-sm bg-accent px-4 py-2 font-mono text-2xs uppercase tracking-widest text-text transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
              >
                Approve
              </button>
            </form>
            <form action={transitionAction} className="flex flex-1 items-center gap-2">
              <input type="hidden" name="draftId" value={draft.id} />
              <input type="hidden" name="to" value="rejected" />
              <input
                type="text"
                name="reason"
                placeholder="reason for rejection"
                required
                className="min-w-0 flex-1 rounded-sm border border-border-strong bg-surface px-3 py-2 font-mono text-2xs text-text outline-none focus:border-text-muted"
              />
              <button
                type="submit"
                className="rounded-sm border border-border-strong px-4 py-2 font-mono text-2xs uppercase tracking-widest text-text-muted transition-colors hover:text-text"
              >
                Reject
              </button>
            </form>
          </div>
        )}

        {draft.status === 'approved' && (
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <a
              href={`/admin/drafts/${draft.id}/export`}
              className="rounded-sm bg-accent px-4 py-2 text-center font-mono text-2xs uppercase tracking-widest text-text transition-colors hover:bg-accent-dim"
            >
              Export to Beehiiv →
            </a>
            <p className="font-mono text-2xs text-text-muted">
              Exporting locks the draft and reveals the &lsquo;Set as published&rsquo; gate.
            </p>
          </div>
        )}

        {draft.status === 'exported' && (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
              Confirm send on Beehiiv, then mark as published below. Or cancel export to edit further.
            </p>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <form action={transitionAction} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="draftId" value={draft.id} />
                <input type="hidden" name="to" value="published" />
                <input
                  type="url"
                  name="publishedUrl"
                  placeholder="published URL (optional)"
                  className="min-w-0 flex-1 rounded-sm border border-border-strong bg-surface px-3 py-2 font-mono text-2xs text-text outline-none focus:border-text-muted"
                />
                <button
                  type="submit"
                  className="rounded-sm bg-positive-dim px-4 py-2 font-mono text-2xs uppercase tracking-widest text-text transition-opacity hover:opacity-80"
                >
                  Set as published
                </button>
              </form>
              <form action={transitionAction}>
                <input type="hidden" name="draftId" value={draft.id} />
                <input type="hidden" name="to" value="approved" />
                <button
                  type="submit"
                  className="w-full rounded-sm border border-border-strong px-4 py-2 font-mono text-2xs uppercase tracking-widest text-text-muted transition-colors hover:text-text md:w-auto"
                >
                  Cancel export
                </button>
              </form>
            </div>
          </div>
        )}

        {draft.status === 'published' && draft.beehiivPostUrl && (
          <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
            Live:{' '}
            <a
              href={draft.beehiivPostUrl}
              target="_blank"
              rel="noreferrer"
              className="text-text-muted underline underline-offset-2 transition-colors hover:text-text"
            >
              {draft.beehiivPostUrl}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
