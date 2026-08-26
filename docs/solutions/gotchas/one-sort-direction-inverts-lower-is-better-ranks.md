---
title: "One shared ORDER BY inverts every lower-is-better rank"
category: "gotchas"
date: "2026-08-26"
tags: [etl, sql, ranks, data-integrity, defense, epa, testing, golden-values]
files:
  - etl/transform/phases.py
  - etl/tests/golden_values.yml
  - etl/tests/test_phase_aggregation.py
---

# One shared ORDER BY inverts every lower-is-better rank

## Symptom

Nothing looked broken. Pages rendered, numbers were plausible, tests were
green, and the site had shipped six epics on top of it.

The tell was only visible if you knew football: the 2022 phase page ranked
CHI the **best** pass defense in the NFL and PHI **32nd**. CHI allowed
+0.19 EPA/play (worst in the league); PHI allowed −0.10 (near best). The
Patriots' 2021 red-zone defense, genuinely #1 in the NFL, was displayed as
32nd. Tier colours follow rank, so the best defenses rendered cranberry.

Live for four months (2026-04-19 → 2026-08-26). Found only because a user
questioned an unrelated number and the investigation walked the ranking
code.

## Root cause

`etl/transform/phases.py` ranks all twelve phases through one shared
`_insert_tail()` with a single hardcoded ordering:

```sql
ROUND(epa_per_play::numeric, 6) DESC NULLS LAST,
plays DESC,
ROUND(success_rate::numeric, 6) DESC NULLS LAST,
team ASC
```

`DESC` is right for the seven `posteam`-grouped phases: the team scored
that EPA, so more is better.

It is exactly wrong for the five `defteam`-grouped phases. There
`epa_per_play` is EPA **allowed** — the opponent's output — so lower is
better. `DESC` hands rank 1 to whichever defense gave up the most.

The column name carries no polarity. `epa_per_play` means "EPA the offense
gained on these plays" in both cases; only `group_by` tells you whose
column it is. A single sort direction cannot serve both.

## Fix

Make polarity explicit data, not an implicit property of the SQL string.

```python
RankDirection = Literal["asc", "desc"]

@dataclass(frozen=True)
class PhaseFilter:
    predicate: str
    group_by: str          # 'posteam' or 'defteam'
    metric: MetricKind
    rank_direction: RankDirection = "desc"

# then pin the invariant so a new phase cannot get it wrong:
assert all(
    f.rank_direction == "asc"
    for f in PHASE_FILTERS.values()
    if f.group_by == "defteam"
), "every defteam-grouped phase must rank ascending (lower allowed = better)"
```

`_insert_tail()` takes the direction and interpolates it.

**The tiebreak flips too.** SPEC §3.5a phrases tiebreak #2 as "higher
success rate", which is written from an offensive point of view. On a
defensive row `success_rate` is what the opponent achieved, so lower is
better there as well. Flipping only the primary metric leaves tied
defenses ordered backwards — a quieter version of the same bug.

`plays DESC` does **not** flip: "larger sample is more reliable" is
direction-neutral.

Then recompute. The rank lives in the table, so a code fix alone changes
nothing already stored:

```
recompute_weekly + recompute_season for every season, then verify.
```

## Why four months of tests never caught it

Two independent safety nets both had the same blind spot.

**1. Every rank test used `pass_offense`.** `test_phase_aggregation.py`
had solid coverage of tiebreaks, thresholds, percentile K, and
idempotency — all against one offensive phase, where `DESC` happens to be
correct. The tests were not weak; they were *unrepresentative*. Coverage
of a code path is not coverage of its parameter space.

**2. The golden-value anchors confirmed the bug.** All 30 entries in
`golden_values.yml` were `source: self`, captured from the first clean
backfill on 2026-04-19 — i.e. from the buggy output. Contract test c12
then verified, every single run, that the ranks still matched the wrong
values. The file's own header prescribes the cure ("upgrade rows to
source=rbsdm — catches aggregation drift AND source-data drift"); nobody
had ever upgraded a defensive row.

A self-anchored regression fixture does not detect a bug that predates it.
It **pins** it. That is the more general lesson here, and it applies to
snapshot tests, approved-output files, and any "record current behaviour"
baseline.

## Prevention

- **Assert the property, not the value.** For a defensive phase, rank 1
  must hold the *minimum* metric. That assertion is true regardless of
  which teams or seasons are loaded, and it fails loudly on the old code:

  ```python
  best = min(ranked, key=lambda t: ranked[t])
  assert best == "NE", f"{phase}: rank 1 went to {best}"
  ```

  Verified this by reintroducing the bug and watching the new tests fail
  before restoring the fix. A regression test you have not seen fail is a
  test you have not written.

- **Cover the parameter space, not just the function.** Twelve phases, two
  polarities. Test at least one of each.

- **At least one externally-anchored value per metric family.** Self
  anchors catch drift from *today*; they cannot catch a bug that was
  present when they were recorded. 2022 `pass_defense` is now anchored to
  SumerSports (rank 3, agrees with us). Eleven defensive rows still are
  not — `bd patsbythenumbers-0ab`.

- **Sanity-check aggregates against domain reality.** "Is CHI really the
  best pass defense in 2022?" is a five-second question that beats any
  amount of internal consistency checking. Related cheap invariant: the
  league-wide average of the `overall` differential must be ≈0, because
  every play is one team's offense and another's defense. It measured
  −0.001 to +0.002 across all six seasons, which is how the *differential*
  was cleared of suspicion quickly.

## Scope when this happened

Only `team_phase_weekly` and `team_phase_season` carry rank columns —
verified by scanning `db/schema.ts` for every `rank`/`percentile` column.
`unit_rollups` does no ranking, and the "rank" in `qb_rollups.py` is
primary-starter selection within a game, not a league rank. Unaffected
phases: `overall` (a differential, where higher genuinely is better),
`special_teams`, and all offensive phases.

## Related

- `docs/solutions/gotchas/rank-delta-sign-semantics.md` — the *other* half
  of this trap: week-over-week rank deltas needed their sign flipped for
  the UI's arrow convention. Note its "other lower-is-better gotchas"
  list confidently states "Rank 1–32. Handled." That doc fixed the delta
  while the underlying ordering was inverted. Fixing one instance of a
  class is not fixing the class.
- `bd patsbythenumbers-78e` — the bug. `-0ab` — external anchors.
  `-tbc` — a separate contract violation found in the same code
  (rush phases include scrambles, which phase-definitions §2.2 forbids).
