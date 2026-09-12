---
title: "A contract doc carrying both prose and SQL can disagree with itself"
category: "gotchas"
date: "2026-09-12"
tags: [etl, sql, docs, contracts, data-integrity, epa, rush, scrambles, nflverse]
files:
  - docs/phase-definitions.md
  - etl/transform/phases.py
  - etl/tests/golden_values.yml
---

# A contract doc carrying both prose and SQL can disagree with itself

## Symptom

None. No error, no failing test, no implausible number. `rush_offense` and
`run_defense` had shipped for months with ranks that looked entirely
reasonable.

The tell was a sentence in the spec that the code did not obey.

## What happened

`docs/phase-definitions.md` §2.2 defines the rush phase. It contains, four
lines apart:

```sql
rush_attempt = true
```

> Includes QB-designed runs. Excludes scrambles (they're dropbacks, not rushes).

Those say different things. In nflverse a QB scramble carries
`rush_attempt = true` **and** `qb_dropback = true`, so the SQL block includes
exactly the plays the prose excludes.

`etl/transform/phases.py` implemented the SQL block. The prose was never
enforced by anything.

## Why it mattered

The two populations are not close. Measured on prod across 2020–2025:

| | scrambles | designed runs |
|---|---|---|
| mean EPA | +0.47 to +0.54 | −0.06 to −0.10 |
| share of "rushes" | 6.2% (2020) → 7.5% (2025) | — |

Three consequences:

1. A team could rank well at *rushing* because its quarterback escaped
   pressure well. The metric stopped measuring the run game.
2. The scramble share **grew every season**, so the distortion drifted over
   time — straight through `/trends`, the page built to compare seasons.
3. Scrambles landed in both the pass bucket (via `qb_dropback`, deliberate per
   §2.1) and the rush bucket. Not double-counted inside any single number, but
   present in two separate phase rows.

324 of 384 team-seasons changed rank once fixed. Largest single move: 18
places.

## The fix

```python
RUSH = "rush_attempt = true AND qb_dropback = false"
```

Shared by `rush_offense` and `run_defense`, then prod recomputed for
2020–2025 via `etl/scripts/recompute_phase_ranks.py`.

Both halves of §2.2 and §2.5 now say the same thing.

## Lessons

**When a contract doc carries prose *and* a code block, the code block is the
half that ships.** The prose is decoration unless something executes it. Any
drift between them resolves silently in favour of the code, and the prose
becomes a false record of intent that reads authoritative.

Three ways to catch this class:

- Grep the doc's code blocks against the implementation as a test. Here, the
  predicate strings in `PHASE_FILTERS` could be asserted against the SQL
  fenced in `phase-definitions.md`.
- Treat a self-inconsistent section as a bug the moment it is noticed, even
  when the numbers look fine. This one was *visible in the file* the whole
  time.
- When two flags can both be true on one row (`rush_attempt`, `qb_dropback`),
  write the predicate to say which bucket wins. A bare single-flag filter is a
  silent claim that the flags are mutually exclusive.

**Deciding "which half is right" is a product call, not a cleanup.** Both
readings were defensible and the choice moved every rush rank on a live site.
It went to the owner before implementation.

## Traps hit while fixing it

- **Verification queries must carry the global exclusions too.** A check that
  compared stored `plays` against `COUNT(*)` over the phase predicate reported
  192/192 rows mismatched. The query was wrong — it omitted
  `GARBAGE_PLAY_PREDICATE` (REG only, no kneels/spikes/two-point/no-play). With
  those applied: 0 mismatches. A failing invariant is not automatically a
  finding about the data.
- **Recomputing invalidates the golden anchors, and contract test #12 runs
  against prod after every ETL.** Stale values would have turned the next
  weekly run red. Re-record in the same change.
- **Re-recording anchors from freshly recomputed output restores
  `source: self`** — the same self-anchoring that hid an inverted-rank bug for
  four months (see
  [one-sort-direction-inverts-lower-is-better-ranks](./one-sort-direction-inverts-lower-is-better-ranks.md)).
  Unavoidable under a deadline here, but it must be stated in the file rather
  than left to look verified.

## Related

- `bd patsbythenumbers-tbc` — this fix.
- `bd patsbythenumbers-4zm` — `run_stop_rate` in `etl/transform/unit_rollups.py`
  still counts scrambles as runs. Same contaminant, different metric, no
  written contract yet.
- `bd patsbythenumbers-0ab` — the anchor debt this change enlarged.
- A hypothesis this **disproved**: the SumerSports gap on NE's 2022 rush
  defense is not a scramble artifact. We ranked 7th before and 9th after;
  Sumer says ~24th. The fix moved us further away. Still unexplained.
