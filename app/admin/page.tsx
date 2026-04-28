import { desc, sql } from 'drizzle-orm';
import { authoringDrafts, authoringRuns, authoringSchedules } from '@/db/schema';
import { getDb } from '@/lib/db';
import { PageHeader } from '@/components/admin/Eyebrow';
import { DraftStatusBadge } from '@/components/admin/StatusBadge';
import { EmptyState } from '@/components/admin/EmptyState';

// L0-12: dashboard. Four panels — upcoming, drafts in review, recent failures,
// 7-day cost. All Server Components, no client JS.

export default async function AdminDashboard() {
  const db = getDb();
  if (!db) {
    return (
      <p className="font-mono text-sm text-negative">
        DB not configured — set DATABASE_URL.
      </p>
    );
  }

  const [drafts, upcoming, recentFailures, costAgg] = await Promise.all([
    db
      .select()
      .from(authoringDrafts)
      .where(sql`${authoringDrafts.status} IN ('draft','approved','exported')`)
      .orderBy(desc(authoringDrafts.generatedAt))
      .limit(8),
    db
      .select()
      .from(authoringSchedules)
      .where(sql`${authoringSchedules.status} = 'queued' AND ${authoringSchedules.scheduledAt} > now()`)
      .orderBy(authoringSchedules.scheduledAt)
      .limit(5),
    db
      .select()
      .from(authoringRuns)
      .where(sql`${authoringRuns.errorText} IS NOT NULL AND ${authoringRuns.createdAt} > now() - interval '7 days'`)
      .orderBy(desc(authoringRuns.createdAt))
      .limit(5),
    db
      .select({
        total: sql<number>`COALESCE(SUM(${authoringRuns.costUsd}), 0)::float`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(authoringRuns)
      .where(sql`${authoringRuns.createdAt} > now() - interval '7 days' AND ${authoringRuns.errorText} IS NULL`),
  ]);

  const cost = costAgg[0];
  const avg = cost && cost.count > 0 ? cost.total / cost.count : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Studio" title="Dashboard" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="Upcoming">
          {upcoming.length === 0 ? (
            <EmptyState
              title="No scheduled runs."
              hint="Auto-population from the season schedule (E9 ScheduleSnapshot) lands in a follow-up."
            />
          ) : (
            <ul>
              {upcoming.map((s) => (
                <li
                  key={s.id}
                  className="flex justify-between gap-4 border-b border-border py-2 font-mono text-xs last:border-b-0"
                >
                  <span className="text-text-muted tabular-nums">
                    {new Date(s.scheduledAt).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                    })}
                  </span>
                  <span className="text-right text-text">
                    {s.contentType}
                    {s.contextKey ? <span className="text-text-muted"> · {s.contextKey}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Drafts in review">
          {drafts.length === 0 ? (
            <EmptyState
              title="Inbox is empty."
              hint="Generate a draft via the CLI (pnpm authoring:generate) or Schedule view."
            />
          ) : (
            <ul>
              {drafts.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-4 border-b border-border py-2 font-mono text-xs last:border-b-0"
                >
                  <a
                    href={`/admin/drafts/${d.id}`}
                    className="truncate text-text underline-offset-2 transition-colors hover:underline"
                  >
                    {d.slug}
                  </a>
                  <DraftStatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent failures (7d)">
          {recentFailures.length === 0 ? (
            <EmptyState title="No failures." hint="Healthy generation pipeline." />
          ) : (
            <ul>
              {recentFailures.map((r) => (
                <li
                  key={r.id}
                  className="border-b border-border py-2 font-mono text-xs last:border-b-0"
                >
                  <span className="text-negative">{r.contentType}</span>
                  <span className="ml-2 text-text-muted">{r.errorText?.slice(0, 80)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Cost (7d)">
          <div className="flex items-baseline gap-3 font-mono">
            <span className="font-display text-3xl font-bold tabular-nums text-text">
              ${(cost?.total ?? 0).toFixed(2)}
            </span>
            <span className="text-2xs uppercase tracking-widest text-text-muted">
              {cost?.count ?? 0} pieces · avg ${avg.toFixed(3)}
            </span>
          </div>
          <p className="mt-2 font-mono text-2xs text-text-muted">
            Target: under $0.50/piece avg.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-border bg-surface p-4">
      <h2 className="mb-3 font-mono text-2xs uppercase tracking-widest text-text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}
