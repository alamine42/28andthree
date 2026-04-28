import { desc } from 'drizzle-orm';
import { authoringDrafts } from '@/db/schema';
import { getDb } from '@/lib/db';
import { PageHeader } from '@/components/admin/Eyebrow';
import { DraftStatusBadge, FactcheckBadge } from '@/components/admin/StatusBadge';
import { EmptyState } from '@/components/admin/EmptyState';

// L0-13a: drafts list view.

export default async function DraftsListPage() {
  const db = getDb();
  if (!db) {
    return <p className="font-mono text-sm text-negative">DB not configured.</p>;
  }
  // Avoid pulling markdown_content (multi-KB per row); list view doesn't render it.
  const rows = await db
    .select({
      id: authoringDrafts.id,
      slug: authoringDrafts.slug,
      contentType: authoringDrafts.contentType,
      status: authoringDrafts.status,
      factcheckStatus: authoringDrafts.factcheckStatus,
      generatedAt: authoringDrafts.generatedAt,
      costUsd: authoringDrafts.costUsd,
    })
    .from(authoringDrafts)
    .orderBy(desc(authoringDrafts.generatedAt))
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Studio"
        title="Drafts"
        meta={`${rows.length} ${rows.length === 1 ? 'piece' : 'pieces'}`}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No drafts yet."
          hint="Generate one via CLI: pnpm authoring:generate recap <game_id>"
        />
      ) : (
        <>
          {/* Desktop: table view */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="border-b border-border-strong">
                  <Th>Status</Th>
                  <Th>Type</Th>
                  <Th>Slug</Th>
                  <Th>Generated</Th>
                  <Th align="right">Cost</Th>
                  <Th>Factcheck</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-b border-border transition-colors hover:bg-surface">
                    <Td><DraftStatusBadge status={d.status} /></Td>
                    <Td>{d.contentType}</Td>
                    <Td>
                      <a
                        href={`/admin/drafts/${d.id}`}
                        className="text-text underline-offset-2 transition-colors hover:underline"
                      >
                        {d.slug}
                      </a>
                    </Td>
                    <Td>
                      <span className="tabular-nums text-text-muted">
                        {new Date(d.generatedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="tabular-nums">${(d.costUsd ?? 0).toFixed(3)}</span>
                    </Td>
                    <Td><FactcheckBadge status={d.factcheckStatus} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((d) => (
              <li key={d.id}>
                <a
                  href={`/admin/drafts/${d.id}`}
                  className="block rounded-sm border border-border bg-surface p-3 transition-colors hover:border-border-strong"
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate font-mono text-xs text-text">{d.slug}</span>
                    <DraftStatusBadge status={d.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between font-mono text-2xs text-text-muted">
                    <span className="tabular-nums">
                      {new Date(d.generatedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                      })}
                      <span className="mx-1">·</span>
                      <span className="tabular-nums">${(d.costUsd ?? 0).toFixed(3)}</span>
                    </span>
                    <FactcheckBadge status={d.factcheckStatus} />
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-2 py-2 ${align === 'right' ? 'text-right' : 'text-left'} font-mono text-2xs uppercase tracking-widest text-text-muted`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className={`px-2 py-1.5 ${align === 'right' ? 'text-right' : 'text-left'} align-middle`}>
      {children}
    </td>
  );
}
