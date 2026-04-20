# E5 Pats Differentiators — adversarial review (codex)

**Reviewer:** codex-cli 0.121.0 / gpt-5-codex
**Date:** 2026-04-20
**Target:** `docs/plans/e5-pats-differentiators-plan.md`

## Findings (9)

### 1. HIGH — `draft_expected_value` primary key doesn't fit the bucketed curve
PK is `pick_overall` alone, but the fit emits one row per (slot, position_bucket) — second bucket overwrites first. **Adjudication:** valid. Change PK to `(pick_overall, position_bucket)`.

### 2. HIGH — `skill_weekly` has no EPA column; grading math can't compute
Plan says "sum of player-level EPA from `skill_weekly`" but `skillWeekly` only stores targets/yards/yac/routes/etc., no EPA. **Adjudication:** valid. Two options — add per-player EPA columns to `skill_weekly` (`epa_receiving`, `epa_rushing`) during E5-04a scope, or change the metric. Going with: add EPA columns (one-row schema change, clean fix).

### 3. HIGH — `team_ol_weekly` / `team_defense_weekly` lack the `epa_per_play × plays` formula inputs
OL has `epaOnDropbacks` (total) but no `plays` column; defense has `epaPerPlayAllowed` in aggregate but mixing it with a per-game "player was present" gate requires participation data. **Adjudication:** valid. Combined with finding #4 — the whole defender/OL grading pathway is over-engineered relative to available data.

### 4. HIGH — Per-player unit attribution needs participation data, not just roster_snapshots
`roster_snapshots` is season-level roster membership. It doesn't say player X was on the field for plays in game Y. Without participation intersects, every OL/DL/LB/DB pick on the season would get the same unit total. **Adjudication:** valid. **Scope cut** instead of adding complexity: for E5, OL/DL/LB/DB picks get a **unit-proxy grade** based on the team unit's tier during the player's active seasons, not a per-play attribution. QB/RB/WR/TE/FB keep the player-EPA-based grade (once finding #2's EPA columns are added).

### 5. MEDIUM — `draft_picks.gsis_id NOT NULL` blocks trade-out rows
Plan wants to store picks the Pats traded (no resulting player), but the NOT NULL + FK constraint prevents that. **Adjudication:** valid. `gsis_id` is nullable; FK still enforced when present.

### 6. MEDIUM — Slot-EV fit on 2010–2024 with PBP 2020–2025 biases toward survivors
A 2010 pick who played 2011–2016 (and vanished) shows zero EPA in our warehouse; the fit treats him as a bust. Over-weights long-tenured "hits." **Adjudication:** valid. Tighten fit scope to **2015–2024** (10 classes), where most picks have non-trivial 2020+ career overlap, and blend in `career_seasons` as a longevity proxy for pre-2020 careers where PBP is absent. Contract test on fit output.

### 7. MEDIUM — ST position bucket has no defined value metric
Kickers and punters drafted would fall into the `ST` bucket with no grade formula. **Adjudication:** valid. **Drop ST from E5 grading scope.** ST picks render `PENDING` badge with tooltip "ST grades coming in v2."

### 8. MEDIUM — 4th-down scatter promises league dots, but we only store Pats decisions
`coaching_tendencies_weekly.fourth_down_decisions` stores Pats attempts only. Muted-grey league dots would need a separate store. **Adjudication:** valid. Drop the league dots. Add a league-average **reference line** (go-rate by WP-boost bucket, pre-computed) instead — same context signal, far less data.

### 9. MEDIUM — Coach segmentation on raw `coach_name` strings creates phantom segments on spelling drift
"Alex Van Pelt" in one feed vs "Alex VanPelt" in another would split a stable coordinator into two segments. **Adjudication:** valid. Add `coach_id` column sourced from nflreadpy where available; fall back to normalized-name + soundex if the feed doesn't expose IDs. Segmentation keys on `coach_id` primarily.

## Summary
The coaching side of the plan is mostly sound — it needed tighter coach identity handling and a league-context rework. The draft side needed a real scope cut: the warehouse doesn't have the per-player defensive/OL data the plan assumed, and pretending otherwise would ship misleading grades. The adjudication keeps player-EPA grades for skill positions (adds small schema bump), demotes trench/secondary picks to a unit-proxy grade, and drops ST from scope. Plus the keyed-fit schema fix. Nine findings, all addressable without derailing the 22h estimate meaningfully.
