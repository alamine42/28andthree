import { desc } from 'drizzle-orm';
import { authoringSchedules } from '@/db/schema';
import { getDb } from '@/lib/db';
import { PageHeader } from '@/components/admin/Eyebrow';
import { EmptyState } from '@/components/admin/EmptyState';

// L0-16: schedule view (stub). Lists upcoming + past schedule rows.
// Skip / move / generate-now actions deferred to follow-up.

export default async function SchedulePage() {
  const db = getDb();
  if (!db) return <p className="font-mono text-sm text-negative">DB not configured.</p>;
  const rows = await db
    .select()
    .from(authoringSchedules)
    .orderBy(desc(authoringSchedules.scheduledAt))
    .limit(50);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Studio" title="Schedule" meta={`${rows.length} runs`} />
      {rows.length === 0 ? (
        <EmptyState
          title="No scheduled runs yet."
          hint="Auto-population from the season schedule (E9 ScheduleSnapshot) is a follow-up."
        />
      ) : (
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="border-b border-border-strong">
              <th className="px-2 py-2 text-left text-2xs uppercase tracking-widest text-text-muted">When</th>
              <th className="px-2 py-2 text-left text-2xs uppercase tracking-widest text-text-muted">Type</th>
              <th className="px-2 py-2 text-left text-2xs uppercase tracking-widest text-text-muted">Context</th>
              <th className="px-2 py-2 text-left text-2xs uppercase tracking-widest text-text-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-border">
                <td className="px-2 py-1.5">
                  {new Date(s.scheduledAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                  })}
                </td>
                <td className="px-2 py-1.5">{s.contentType}</td>
                <td className="px-2 py-1.5">{s.contextKey ?? '-'}</td>
                <td className="px-2 py-1.5 text-text-muted">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
