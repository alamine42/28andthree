---
title: "Rank delta sign: lower-is-better vs upward-arrow-is-better"
category: "gotchas"
date: "2026-04-19"
tags: [ui, data, semantics, ranks, sql]
files: [lib/data/phases.ts, components/numeric.tsx]
---

# Rank delta: SQL math reverses the UI's direction convention

## Problem

In E3's phase-rank grid, every phase card showed a week-over-week rank
change. When the Pats' pass-offense rank moved from 10 → 5 (improvement),
the card rendered `▼ 5` in cranberry (decline signal). The data was right;
the arrow lied.

## Root Cause

Two independent sign conventions fought each other.

**SQL-side (ranks):** ranks are nominal — lower is better. So to get the
"change in rank" as an integer, the obvious subtraction is
`current_rank - prev_rank`. A team improving from 10 → 5 yields
`5 - 10 = -5`. Negative means improvement.

**UI-side (deltas):** the `<Delta>` component follows user intuition:
- ▲ amber = up = good = positive value
- ▼ cranberry = down = bad = negative value

When you hand `<Delta value={-5} />` from a "lower-is-better" metric, you
get `▼ 5` in cranberry — the component can't know the input came from a
domain where negatives are good.

## Solution

**Convert at the DAL boundary.** Compute `prev_rank - last_rank` in SQL so
the wire-format delta already agrees with the UI's "positive = improvement"
convention:

```sql
SELECT phase,
       (prev_rank - last_rank)::int AS delta  -- positive = improved
FROM (
  SELECT phase,
         rank AS last_rank,
         LAG(rank) OVER (PARTITION BY phase ORDER BY week) AS prev_rank
  …
) x
```

Now rank 10 → 5 is `10 - 5 = +5`, renders `▲ 5` amber, matches expectation.

Do this once, at the DAL. Don't pass raw direction-ambiguous numbers up
to React components and hope they'll get the sign right — future callers
will reliably forget.

## Prevention

Two cheap safeguards:

1. **Name fields by semantics, not math.** `deltaRank: number` invites
   either interpretation; `rankImprovement: number` (positive = improved)
   tells the caller what sign means what. Same for `positionDelta` vs
   `positionImprovement`.

2. **Sanity-test the visual output.** Unit tests for `<Delta>` only check
   "positive → ▲ amber". An end-to-end "rank went from bad to good and the
   card shows amber" test would've caught this on day one. Added as part
   of the `/fullreview` pass that surfaced the bug.

## Other "lower-is-better" gotchas in this codebase

Anywhere a lower raw value is better, the same sign flip bites:

- **Rank 1–32.** The *delta* is handled (this bug). The *ordering* was
  NOT — defensive phases ranked backwards until 2026-08-26. See
  `one-sort-direction-inverts-lower-is-better-ranks.md`. Fixing one
  instance of a class is not fixing the class.
- **Pressure rate allowed** (E4). Lower = better defense. Delta should
  compute as `prev - current` too.
- **Score differential allowed** (E5 coaching tendencies).
- **4th-down model risk score** (`nfl4th`). Lower = more conservative
  decision-making.

Rule of thumb when adding a new delta field: ask "does positive mean the
team got better?" If the answer requires thinking, rename the field.

## Related

- `lib/data/phases.ts` — `getPhaseRankSnapshot` LAG query
- `components/numeric.tsx` — `<Delta>` component (positive = ▲ amber)
- commit that introduced the fix: [see git log on main after 81346f9]
