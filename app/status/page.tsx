import { desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { metaRefresh } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getServerEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type StatusPageProps = {
  searchParams: Promise<{ debug?: string }>;
};

async function getLastRefresh() {
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

  return (
    <section className="flex flex-col gap-8 py-12">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Data status
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tighter text-text">
          Pipeline health
        </h1>
      </header>

      {last === null ? (
        <p className="text-base text-text-muted">
          ETL has never run. Last refresh: <span className="text-text">never</span>.
        </p>
      ) : (
        <dl className="grid gap-4 font-mono text-sm md:grid-cols-4">
          <StatField label="Status" value={last.status} />
          <StatField label="Season / Week" value={`${last.season ?? '—'} / ${last.week ?? '—'}`} />
          <StatField
            label="Started"
            value={new Date(last.startedAt).toISOString().replace('T', ' ').slice(0, 19) + 'Z'}
          />
          <StatField
            label="Completed"
            value={
              last.completedAt
                ? new Date(last.completedAt).toISOString().replace('T', ' ').slice(0, 19) + 'Z'
                : 'in progress'
            }
          />
        </dl>
      )}
    </section>
  );
}

function StatField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-l border-border pl-4">
      <span className="text-2xs uppercase tracking-widest text-text-muted">{label}</span>
      <span className="text-base text-text">{value}</span>
    </div>
  );
}
