import { desc } from 'drizzle-orm';
import { authoringBacklog } from '@/db/schema';
import { getDb } from '@/lib/db';
import { PageHeader } from '@/components/admin/Eyebrow';
import { EmptyState } from '@/components/admin/EmptyState';

// L0-14: backlog manager (stub). Topic queue table view.
// CRUD wiring deferred to follow-up — this stub renders the data model.

export default async function BacklogPage() {
  const db = getDb();
  if (!db) return <p className="font-mono text-sm text-negative">DB not configured.</p>;
  const rows = await db
    .select()
    .from(authoringBacklog)
    .orderBy(authoringBacklog.priority, desc(authoringBacklog.createdAt))
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Studio" title="Backlog" meta={`${rows.length} items`} />
      {rows.length === 0 ? (
        <EmptyState
          title="No backlog items yet."
          hint="CRUD UI is a follow-up. For now, insert via direct SQL or the CLI."
        />
      ) : (
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="border-b border-border-strong">
              <th className="px-2 py-2 text-left text-2xs uppercase tracking-widest text-text-muted">P</th>
              <th className="px-2 py-2 text-left text-2xs uppercase tracking-widest text-text-muted">Title</th>
              <th className="px-2 py-2 text-left text-2xs uppercase tracking-widest text-text-muted">Type</th>
              <th className="px-2 py-2 text-left text-2xs uppercase tracking-widest text-text-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-b border-border">
                <td className="px-2 py-1.5">{b.priority}</td>
                <td className="px-2 py-1.5">{b.title}</td>
                <td className="px-2 py-1.5">{b.contentType ?? '-'}</td>
                <td className="px-2 py-1.5 text-text-muted">{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
