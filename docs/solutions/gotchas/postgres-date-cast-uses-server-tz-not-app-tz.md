---
title: "Postgres ::date cast uses server timezone, not your app's"
category: "gotchas"
date: "2026-04-25"
tags: [postgres, timezone, drizzle, schedule, e9]
files: [lib/schedule/phase.ts, etl/schedule.py, tests/fixtures/schedule-cases.json]
---

# Postgres `::date` cast uses server timezone, not your app's

## Problem

`lib/schedule/phase.ts` and `etl/schedule.py` are mirror implementations of a "what NFL phase is it?" helper, kept in lock-step by a shared golden-values fixture. Both query the `games` table for `next_game_date` (next upcoming kickoff) and `last_completed_date`. The TS version did this:

```ts
sql`SELECT MIN(game_date)::text FROM games WHERE game_date > ${now}::date`
```

`now` is a JavaScript `Date` (a UTC instant). The Python version did:

```py
today = now.astimezone(ZoneInfo("America/New_York")).date()
cur.execute("... WHERE game_date > %s::date", (today,))
```

Codex flagged this as CRITICAL during /codex-review pass 1: at 9:30pm ET on Sept 3 (= 1:30am UTC Sept 4), the TS query computes `WHERE game_date > 2026-09-04` (UTC date), while Python computes `WHERE game_date > 2026-09-03` (NY date). They return different "next games." Web eyebrow says "NEXT GAME IN 2 DAYS"; ETL freshness gate says "1 day." Inconsistent state across the two implementations.

## Root Cause

`::date` in Postgres converts a `timestamptz` value using the connection's `TimeZone` session setting. That setting is usually UTC unless explicitly set. So the cast resolves to "the calendar day in UTC" — which is *not* the calendar day the user experiences in their local timezone.

For a fan-facing app where "today" means "today in NY" (where the team plays), every layer that derives a calendar day from a UTC instant must do the timezone conversion explicitly. There is no implicit "use the user's timezone" — Postgres has no concept of who's asking.

## Solution

Convert `now` to a NY-anchored `YYYY-MM-DD` string in app code, then bind that string as a query parameter (Postgres parses it as a `date` literal — no further timezone math):

```ts
const today = nyDateString(now); // 'YYYY-MM-DD' in America/New_York
sql`SELECT MIN(game_date)::text FROM games WHERE game_date >= ${today}::date`
```

Where `nyDateString` is:

```ts
const NY_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
});
function nyDateString(d: Date): string {
  return NY_DATE_FORMATTER.format(d); // en-CA renders YYYY-MM-DD natively
}
```

Python mirror uses `now.astimezone(ZoneInfo("America/New_York")).date()` and binds the `date` directly via psycopg.

## Prevention

- [ ] Any helper that derives "today" from `now` should accept a tz-aware `now` and pin to one timezone in app code (we picked `America/New_York`). Never let Postgres do the date conversion.
- [ ] If you have parallel implementations in different languages (TS + Python in our case), document the shared timezone in the contract and verify both implementations agree on the same boundary cases via a shared fixture (we use `tests/fixtures/schedule-cases.json`).
- [ ] When binding a date parameter, prefer a `YYYY-MM-DD` string over a `Date`/`datetime` value — strings have no timezone ambiguity once parsed.

## Related

- Plan: `docs/plans/e9-schedule-aware-plan.md` (v2 §3, day-delta math section)
- Adversarial review: `docs/plans/e9-schedule-aware-plan-adversarial-review.md` (post-implementation, CRITICAL #1)
