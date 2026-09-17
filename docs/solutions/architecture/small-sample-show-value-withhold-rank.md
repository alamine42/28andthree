# Small samples: show the value, withhold the rank

**Date:** 2026-09-17
**Category:** architecture
**Touches:** `etl/transform/phases.py`, `lib/data/phases.ts`, `components/PhaseGrid.tsx`, SPEC §3.5a

## Symptom

Two weeks into a season the home grid showed real numbers for `overall` and
the two explosive phases and an em-dash for everything else. Readers took the
dashes for missing data.

## Cause

The §3.5a season floor is 30 plays in the phase, applied identically to every
phase. `overall` counts offensive plus defensive scrimmage plays and the
explosive phases count all scrimmage plays, so both clear 30 after one game.
Red zone, third down and special teams accumulate 8 to 15 plays a game and sit
under the floor until week 3 or 4. The ETL then nulled `epa_per_play` along
with `rank`, so the card had nothing to show.

## Decision

Keep the floor, keep the badge, keep the rank suppressed, but store and render
the season-to-date value. Rationale:

- Every team-stats site (Sumer Sports, rbsdm, FTN) shows raw EPA from week 1.
  All 32 teams share the same small sample, so the value is honest. What
  misleads is a 1-to-32 rank built on it, and that is the thing we withhold.
- Qualification thresholds are a player-stat convention (ESPN QBR, PFR
  minimums), not a team-stat one.

Weekly rows are unchanged: below 10 plays the metric is still stored NULL and
renders "—". A 4-play red-zone week is not a number anyone should read.

## Storage rule (docs/phase-definitions.md)

`insufficient_sample = true` always means `rank` and `percentile` are NULL.
On `team_phase_weekly` the metric columns are NULL too. On `team_phase_season`
they keep the computed value. Anything that must not surface a thin value
(multi-season trend chart, league distribution) filters on the flag, never on
the column being NULL.

## Gotcha

`PhaseGrid` used to re-derive the badge as `plays < 30` on the client. It now
reads the ETL flag, which also covers the one-sided `overall` differential
(flagged with plays well above 30).
