import { desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { type EtlStatus, metaRefresh, type MetaRefresh } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getServerEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type StatusPageProps = {
  searchParams: Promise<{ debug?: string }>;
};

async function getLastRefresh(): Promise<MetaRefresh | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db.select().from(metaRefresh).orderBy(desc(metaRefresh.startedAt)).limit(1);
    return row ?? null;
  } catch {
    // DB reachable but table missing (migrations haven't run yet) → "never run".
    return null;
  }
}

export default async function StatusPage({ searchParams }: StatusPageProps) {
  const params = await searchParams;
  const env = getServerEnv();

  // Synthetic error trigger for Sentry validation. Only active outside prod
  // AND when the env var is explicitly set. Public prod-side 404s, so there's
  // no free amplifier.
  if (params.debug === 'boom') {
    if (env.NODE_ENV !== 'production' && env.ALLOW_DEBUG_TRIGGER) {
      throw new Error('Synthetic error for Sentry validation (ALLOW_DEBUG_TRIGGER=true)');
    }
    notFound();
  }

  const last = await getLastRefresh();
  const startedAbs = last ? formatAbsolute(last.startedAt) : null;
  const completedAbs = last?.completedAt ? formatAbsolute(last.completedAt) : null;

  return (
    <section className="flex flex-col gap-10 py-12 md:py-16">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">Data status</p>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-display text-2xl font-bold tracking-tighter text-text md:text-3xl">
            Pipeline health
          </h1>
          <HealthBadge status={last?.status ?? null} />
        </div>
      </header>

      {last === null ? (
        <EmptyState />
      ) : (
        <dl className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-4">
          <StatField label="Status" value={last.status} mono />
          <StatField
            label="Season / Week"
            value={last.season === null && last.week === null ? '—' : `${last.season ?? '—'} · W${last.week ?? '—'}`}
          />
          <StatField
            label="Started"
            value={formatRelative(last.startedAt)}
            titleAttr={startedAbs ?? undefined}
            mono
          />
          <StatField
            label="Completed"
            value={last.completedAt ? formatRelative(last.completedAt) : 'in progress'}
            titleAttr={completedAbs ?? undefined}
            mono
          />
        </dl>
      )}

      {last?.rowCounts && Object.keys(last.rowCounts).length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
            Row counts
          </h2>
          <dl className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Object.entries(last.rowCounts).map(([k, v]) => (
              <StatField key={k} label={k} value={String(v)} mono />
            ))}
          </dl>
        </section>
      ) : null}
    </section>
  );
}

// DESIGN.md §Motion restricts the pulse animation to the footer's fresh-data dot
// only, so status badges render a static dot regardless of state.
const HEALTH_TONE: Record<EtlStatus | 'none', { classes: string; dot: string }> = {
  ok: { classes: 'border-positive-dim text-positive', dot: 'bg-positive' },
  heartbeat: { classes: 'border-positive-dim text-positive', dot: 'bg-positive' },
  running: { classes: 'border-border-strong text-text-muted', dot: 'bg-chart-neutral' },
  failed: { classes: 'border-negative text-negative', dot: 'bg-negative' },
  none: { classes: 'border-border-strong text-text-dim', dot: 'bg-text-dim' },
};

function HealthBadge({ status }: { status: EtlStatus | null }) {
  const tone = HEALTH_TONE[status ?? 'none'];
  const label = status ?? 'no data';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-pill border px-3 py-1 font-mono text-2xs uppercase tracking-widest ${tone.classes}`}
      role="status"
      aria-label={`Pipeline status: ${label}`}
    >
      <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-pill ${tone.dot}`} />
      {label}
    </span>
  );
}

function StatField({
  label,
  value,
  mono,
  titleAttr,
}: {
  label: string;
  value: string;
  mono?: boolean;
  titleAttr?: string;
}) {
  return (
    <div className="flex flex-col gap-1 bg-bg p-4 md:p-6">
      <span className="text-2xs uppercase tracking-widest text-text-muted">{label}</span>
      <span className={`text-base text-text ${mono ? 'font-mono' : ''}`} title={titleAttr}>
        {value}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border p-6 md:p-8">
      <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        waiting for first run
      </p>
      <p className="max-w-prose text-base text-text">
        Once the weekly ETL writes its first row to <code className="font-mono text-sm text-text-muted">meta_refresh</code>, this page will show run status, timing, and per-table row counts.
      </p>
    </div>
  );
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const absSec = Math.abs(diffMs) / 1000;
  const sign = diffMs >= 0 ? '' : 'in ';
  const suffix = diffMs >= 0 ? ' ago' : '';
  if (absSec < 60) return `${sign}${Math.round(absSec)}s${suffix}`;
  if (absSec < 3600) return `${sign}${Math.round(absSec / 60)}m${suffix}`;
  if (absSec < 86400) return `${sign}${Math.round(absSec / 3600)}h${suffix}`;
  return `${sign}${Math.round(absSec / 86400)}d${suffix}`;
}

function formatAbsolute(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}
