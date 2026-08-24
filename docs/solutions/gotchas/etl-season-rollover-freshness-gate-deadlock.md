# ETL season rollover: the freshness gate deadlocks after the Super Bowl

**Date:** 2026-08-24
**Issue:** patsbythenumbers-347
**Commit:** a1a28dc

## Symptom

Every scheduled ETL run from February through August exits with
`freshness_gate decision=False reason=already_loaded phase=offseason season=2025`
even though the workflow passes `--season 2026`. The `games` table never
gets 2026 rows. The site stays on the old season with no next-game
countdown. Without a fix, the deadlock survives kickoff: Week 1 completes
and the gate still says `already_loaded`.

## Root cause

Two facts compound:

1. The gate derived its season from the `games` table
   (`etl/schedule.py::_pick_current_season`) and ignored the `--season`
   CLI arg. After the Super Bowl, nflverse and the DB agree on the old
   season's max completed week (22) forever. The gate short-circuits on
   `already_loaded` every run.
2. Even a forced run would crash: `run_season` called `fetch_pbp` first,
   and nflverse publishes no PBP file for a season before its first game.

The 14-day offseason ceiling in `check_freshness` did not help. It only
skips the *offseason* guard; the run then dies on `already_loaded`.

## Fix

- `check_freshness` takes `target_season`, `target_schedule_available`,
  and `db_has_target_games`. When the target is ahead of the snap, the DB
  lacks it, and nflverse has published the schedule, the gate returns
  `should_run=True, reason=season_rollover`.
- `run_season` fetches the schedule first. A season with zero completed
  games becomes a schedule-only ingest: upsert `games`, skip PBP,
  rosters, and every rollup. `row_counts` carries `schedule_only: 1` and
  contract test c10 skips such runs.
- Once the schedule lands, phase derivation shows the countdown, and the
  first post-kickoff run proceeds through the normal path.

## Related gotcha: GitHub disables idle crons

GitHub disables scheduled workflows after 60 days without repo activity.
All five crons here (ETL, retry, summary, nightly CI, authoring) went
silent from 2026-07-05 to 2026-08-24. The weekly `keepalive` job in
`etl.yml` now resets the timer with
`gh api -X PUT repos/{repo}/actions/workflows/{wf}/enable` (needs
`permissions: actions: write`).

## Annual checklist (each May, when nflverse publishes the schedule)

1. Nothing manual for the schedule — the next Tuesday cron ingests it via
   `season_rollover`.
2. Bump `DEFAULT_BACKFILL_SEASONS` upper bound in `etl/main.py`.
3. After the draft: add the year to `etl/scripts/e5_pats_seed.py` and
   `DRAFT_CLASS_YEARS` in `app/draft-roi/page.tsx`, run the seed, and
   re-run it once after Week 1 so rookie `gsis_id` links resolve (the
   FK guard nulls ids with no `players` row).
