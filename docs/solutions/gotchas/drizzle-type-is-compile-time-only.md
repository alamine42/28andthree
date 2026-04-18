---
title: "Drizzle's .$type<Union>() narrows the TS type but does NOT constrain the database"
category: "gotchas"
date: "2026-04-18"
tags: [drizzle, typescript, postgres, schema, defensive-programming]
files: [db/schema.ts]
---

# Drizzle's `.$type<Union>()` is compile-time only

## Problem

`db/schema.ts` had:

```typescript
export type EtlStatus = 'running' | 'ok' | 'failed' | 'heartbeat';
status: varchar('status', { length: 20 }).$type<EtlStatus>().notNull(),
```

Looks like the column is constrained to the 4 allowed values. It isn't. A codex review caught that `$type<EtlStatus>()` only changes the inferred TS type for reads/writes from the Drizzle client in this codebase. The actual Postgres column is still `varchar(20)` with no `CHECK` constraint. Anything can go in:

- A Python ETL write using `psycopg` bypasses Drizzle entirely
- A raw `UPDATE` via psql
- A drifted value after a schema change (e.g. rename `heartbeat` → `alive` in TS but not in the DB)

Downstream, `HEALTH_TONE[status ?? 'none'].classes` would blow up with `Cannot read properties of undefined (reading 'classes')` the moment any unknown value lands. The `/status` page — the one page users visit when they suspect something's wrong — would crash.

## Root Cause

Drizzle's `$type<T>()` is a TypeScript-only assertion. It's part of the type-generation pipeline, not a runtime or DB-level enforcement mechanism. The docs don't lie about this, but the method name suggests more than it delivers.

## Solution

Belt-and-suspenders:

1. **DB-level CHECK constraint** — the real enforcement. Drizzle's `check()` helper generates it:

   ```typescript
   import { check } from 'drizzle-orm/pg-core';
   import { sql } from 'drizzle-orm';

   export const metaRefresh = pgTable(
     'meta_refresh',
     { /* columns */ },
     (table) => [
       check(
         'meta_refresh_status_chk',
         sql`${table.status} IN ('running', 'ok', 'failed', 'heartbeat')`,
       ),
     ],
   );
   ```

2. **Runtime-safe TS lookup** — even with the constraint, assume drift during transitions:

   ```typescript
   const tone = HEALTH_TONE[status as EtlStatus] ?? HEALTH_TONE.none;
   ```

3. **Normalize at display** — pin the rendered label/value to known values:

   ```typescript
   const normalizedStatus = ETL_STATUSES.includes(raw) ? raw : null;
   ```

## Prevention

- **Any string column with a known finite set of values** should have a CHECK constraint (or a `pgEnum`). Treat `.$type<Union>()` as documentation, not enforcement.
- When adding a CHECK constraint to an existing table: drizzle-kit emits an immediate `ADD CONSTRAINT` which aborts if existing rows violate. Use the `NOT VALID` + `VALIDATE CONSTRAINT` pattern instead — see `docs/runbook.md#adding-a-migration`.
- For schemas shared with non-TS writers (Python ETL via psycopg), TS-only type hygiene is inherently leaky. DB constraints are the only honest source of truth.

## Related

- `db/schema.ts` — current CHECK setup
- `drizzle/0001_0002_status_check.sql` — the migration that added it
- `docs/runbook.md#adding-a-migration` — NOT VALID / VALIDATE pattern for future constraint migrations
- commit `fa6f82d` — first fix (CHECK + defensive TS fallback)
- commit `9209d86` — second pass (normalize at display)
