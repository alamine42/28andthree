---
title: "A status page that swallows DB errors as 'empty' is worse than one that 500s"
category: "gotchas"
date: "2026-04-18"
tags: [error-handling, status-page, observability, anti-pattern, postgres]
files: [app/status/page.tsx]
---

# Don't swallow all DB errors as "empty state" on a status page

## Problem

Early version of `app/status/page.tsx` had:

```typescript
async function getLastRefresh(): Promise<MetaRefresh | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db.select().from(metaRefresh).orderBy(desc(metaRefresh.startedAt)).limit(1);
    return row ?? null;
  } catch {
    // DB reachable but table missing → "never run".
    return null;
  }
}
```

The `catch {}` was well-intentioned: handle the case where the app deploys before migrations run. But it caught **every** exception — auth failures, connection drops, bad SQL, timeouts — and rendered all of them as "ETL has never run."

That's the opposite of what a status page should do. When the real pipeline is healthy-but-empty and when the DB is unreachable look identical to the user. The page that exists to show "is it working?" actively hides outages.

A codex pass flagged this: "On a status page, that's actively misleading and hides outages."

## Root Cause

Generic `catch` blocks with a single "safe" fallback conflate multiple fault modes. For most pages, "show empty state on error" is a reasonable degradation. For a status/health page, it violates the page's purpose.

## Solution

Distinguish the specific error you want to degrade on (table-doesn't-exist) from everything else. Postgres error codes are the clean way:

```typescript
const PG_UNDEFINED_TABLE = '42P01';

type RefreshResult =
  | { kind: 'row'; row: MetaRefresh }
  | { kind: 'empty' }
  | { kind: 'error'; message: string };

async function getLastRefresh(): Promise<RefreshResult> {
  const db = getDb();
  if (!db) return { kind: 'empty' };
  try {
    const [row] = await db.select().from(metaRefresh).orderBy(desc(metaRefresh.startedAt)).limit(1);
    return row ? { kind: 'row', row } : { kind: 'empty' };
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === PG_UNDEFINED_TABLE) {
      return { kind: 'empty' };
    }
    console.error('getLastRefresh failed', e);
    const message = e instanceof Error ? e.message : 'unknown database error';
    return { kind: 'error', message };
  }
}
```

Then render three states explicitly: `row` → data grid, `empty` → "waiting for first run" card, `error` → a red-bordered `ErrorState` card with the message + a pointer to Sentry.

## Prevention

- **Status/health pages are different from content pages.** Errors should be visible, not hidden.
- When you feel the urge to write `catch {}`, ask which specific error you're swallowing. If the answer is "anything", that's a smell.
- A discriminated union return type (`{kind: 'empty' | 'error' | 'row'}`) forces every caller to handle the error branch explicitly — the compiler catches the "oops I forgot about errors" state.
- Sentry still captures the underlying error via `instrumentation.ts` — don't silence observability when surfacing the UI signal.

## Related

- `app/status/page.tsx` — current implementation with `RefreshResult` union
- commit `9209d86` — the fix
- `sentry.server.config.ts` — where server errors get captured
