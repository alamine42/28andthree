import { eq } from 'drizzle-orm';
import { redirect, notFound } from 'next/navigation';
import type { Route } from 'next';
import { authoringDrafts } from '@/db/schema';
import { getDb } from '@/lib/db';
import { markdownToBeehiivHtml } from '@/lib/authoring/markdown-to-beehiiv';
import { transitionDraftStatus } from '@/lib/authoring/persistence';
import { PageHeader } from '@/components/admin/Eyebrow';

// L0-19: manual Beehiiv export panel. Renders HTML preview + clipboard copy
// + transitions draft to 'exported' on confirmation.

async function markExportedAction(formData: FormData): Promise<void> {
  'use server';
  const draftId = String(formData.get('draftId') ?? '');
  await transitionDraftStatus({ draftId, to: 'exported' });
  redirect(`/admin/drafts/${draftId}` as Route);
}

type Props = { params: Promise<{ id: string }> };

export default async function ExportPage({ params }: Props) {
  const { id } = await params;
  const db = getDb();
  if (!db) return <p className="font-mono text-sm text-negative">DB not configured.</p>;

  const rows = await db
    .select()
    .from(authoringDrafts)
    .where(eq(authoringDrafts.id, id))
    .limit(1);
  const draft = rows[0];
  if (!draft) notFound();
  if (draft.status !== 'approved') {
    return (
      <p className="font-mono text-sm text-negative">
        Cannot export — draft is in status &lsquo;{draft.status}&rsquo;. Only approved drafts may be exported.
      </p>
    );
  }

  const html = markdownToBeehiivHtml(draft.markdownContent);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={draft.slug} title="Export to Beehiiv" />

      <ol className="list-decimal pl-5 font-mono text-xs text-text-muted">
        <li>Copy the HTML below.</li>
        <li>
          Open Beehiiv composer (
          <a
            href="https://app.beehiiv.com/"
            target="_blank"
            rel="noreferrer"
            className="text-text-muted underline underline-offset-2 transition-colors hover:text-text"
          >
            app.beehiiv.com
          </a>
          ).
        </li>
        <li>Paste into the post body. Confirm the rendered preview.</li>
        <li>Schedule or send. Then click &lsquo;Mark as exported&rsquo; below.</li>
      </ol>

      <textarea
        readOnly
        value={html}
        rows={20}
        className="w-full rounded-sm border border-border bg-bg p-3 font-mono text-2xs text-text outline-none"
      />

      <div className="border-t border-border pt-3">
        <form action={markExportedAction}>
          <input type="hidden" name="draftId" value={draft.id} />
          <button
            type="submit"
            className="rounded-sm bg-accent px-4 py-2 font-mono text-2xs uppercase tracking-widest text-text hover:bg-accent-dim"
          >
            Mark as exported
          </button>
        </form>
      </div>
    </div>
  );
}
