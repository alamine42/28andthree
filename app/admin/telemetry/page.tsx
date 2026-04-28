import { desc, sql } from 'drizzle-orm';
import { authoringRuns } from '@/db/schema';
import { getDb } from '@/lib/db';
import { PageHeader } from '@/components/admin/Eyebrow';
import { FactcheckBadge } from '@/components/admin/StatusBadge';
import { EmptyState } from '@/components/admin/EmptyState';

// L0-18: telemetry (stub). Aggregates from authoring_runs. Charts deferred —
// rendered as numeric summaries.

export default async function TelemetryPage() {
  const db = getDb();
  if (!db) return <p className="font-mono text-sm text-negative">DB not configured.</p>;

  const [agg, runs] = await Promise.all([
    db
      .select({
        total: sql<number>`COALESCE(SUM(${authoringRuns.costUsd}), 0)::float`,
        count: sql<number>`COUNT(*)::int`,
        cacheRead: sql<number>`COALESCE(SUM(${authoringRuns.cacheReadTokens}), 0)::int`,
        cacheWrite: sql<number>`COALESCE(SUM(${authoringRuns.cacheWriteTokens}), 0)::int`,
        inputs: sql<number>`COALESCE(SUM(${authoringRuns.inputTokens}), 0)::int`,
        failures: sql<number>`SUM(CASE WHEN ${authoringRuns.errorText} IS NOT NULL THEN 1 ELSE 0 END)::int`,
        factcheckFails: sql<number>`SUM(CASE WHEN ${authoringRuns.factcheckStatus} = 'fail' THEN 1 ELSE 0 END)::int`,
      })
      .from(authoringRuns)
      .where(sql`${authoringRuns.createdAt} > now() - interval '30 days'`),
    db
      .select()
      .from(authoringRuns)
      .orderBy(desc(authoringRuns.createdAt))
      .limit(20),
  ]);

  const a = agg[0];
  const totalCacheable = (a?.cacheRead ?? 0) + (a?.cacheWrite ?? 0) + (a?.inputs ?? 0);
  const cacheHitRate = totalCacheable > 0 ? (a?.cacheRead ?? 0) / totalCacheable : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Studio" title="Telemetry" meta="last 30 days" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat label="Cost (30d)" value={`$${(a?.total ?? 0).toFixed(2)}`} sub={`${a?.count ?? 0} runs`} />
        <Stat
          label="Cache hit rate (30d)"
          value={`${(cacheHitRate * 100).toFixed(1)}%`}
          sub="target >80%"
        />
        <Stat
          label="Failures + factcheck (30d)"
          value={`${(a?.failures ?? 0) + (a?.factcheckFails ?? 0)}`}
          sub={`${a?.failures ?? 0} errors / ${a?.factcheckFails ?? 0} factcheck fails`}
        />
      </div>

      <h2 className="mt-4 font-mono text-2xs uppercase tracking-widest text-text-muted">
        Recent runs
      </h2>
      {runs.length === 0 ? (
        <EmptyState title="No runs yet." hint="Telemetry populates as the pipeline runs." />
      ) : (
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="border-b border-border-strong">
              <th className="px-2 py-2 text-left text-2xs uppercase tracking-widest text-text-muted">When</th>
              <th className="px-2 py-2 text-left text-2xs uppercase tracking-widest text-text-muted">Type</th>
              <th className="px-2 py-2 text-left text-2xs uppercase tracking-widest text-text-muted">Trigger</th>
              <th className="px-2 py-2 text-left text-2xs uppercase tracking-widest text-text-muted">Cost</th>
              <th className="px-2 py-2 text-left text-2xs uppercase tracking-widest text-text-muted">Cache</th>
              <th className="px-2 py-2 text-left text-2xs uppercase tracking-widest text-text-muted">Factcheck</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-border">
                <td className="px-2 py-1.5">
                  {new Date(r.createdAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-2 py-1.5">{r.contentType}</td>
                <td className="px-2 py-1.5">{r.trigger}</td>
                <td className="px-2 py-1.5">${(r.costUsd ?? 0).toFixed(4)}</td>
                <td className="px-2 py-1.5">{r.promptCacheHit ? 'hit' : 'miss'}</td>
                <td className="px-2 py-1.5">
                  {r.factcheckStatus ? <FactcheckBadge status={r.factcheckStatus} /> : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <section className="rounded-sm border border-border bg-surface p-4">
      <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums text-text">{value}</p>
      {sub ? <p className="mt-1 font-mono text-2xs text-text-muted">{sub}</p> : null}
    </section>
  );
}
