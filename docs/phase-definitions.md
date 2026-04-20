# Phase Definitions — the Versioned Contract

> **Load-bearing.** Every aggregation query in `etl/transform/` filters `plays` according to this document. Changing any filter requires a full backfill re-run. Treat this file like schema SQL: review carefully, log the change in a commit message, and bump the `source_version` tag convention in `meta_refresh` so downstream consumers can see the shift.

**Scope:** 12 phases per SPEC §3.2, regular-season only, 2020–2025.

---

## 1. Global rules (apply to every phase)

### 1.1 Regular season only

```sql
WHERE season_type = 'REG'
```

Playoffs load to `plays` (E4 / E5 may want them for player rollups) but **do not** contribute to `team_phase_*`. Rationale: playoff samples are tiny and opponent-skewed. Aligns with rbsdm, FTN Fantasy, Sumer Sports.

### 1.2 Exclude garbage plays from EPA averages

```sql
AND NOT coalesce(qb_kneel, false)
AND NOT coalesce(qb_spike, false)
AND NOT coalesce(two_point_attempt, false)
AND (play_type IS NULL OR play_type <> 'no_play')
```

- `qb_kneel` / `qb_spike` — deliberate clock-management plays; not football you want to average.
- `two_point_attempt` — different expected-value model; nflfastR computes EPA but it's not comparable.
- `no_play` — penalty-nullified plays; nflfastR emits a row for the penalty itself plus the resulting play. Keeping the nullified row double-counts.

**Not excluded:** penalties that don't nullify the play (declined, offset, etc.) — they have `play_type` matching the actual play, so they belong in the phase.

### 1.3 No garbage-time filter

We deliberately **do not** exclude plays based on score differential or time remaining. Rationale: aligns with rbsdm / FTN / Sumer; a team's 4th-quarter collapse is legitimate signal for a fan site. If a secondary garbage-time view becomes interesting post-launch, add it as a secondary toggle, not a primary filter. (Review finding #6.)

### 1.4 Team-abbreviation normalization

All `posteam` / `defteam` / `home_team` / `away_team` values pass through `etl.constants.normalize_team_abbr` at load time: `WSH → WAS`, everything else unchanged. Unknown abbreviations are preserved and caught by contract test #13/#14 rather than silently remapped.

---

## 2. Phase filters

All filters assume global rules (§1) are applied first. "Group by" tells the aggregation SQL which team column owns the row.

### 2.1 `pass_offense` — metric: EPA/dropback

```sql
qb_dropback = true
GROUP BY posteam
```

Includes sacks and scrambles (nflverse `qb_dropback` is true for all three). This is the nflfastR convention and matches how `rbsdm.com` reports "dropback EPA."

### 2.2 `rush_offense` — metric: EPA/rush

```sql
rush_attempt = true
GROUP BY posteam
```

Includes QB-designed runs. Excludes scrambles (they're dropbacks, not rushes).

### 2.3 `overall` — metric: team EPA differential (SPEC §3.2 #12)

```sql
-- offense side
SELECT posteam AS team, AVG(epa) AS off_epa
FROM plays
WHERE (qb_dropback = true OR rush_attempt = true)
  AND <global rules §1>
  AND posteam IS NOT NULL
GROUP BY posteam;

-- defense side
SELECT defteam AS team, AVG(epa) AS def_epa
FROM plays
WHERE (qb_dropback = true OR rush_attempt = true)
  AND <global rules §1>
  AND defteam IS NOT NULL
GROUP BY defteam;

-- final: off_epa − def_epa per team
```

**Renamed from `overall_offense` in E3-16** to match SPEC §3.2 #12: *"Overall (team EPA differential)"*. Old value semantics (offensive EPA per play, grouped by posteam only) no longer exist in the enum.

- Metric stored in `epa_per_play` slot on `team_phase_*` is the **differential**: `(offensive EPA/play) − (defensive EPA/play allowed)`. A team that plays great offense and average defense scores positive; a team that's bad on both sides scores negative.
- `success_rate` is NULL for `overall` rows — the concept "success rate differential" isn't a standard measure and would mislead.
- Sample-size guards use combined plays (offense plays + defense plays) against the same 10/30 thresholds; teams that play any games at all easily clear.

Implementation: `etl/transform/phases.py` handles this via `metric_kind='differential'` in `PHASE_FILTERS['overall']` and a FULL OUTER JOIN CTE in `_build_differential_sql`.

### 2.4 `pass_defense` — metric: EPA/dropback allowed

```sql
qb_dropback = true
GROUP BY defteam
```

Same filter as 2.1, but grouping the other side of the ball.

### 2.5 `run_defense` — metric: EPA/rush allowed

```sql
rush_attempt = true
GROUP BY defteam
```

### 2.6 `redzone_offense` — metric: EPA/play inside the 20

```sql
(qb_dropback = true OR rush_attempt = true)
AND is_redzone = true
GROUP BY posteam
```

`is_redzone` is a generated column: `yardline_100 <= 20`. Excludes plays with null yardline (kickoffs, pre-snap penalties).

### 2.7 `redzone_defense` — metric: EPA/play allowed inside the 20

```sql
(qb_dropback = true OR rush_attempt = true)
AND is_redzone = true
GROUP BY defteam
```

### 2.8 `third_down_offense` — metric: EPA/play on 3rd down

```sql
(qb_dropback = true OR rush_attempt = true)
AND is_third_down = true
GROUP BY posteam
```

`is_third_down` is a generated column: `down = 3`. Excludes 4th-down "conversion" plays (those are coaching-decision territory, E5 handles).

### 2.9 `third_down_defense` — metric: EPA/play allowed on 3rd down

```sql
(qb_dropback = true OR rush_attempt = true)
AND is_third_down = true
GROUP BY defteam
```

### 2.10 `explosive_offense` — **rate phase**, not an EPA phase

```sql
(qb_dropback = true OR rush_attempt = true)
GROUP BY posteam
-- metric stored in epa_per_play column:
--   AVG(CASE WHEN is_explosive_pass OR is_explosive_run THEN 1.0 ELSE 0.0 END)
```

Thresholds (set on load):
- `is_explosive_pass` = `pass_attempt AND yards_gained >= 20`
- `is_explosive_run` = `rush_attempt AND yards_gained >= 15`

These thresholds match FTN Fantasy and are the de-facto industry standard. The 20-yard pass / 15-yard run split accounts for the different per-play expected gains.

**Storage convention:** for rate phases (2.10, 2.11), the `epa_per_play` column holds the **rate** (0.0–1.0), not EPA. `success_rate` holds the same value for consistency. Schema doesn't need a new column — the phase name tells downstream consumers which interpretation to apply. Documented here because E3 chart code will need to format accordingly.

### 2.11 `explosive_defense` — **rate phase**

```sql
(qb_dropback = true OR rush_attempt = true)
GROUP BY defteam
-- metric = AVG(CASE WHEN is_explosive_pass OR is_explosive_run THEN 1.0 ELSE 0.0 END)
```

### 2.12 `special_teams` — metric: EPA/ST play

```sql
special_teams_play = true
GROUP BY posteam
```

`special_teams_play` is nflverse's raw column. Includes punts, kickoffs, field-goal attempts, extra-point attempts. `posteam` = team with possession going into the play (receiving team on kickoffs, kicking team on punts/FGs, scoring team on PAT).

Sample-size note: ST phase is the one where `insufficient_sample` frequently bites — a team that scores on every drive has few ST plays in a given week. §3.5a enforces n<10 threshold; see contract test #2.

---

## 3. Why these filters and not [...]

**Q: Why not a simpler "play_type IN (pass, run)" filter?**
A: `play_type` in nflverse is set based on what *happened*, not what was *attempted*. A sack is `play_type='pass'` (or sometimes `'sack'` in some nflverse releases); a scramble is `play_type='run'`. Rolling these up by play_type would credit a sack to "pass defense" on one side and "rush offense" on the other, which is wrong. `qb_dropback` / `rush_attempt` reflect the team's *intent*, which is what the phase rankings should reward or penalize.

**Q: Why include scrambles in `pass_offense` and not `rush_offense`?**
A: Same reason — a scramble is a dropback that didn't find a throw. It's a pass-offense outcome, not a called run. This matches nflfastR's own dropback definition.

**Q: Why not filter out the last two minutes of the 4th quarter to avoid end-of-half hail-mary noise?**
A: Hail-mary plays have large negative EPA but are a small fraction of dropbacks; the aggregate effect is bounded. No widely-adopted filter for this exists, and codifying one here would drift our ranks from rbsdm/FTN without clear benefit.

**Q: Before E3-16 there was an `overall_offense` phase — why rename?**
A: The SPEC §3.2 #12 phase is explicitly *team EPA differential* (offense − defense), not offensive-only. The original shipped aggregation matched a different metric than the spec name implied. Renamed + redefined in E3-16 to eliminate the divergence.

**Q: Why is the old `overall_offense` (offensive-only EPA) not a weighted blend of EPA/dropback and EPA/rush?**
A: The raw-average approach already weights by usage — a team with 50 dropbacks and 10 runs contributes 60 plays at their mix. A weighted blend would require picking weights ("league average pass rate") and would mask the effect of a team being run-heavy or pass-heavy, which is itself information.

---

## 4. Versioning

Any change to these filters is a **contract change**. Procedure:

1. Edit this file and the corresponding SQL in `etl/transform/`.
2. Bump `ETL_FILTER_VERSION` in `etl/constants.py` (add this constant when the first filter change lands).
3. Ensure the full backfill (`--full`) re-runs and contract test #12 (golden values) still passes — or explicitly update the golden values with a note.
4. Log the change in the PR description, the commit message, and the `source_version` written to `meta_refresh` by that run.

Downstream consumers (E3 trend charts especially) should never assume that EPA values for a given (team, season, week, phase) are frozen across time — a filter change legitimately moves them.
