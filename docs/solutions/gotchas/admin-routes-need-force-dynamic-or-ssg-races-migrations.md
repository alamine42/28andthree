---
title: "Admin / DB-backed routes need force-dynamic or SSG races migrations"
category: "gotchas"
date: "2026-04-28"
tags: [next16, vercel, drizzle, ssg, migrations, deploy]
files:
  - app/admin/layout.tsx
  - drizzle/0012_mighty_nighthawk.sql
---

# Admin / DB-backed routes need force-dynamic or SSG races migrations

## Problem

First Vercel deploy of E10b crashed during build:

```
Generating static pages using 1 worker (0/58) ...
Error occurred prerendering page "/admin/backlog".
error: relation "authoring_backlog" does not exist
  code: '42P01'
```

The admin pages (`/admin/backlog`, `/admin/schedule`, `/admin/telemetry`, etc.)
each query the new `authoring_*` tables in their server component. Vercel
ran SSG against prod's read connection during build — but the migration
that creates those tables hadn't been applied yet.

## Root Cause

Two race conditions stacked:

1. **Schema lifecycle vs. build lifecycle.** The deployment unit ships
   compiled JS that knows about the new tables, but the migration is a
   separate manual step (`MIGRATOR_DATABASE_URL=<prod> pnpm db:migrate`).
   On the first deploy, those happen in any order — typically the deploy
   wins the race because it auto-fires on push, while the migration is
   manual.

2. **Next 16 SSG defaults.** Next prerenders any route segment that
   *looks* statically renderable. A page that `await`s a Drizzle query
   without `cookies()`, `headers()`, or another dynamic-data signal
   gets prerendered — even if the result is fundamentally per-request.
   The build worker shells out to a fresh Node process that opens a
   prod DB connection at import time, runs the query, and crashes when
   the table is missing.

The same shape took down the build in `bd-39d.19` (defensive-phase
contributors): new column referenced from the DAL, deploy ran before
the migration. The mitigation there was per-call: `lib/data/draft.ts`
catches PG `42703` (`undefined_column`) and returns a unit-fallback.

For an entire route family (admin, internal tools, anything where
prerendering is conceptually wrong), per-call fallbacks are the wrong
shape. The route should never have been a candidate for SSG.

## Solution

Add `export const dynamic = 'force-dynamic'` at the **layout** level so
it cascades to every nested route in one place:

```tsx
// app/admin/layout.tsx
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: ReactNode }) {
  // ...
}
```

Per Next.js 16 docs, layout-level segment configs apply to all nested
segments. This covers `/admin`, `/admin/login`, `/admin/drafts`,
`/admin/drafts/[id]`, `/admin/drafts/[id]/export`, `/admin/backlog`,
`/admin/schedule`, `/admin/voice`, `/admin/telemetry` — one line, whole
family.

API routes (`/api/authoring/*`) are route handlers, not pages. They're
inherently dynamic — no change needed.

## Prevention

When adding a new route family that:
- queries the DB
- depends on auth / cookies / headers
- has data that changes per request
- should never be prerendered with anonymous context

…add `export const dynamic = 'force-dynamic'` to the layout immediately.
Don't wait for the deploy to crash.

Quick checklist for any new route under `/app`:

- [ ] Does it query the DB? → likely needs `force-dynamic` (or use the
  per-call 42P01/42703 catch pattern from `lib/data/draft.ts` if SSG is
  still desired with a fallback).
- [ ] Does it read `cookies()` / `headers()` / `searchParams`? → Next
  detects this and dynamic-renders automatically; no annotation needed.
- [ ] Is it auth-gated by middleware? → almost always wants
  `force-dynamic` — anonymous prerender of an auth-gated page makes no
  product sense.

The per-call catch (`lib/data/draft.ts::isMissingColumnError`) is still
the right pattern when **public** pages depend on a new column or
table — they need to keep rendering for users while the migration is in
flight. The layout-level `force-dynamic` is the right pattern when SSG
itself is the wrong choice.

## Related

- `docs/solutions/gotchas/nextjs-16-turbopack-ignores-webpack-alias.md` —
  another Next 16 gotcha specific to this project's sandbox setup.
- `lib/data/draft.ts` (`isMissingColumnError`) — per-call 42703 fallback
  for the public route case.
- `lib/data/contributors.ts` — same pattern for participation-array
  columns.
- Commit `10a9dbe` — the fix for the first E10b deploy crash.
