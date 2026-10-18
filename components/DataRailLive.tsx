import { DataRail } from '@/components/DataRail';
import { formatRefresh, getLastRefresh } from '@/lib/data/refresh';

// Server-only wrapper around DataRail: reads the freshness value and hands
// it down. This lives in its own module, not beside DataRail, because
// app/error.tsx is a client component that renders DataRail — anything
// importing the DAL from the same module ends up in the client bundle,
// which drags `pg` into the browser and takes every route down with it.
export async function DataRailLive() {
  const refresh = await getLastRefresh();
  return <DataRail lastRefresh={formatRefresh(refresh.completedAt)} />;
}
