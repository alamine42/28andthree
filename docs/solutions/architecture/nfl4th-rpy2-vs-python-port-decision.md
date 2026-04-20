---
title: "nfl4th integration: rpy2 vs. Python port decision"
category: "architecture"
date: "2026-04-20"
tags: [etl, nfl4th, rpy2, python, decision]
---

# Decision: ship the Python port (`py4thdown`) behind a feature toggle; rpy2 is a backup

## Context

E5-08a spike to decide how to integrate Ben Baldwin's `nfl4th` model for the
/coaching 4th-down actual-vs-recommended chart. The model returns a
go-recommendation per 4th-down play. SPEC §3.4 forbids us from rolling our
own model.

Three realistic options evaluated:

1. **rpy2 wrapping `nfl4th` (R)**
   - Pros: canonical upstream. No drift.
   - Cons: adds R + rpy2 to GH Actions image. rpy2 ≥ 3.6 requires R ≥ 4.3,
     which ubuntu-latest has as of 2026-04 but historically was painful
     during Ubuntu LTS transitions. CI cold-start adds ~3 min for R setup.
     Local dev requires `brew install r`. Fragile dependency that fails
     in the "bad way" (CI red → nobody notices → stale data).

2. **Python port `py4thdown`**
   - Pros: single language in ETL. Fast install. Same license (MIT).
     Maintained by the analytics community since 2023. Output parity
     with upstream `nfl4th` within 0.002 on `go_boost` across a sample of
     2023 4th downs (verified by the package's test suite).
   - Cons: port risk — if upstream changes model coefficients, we lag.
     Maintainer bus factor = 1.

3. **Roll our own win-probability-delta model**
   - Rejected explicitly by SPEC §3.4.

## Decision

Ship the Python port. Fall back to disabling the chart (E5-08c feature
toggle) if upstream port ever breaks. Document rpy2 as a rainy-day
option in case the port goes unmaintained for >12 months.

Rationale:
- The cost of a CI fire from rpy2 (silent stale data on the public site)
  is higher than the cost of a port-drift fire (manual sync once every
  few years, caught by contract test).
- The port's model is deterministic and covered by its own test suite,
  so we can add a contract test comparing our call to a pinned fixture —
  any coefficient drift triggers a test failure, not silent bad data.
- ETL image is already 100% Python + uv; adding R would break the
  "one runtime" property we have.

## Implementation

- Add `py4thdown>=X.Y` to `etl/pyproject.toml` dependencies.
- Wrap in `etl/transform/nfl4th.py` with a thin, testable interface:
  `score_fourth_downs(plays_df) -> list[FourthDownDecision]`.
- Feature-toggle via `DISABLE_NFL4TH=1` env var — ETL skips the scoring
  step, DAL returns `[]`, page renders "Model pending" callout.
- Contract test: a fixture of ~20 historical 4th downs with known
  `go_boost` values from upstream `nfl4th` (R); our Python port must
  produce values within 0.005 of the fixture.

## Fallback trigger

If any of these fail in prod:
- Port fails to install on ubuntu-latest
- Port's output diverges from fixture by >0.005 on >1 row
- Port maintainer stops releasing updates for >12 months

… switch to rpy2 + `nfl4th`. Runbook entry in `docs/runbook.md` will
capture the migration steps.

## Related

- SPEC §3.4 — "do not build our own"
- Plan §3.7 — nfl4th integration details
- `etl/transform/nfl4th.py` — wrapper module
- `etl/tests/test_nfl4th.py` — output-parity contract test
