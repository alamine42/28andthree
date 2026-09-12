---
title: "Anchor golden values to something you did not compute"
category: "best-practices"
date: "2026-09-12"
tags: [etl, contracts, golden-values, nflverse, rbsdm, pyarrow, testing, data-integrity]
files:
  - etl/scripts/verify_anchors.py
  - etl/tests/golden_values.yml
  - etl/tests/test_contracts.py
  - docs/runbook.md
---

# Anchor golden values to something you did not compute

## Symptom

A golden-value contract test stayed green through two real bugs. Defensive
ranks were inverted league-wide for four months (`78e`). Rush phases counted
scrambles for five months (`tbc`). Both times the anchors had been recorded
from the buggy output, so the test confirmed the bug on every run.

## Root cause

All 30 rows in `golden_values.yml` were `source: self`. A value copied from
your own pipeline can only detect that the pipeline changed. It cannot detect
that the pipeline was wrong when the value was copied.

## What we did

Two independent checks, one automated and one recorded by hand.

**1. Recompute from raw data with no shared code.**
`etl/scripts/verify_anchors.py` downloads the nflverse play-by-play parquet,
filters it with pyarrow per `docs/phase-definitions.md`, and ranks in plain
Python. It imports nothing from `etl/`. If it agrees with the ETL, the
agreement means something. All 30 rows agree.

**2. Record an external rank and assert a tolerance.**
NE's rank on rbsdm.com for the 24 pass/rush rows now sits in the file as
`rbsdm_rank`. Contract test #12 asserts the stored rank is within 2 places.
A rank inversion moves NE by 10 to 28 places, so 2 catches it. The tolerance
exists because rbsdm keeps penalty `no_play` rows that our §1.2 drops, which
shifts a rank by at most one or two places when teams are bunched.

The check was watched failing before it was kept: with 2022 pass_defense set
to `rbsdm_rank: 30` the test reported "stored 3 is more than 2 places from
rbsdm 30".

## Gotchas found on the way

- **The previous verifier hung, and the fix was not the parsing.** The draft
  called `.read()` on the whole 20 MB response. Streaming in 1 MB chunks with
  a per-chunk timeout finished in half a second. When a download hangs, look
  at how the bytes are read before looking at what happens after.
- **Shiny apps ignore programmatic form fill.** Setting the rbsdm season
  inputs via the DOM changed the visible value and nothing else. Typing with
  the keyboard and pressing Tab fired the events. There is also an explicit
  **Update** button further down the sidebar.
- **SumerSports is a moving target.** They re-fit their own EPA model. NE's
  2022 EPA/pass allowed moved from −0.11 to −0.14 in two weeks. Do not anchor
  to it. rbsdm runs the same nflfastR model we do and is stable.
- **A claim about an external number needs the number written down.** The
  earlier "Sumer ranks NE's 2022 run defense ~24th" was a misread. Sumer's
  own table has NE 3rd or 4th. Two sessions chased a gap that did not exist.
  This time every rbsdm table is in the runbook procedure and the rank is in
  the fixture next to the date it was read.

## How to apply

After any change to a phase filter: recompute prod, run
`verify_anchors.py`, re-record `rbsdm_rank` for the affected phase, run c12
against prod. The procedure is `docs/runbook.md#verifying-anchors`.

Related: `docs/solutions/gotchas/contract-doc-prose-and-sql-can-disagree.md`,
`docs/solutions/gotchas/one-sort-direction-inverts-lower-is-better-ranks.md`.
