import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getServerEnv } from './env';
import * as schema from '@/db/schema';

// Singleton pool: Next.js server components can be invoked across many requests
// per cold start. We want one Pool per runtime, not one per render.
let pool: Pool | undefined;
let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (db) return db;
  const env = getServerEnv();
  if (!env.DATABASE_URL) {
    // Intentional: /status gracefully degrades to "never run" when DB is not
    // wired yet (E1 scaffolding ships before Neon is connected).
    return undefined;
  }
  pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 });
  db = drizzle(pool, { schema });
  return db;
}

// Test hook only. Production does not call this.
export function resetDbForTests() {
  pool?.end().catch(() => undefined);
  pool = undefined;
  db = undefined;
}
