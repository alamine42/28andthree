---
title: "nflverse PBP + schedule schema quirks (game_type, float64 booleans, bare LA)"
category: "gotchas"
date: "2026-04-19"
tags: [nflverse, nflreadpy, polars, pydantic, ingest, data-quality]
files: [etl/ingest/nflverse.py, etl/constants.py, lib/constants/teams.ts]
---

# nflverse schema quirks that bite on first ingest

## Context

Three distinct schema quirks tripped the first prod backfill despite 60+ unit
tests passing against synthetic fixtures. The fixtures were too clean — they
used the canonical types we expected, not the types nflverse actually emits.

All three surface on any first integration with nflreadpy / nflverse public
parquet. Worth knowing up front.

## Quirks

### 1. Schedules use `game_type`, not `season_type`

`nflreadpy.load_schedules(seasons=[...])` returns a column named `game_type`
with values `{REG, WC, DIV, CON, SB}`. The PBP loader (`load_pbp`) separately
returns a column named `season_type` with values `{REG, POST}`. Two different
names for overlapping concepts.

**Symptom:** Pydantic validation error on the `Game` model:
```
ValidationError: 1 validation error for Game
season_type
  Field required [type=missing, input_value={...}, input_type=dict]
```

**Fix:** In `fetch_schedules`, map the five game_type values down to two
season_type values and project the collapsed column:

```python
if "game_type" in sched.columns:
    sched = sched.with_columns(
        pl.when(pl.col("game_type") == "REG")
        .then(pl.lit("REG"))
        .otherwise(pl.lit("POST"))
        .alias("season_type")
    )
```

### 2. Boolean-semantic PBP columns are stored as `float64`

nflverse PBP has ~30 columns with boolean semantics (`qb_dropback`,
`pass_attempt`, `rush_attempt`, `success`, `qb_kneel`, `qb_spike`, `sack`,
`shotgun`, etc.). They're stored as `f64` with values `0.0 / 1.0 / null`.
Legacy from the pandas era where `bool | null` required float64 columns.

**Symptom:** polars expression errors on bitand against a non-boolean:
```
InvalidOperationError: `bitand` operation not supported for dtype `f64`
```

Downstream, Pydantic validation succeeds (Pydantic 2 coerces 1.0 → True
silently), but any `pl.col("flag") & other_flag` in polars-land blows up.

**Fix:** Cast known boolean-semantic columns to `pl.Boolean` once, at read
time, so downstream code sees the semantic type:

```python
_BOOLEAN_PLAY_COLUMNS = (
    "qb_dropback", "qb_kneel", "qb_spike", "two_point_attempt",
    "pass_attempt", "rush_attempt", "success",
    "qb_hit", "sack", "was_pressure",
    "shotgun", "no_huddle", "pre_snap_motion", "play_action",
    "special_teams_play",
)

def _cast_booleans(df: pl.DataFrame) -> pl.DataFrame:
    casts = []
    for col in _BOOLEAN_PLAY_COLUMNS:
        if col in df.columns and df.schema[col] != pl.Boolean:
            casts.append(
                pl.when(pl.col(col).is_null())
                .then(None)
                .otherwise(pl.col(col) != 0)
                .alias(col)
            )
    return df.with_columns(casts) if casts else df
```

### 3. Los Angeles Rams appear as both `LA` and `LAR`

In every season 2020–2025, some PBP rows use bare `LA` for `posteam`/`defteam`
while the rest use `LAR`. Legacy from the 2016 STL → LA relocation — nflverse
never fully migrated the string. The Chargers are consistently `LAC`, so
`LA` is unambiguously Rams.

**Symptom:** contract test flagged `posteam='LA'` as non-canonical when the
canonical 32-team allowlist only has `LAR`. Without the alias, phase
aggregations silently split the Rams into two teams — ranks get mangled.

**Fix:** Alias `LA → LAR` in `TEAM_ABBREVIATION_ALIAS` (both Python and TS
sides):

```python
TEAM_ABBREVIATION_ALIAS = {
    "WSH": "WAS",
    "LA": "LAR",
}
```

Applied on every `posteam` / `defteam` / `home_team` / `away_team` value
during normalization. Unknown abbreviations pass through unchanged so a
contract test can flag anything new (better to fail loud than silently remap).

## Why unit tests didn't catch these

All three are **fixture-drift** bugs. Our synthetic test frames used `True/
False` (Python bool) and `'REG'/'POST'` (our canonical season_type) because
those are what the Pydantic models declare. But nflverse doesn't emit those
shapes. The tests verified `normalize_plays` produces valid `Play` instances
from Pydantic-friendly input; they couldn't verify the fetcher's input-
shaping layer because there was no unit test against nflverse's actual shape.

**Lesson:** for any third-party data source, write one "mirror the wire
format" fixture test alongside the idealized ones. See the
`test_fetch_schedules_maps_game_type_to_season_type_REG` and
`test_fetch_pbp_casts_float64_boolean_columns_to_bool` tests for the pattern.

## Detection mechanism that worked

Contract tests #13 / #14 (`every plays.posteam in canonical NFL_TEAMS`) caught
the LA issue immediately on the first prod run. The Pydantic validation
errors caught the other two at the very first `.model_validate()` call.

All three were fixed within the same session that uncovered them — the
tight test-fix loop was only possible because the contract suite covered
the "are team names canonical" check. Without contract #13/#14, the LA
split would've quietly shipped and every Rams rank would be wrong.

## References

- `etl/ingest/nflverse.py` — fetch_schedules mapping, _cast_booleans
- `etl/constants.py`, `lib/constants/teams.ts` — TEAM_ABBREVIATION_ALIAS
- `etl/tests/test_contracts.py` — contract tests #13/#14 for team allowlist
- `etl/tests/test_ingest_nflverse.py` — regression tests for each quirk
- commit `ba8e889` — the three fixes committed together
