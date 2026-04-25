---
title: "Sandbox-isolation CI sentinels must survive fixture regeneration"
category: "gotchas"
date: "2026-04-25"
tags: [sandbox, ci, e8, sandbox-dump]
files: [scripts/sandbox-dump.ts, .github/workflows/sandbox-isolation.yml, lib/sandbox/fixtures/]
---

# Sandbox-isolation CI sentinels must survive fixture regeneration

## Problem

E8 ships a `.github/workflows/sandbox-isolation.yml` job that builds the prod bundle (sandbox off) and greps `.next/` for known fixture-only strings. If any leak through, the build-time alias map in `next.config.ts` failed and the workflow fails. The sentinel list was hand-curated against the original hand-curated fixture data:

```yaml
SENTINELS=("00-2024-MAYE" "2025_12_NE_NYJ" ...)
```

E8-10 (bd-5xo) ships `scripts/sandbox-dump.ts` to **regenerate fixtures from real prod rows**. After running it once, the synthetic IDs the CI sentinel relied on don't exist anymore — the fixtures contain real player names + real game IDs. CI passes vacuously: nothing to detect because the sentinels exist nowhere.

## Root Cause

Two coupled but non-obvious dependencies:

1. The CI workflow's grep list and the fixture file content are tightly coupled — change one, the other breaks (silently, in CI's case).
2. The sandbox-dump script's whole purpose is to overwrite fixture data with prod values, so any sentinel string that's "fixture-only by virtue of being made up" gets erased on every regen.

## Solution

The augmenter in `scripts/sandbox-dump.ts` injects four sentinel strings into the dumped fixtures explicitly, so they always exist no matter what prod data looks like. Each lives somewhere natural in the schema:

| String | Where it lands | Constant in script |
|---|---|---|
| `__SANDBOX_FIXTURE__tie_game` | A synthetic tie game's `gameId` in `team.ts` | `SENTINEL_GAME_ID` |
| `__SANDBOX_FIXTURE__draft_pick` | A synthetic draft row's `gsisId` in `draft.ts` | `SENTINEL_DRAFT_GSIS` |
| `__SANDBOX_FIXTURE__phase_team` | A synthetic distribution row's `team` in `phases.ts` | `SENTINEL_PHASE_TEAM` |
| `[augmented] mid-season replacement` | Augmenter-injected OC's `coachName` in `coaching.ts` | `SENTINEL_COACH_NAME` |

The `.github/workflows/sandbox-isolation.yml` SENTINELS array is updated to match. The script has a comment block reminding future editors to keep them in sync.

## Prevention

- [ ] When regenerating fixtures with `pnpm sandbox:regenerate`: leave `--augment` on (the default). Running with `--no-augment` produces fixtures without the sentinel strings, and the CI workflow will pass vacuously.
- [ ] If you change a sentinel string in `scripts/sandbox-dump.ts`, update the workflow's `SENTINELS=( ... )` array in the same commit.
- [ ] Don't use real player names as sentinels — the local-grep equivalent (a developer running `grep "Drake Maye" .`) would hit DESIGN.md, HANDOVER.md, etc. Synthetic markers (`__SANDBOX_FIXTURE__*`) are unambiguous.

## Related

- `docs/sandbox.md#regenerating-fixtures-from-prod`
- bd-5xo close note (sentinel mapping table)
- Plan: `docs/plans/e8-sandbox-plan.md` §3 (alias map)
