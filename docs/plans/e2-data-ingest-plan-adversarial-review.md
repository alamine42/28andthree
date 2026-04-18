# E2 Plan — Adversarial Review Adjudication

**Date:** 2026-04-18
**Reviewer:** Self-review (adversarial mode). Codex CLI is currently refusing all gpt-5 variants against the authed ChatGPT account ("The 'gpt-5' model is not supported when using Codex with a ChatGPT account"). Re-auth needed (`codex login`) before the canonical codex pass. Findings below are the best-effort stand-in: a deliberately skeptical read against the plan with SPEC.md §3.5a and IMPLEMENTATION.md §3 as anchors.
**Plan under review:** `docs/plans/e2-data-ingest-plan.md` v1.

12 findings. Each is adjudicated: **ACCEPT** (apply to plan + tasks), **PARTIAL** (adopt some mitigation, not all), **REJECT** (keep plan as-is, with reason), or **DEFER** (valid but out of scope for E2).

---

## Findings

### 1. Column subset on `plays` will force a backfill in E4 and E5

**Critique (HIGH).** The plan picks ~25 columns from nflverse's ~370. E3 (trend charts, distribution) needs nothing beyond the subset. But E4 and E5 need columns the plan doesn't pull:

- **E4 QB deep-dive** needs `was_pressure`, `qb_hit`, `sack`, `number_of_pass_rushers`, `aDOT` (derivable from `air_yards`/`pass_attempt`), and `roof`/`surface` for split splits. Some derivable, some not.
- **E5 coaching tendencies** needs `shotgun`, `no_huddle`, `pre_snap_motion` (nflverse: `pre_snap_motion`), `play_action`, `personnel_offense`, `personnel_defense`, `defenders_in_box`, `number_of_pass_rushers`.
- **E5 4th-down (`nfl4th`)** needs the full game-state bundle: `score_differential`, `game_seconds_remaining`, `posteam_timeouts_remaining`, `defteam_timeouts_remaining`, plus `yardline_100`, `ydstogo`, `down` (which we already have).

Adding these later means re-running a ~10-min backfill every time a column is added. At 300k rows, the plan is fine for one re-run but 3–4 re-runs across the project is friction that hurts velocity and burns Neon compute hours.

**Verdict: ACCEPT.** Bring known-needed columns into E2-02 now. Drop them from `plays` only if there's a concrete reason — storage isn't it (an extra 15 columns @ 6 bytes avg × 300k = 27 MB, rounding error against the 500 MB Neon cap).

**Fix applied:**
- Extend the `plays` schema in §3.3 to include:
  - E4-ready: `qb_hit`, `sack`, `was_pressure`, `number_of_pass_rushers`
  - E5-ready: `shotgun`, `no_huddle`, `pre_snap_motion`, `play_action`, `personnel_offense`, `personnel_defense`, `defenders_in_box`
  - 4th-down model inputs: `score_differential`, `game_seconds_remaining`, `posteam_timeouts_remaining`, `defteam_timeouts_remaining`, `roof`, `surface`
- Update E2-02 beads task notes to list the full column set.
- Mark them in `db/schema.ts` with `// E4-dep` / `// E5-dep` / `// E5-nfl4th-dep` comments so future readers see intent.

### 2. Pandas-on-polars baseline (contract test #4) is circular

**Critique (MEDIUM).** The plan's contract test #4 says "Pats pass-offense EPA matches pandas-on-polars recomputation within 1e-9." Both paths consume the same nflverse parquet; they'll agree even if nflverse's upstream `epa` column is systematically wrong. The test catches aggregation bugs but not source-data bugs.

**Verdict: ACCEPT.** Keep the circular-baseline check (it's the fastest to implement and catches most ETL-side bugs) but add at least one **externally-anchored golden value** that was pulled from a published source (rbsdm.com or Sumer Sports) and committed as a test constant.

**Fix applied:**
- Add contract test #12: "Pats 2025 end-of-season pass-offense rank matches a hand-recorded value in `etl/tests/golden_values.yml`." The YAML file gets one entry per season × phase for Pats, sourced from rbsdm.com or Sumer Sports. ~12 values total.
- If a future nflverse release shifts the EPA baseline meaningfully, this test fails and we investigate rather than silently publishing drifted numbers.
- File a new beads task `E2-11a: Golden-value anchor fixture` blocking E2-11 closure.

### 3. `/status/data` static secret repeats E1's rejected pattern

**Critique (MEDIUM).** The E1 adversarial review (`e1-foundation-plan-adversarial-review.md` finding #4) rejected this exact pattern — static token + IP rate limit — for E1 and deferred the endpoint to E2. The plan now re-introduces it because the endpoint has a consumer (the builder, for debugging) and the rate limiter is durable. That's a better case, but "static shared secret in prod env" is still a leaky boundary — token lands in shell history, maybe a screenshot, maybe a GH issue. Upstash free tier is 10k req/day and 60 req/min is the rate limit, so worst-case abuse is ~60 req/min × token lifespan. Small DoS amplifier.

**Verdict: PARTIAL.** Ship the rate-limited endpoint in prod, but add two mitigations the plan didn't name:

**Fix applied:**
- **Vercel Access gate for the first 30 days post-E2**: enable Vercel's built-in "Password-protect preview deployments" + route `/status/data` to preview-only for the first month. After E3 ships (real data pages exist), reconsider exposing in prod behind the static token.
- **Per-route log every `/status/data` hit** with IP + timestamp + status. A week of `vercel logs | grep status/data` should show ≤ 10 req/day. Any spike → rotate the token.
- **Scheduled token rotation**: add a `rotate-status-token.sh` script + calendar reminder quarterly. Noted in `docs/runbook.md#status-data-auth`.

Update E2-13 acceptance: "includes Vercel-Access gate for 30 days + log-scraping check + rotation script."

### 4. Retry workflow checking "last run exit code" via GH API is brittle

**Critique (MEDIUM).** The plan's retry flow queries the GH API at the start of each retry window to see if the 10am primary exited with code 2. This has failure modes:

- GH API rate-limit on a noisy repo day.
- Primary run still `in_progress` when retry fires (edge case: a slow nflverse pull) → retry sees "no exit code yet" and does what?
- Auth: the retry workflow needs a token with `actions:read`; `GITHUB_TOKEN` has it by default but cross-workflow visibility has edge cases.

Simpler pattern: both primary and retry run the **same freshness-gate check**. If fresh → run the full ETL. If not → exit 0 (write a heartbeat). The primary does this at 10am; retries at 14 + 18; each is stateless. No need for cross-run state queries. If all three find "not fresh" all day, a separate `etl-summary.yml` cron at midnight Wednesday checks `max(completed_at)` on `meta_refresh`, and opens a GitHub issue if no `ok` row exists for the current Tuesday.

**Verdict: ACCEPT.** The stateless pattern is strictly simpler and removes the cross-run coupling.

**Fix applied:**
- Rewrite §3.8 retry logic: primary + retry both run the full ETL with a freshness-gate at the front. Gate exits 0 (not 2) when stale — no "retry me" signal.
- Kill the "3-strike via actions/github-script" logic inside `etl-retry.yml`. Replace with a separate `etl-summary.yml` that fires Wednesday 00:00 UTC and queries the DB: if no `status='ok'` row since last Tuesday 00:00, open a GH issue.
- Simplifies E2-14. Update acceptance.

### 5. Team abbreviation normalization is unmentioned

**Critique (MEDIUM).** nflverse has two known historical team-abbreviation shifts that our 2020–2025 window partially covers:

- **OAK → LV** (2020 season onward; our window is clean, always LV).
- **SD → LAC** (2017 onward; clean).
- **STL → LAR** (2016 onward; clean).
- **WAS vs WSH**: Commanders rebrand. nflverse uses `WAS` in PBP but `WSH` shows up in some ESPN endpoints. Mixed in 2020–2025 parquet files.

If a future season reintroduces a rebrand (e.g., a new relocation), our `VARCHAR(3)` + phase enum wouldn't catch a `WSH` row hitting a `WAS`-grouped aggregation. Silent data loss.

**Verdict: ACCEPT.** Add a normalization step in the loader + a contract test.

**Fix applied:**
- Add `etl/ingest/teams.py` with a `TEAM_ABBREVIATION_ALIAS` dict (one entry now: `WSH → WAS`; extensible). Apply on every `posteam`/`defteam`/`home_team`/`away_team` field before COPY.
- Add contract test #13: `SELECT DISTINCT posteam FROM plays WHERE posteam IS NOT NULL` returns exactly 32 values, all in the known NFL-team abbreviation allowlist.
- Add test #14: same for `defteam`.
- Update E2-04 notes.

### 6. Garbage-time / hail-mary filter is not explicit

**Critique (LOW-MEDIUM).** Different analytics sources handle these differently:

- Football Outsiders (historical) excluded "garbage time" (> 14-point lead, 4th quarter).
- FTN / Sumer / rbsdm include everything.
- Nobody I know excludes hail-mary plays (no widely-adopted filter).

The plan excludes kneels, spikes, 2-point attempts, and `no_play` — correctly. It doesn't mention garbage time. Default (include everything) is fine, but the plan should state it explicitly so a future reader doesn't wonder.

**Verdict: ACCEPT.** Document the choice; don't change behavior.

**Fix applied:**
- §3.4 of the plan gets a new paragraph: "We do not apply a garbage-time filter. Rationale: aligns with rbsdm/FTN/Sumer; excluding garbage time biases a team's EPA toward its middle-game performance and obscures 4th-quarter collapse patterns, which are legitimate signal for a fan site. If garbage-time analysis becomes interesting, add it as a secondary view, not a primary rank filter."
- Mirror in `docs/phase-definitions.md` (E2-05a).

### 7. No advisory-lock / concurrent-run protection

**Critique (LOW).** If two ETL invocations hit Neon at the same time (cron + manual dispatch, or operator mistake), they race on the same UPSERT + UPDATE targets. Postgres will serialize through row locks but the logical result could be a partial re-aggregation from one run interleaved with another. Simple guard: `SELECT pg_try_advisory_xact_lock(8675309)` at run start; if false, exit 0 with a "concurrent run detected" log.

**Verdict: ACCEPT.** Cheap, deterministic, avoids a foot-gun the plan hadn't named.

**Fix applied:**
- Add to E2-09 acceptance: "ETL acquires `pg_try_advisory_xact_lock(8675309)` at run start; if not acquired, exit 0 with a log event `concurrent_run_skipped`."
- Document lock ID in `etl/load/__init__.py` with a comment.

### 8. Off-season cron behavior undefined

**Critique (LOW).** The weekly cron fires every Tuesday, including Feb through August when there are no games. The plan's freshness gate finds "our DB's max week = 22 (Super Bowl); nflverse's max completed game week = 22; not strictly newer → exit 2" — which would trigger the retry workflow pointlessly, running three times a Tuesday all summer.

**Verdict: ACCEPT.** Gate should know "season over; no action needed."

**Fix applied:**
- Add to E2-08 acceptance: "freshness gate exits 0 (not 2) when `max(completed_at)` in `games` for the current season equals the full regular-season length (18 weeks REG) AND Super Bowl date has passed, meaning the season is truly complete."
- Alternative simpler heuristic: "if `today` is between the day after the Super Bowl and the start of the next season's Week 1 kickoff date (from `load_schedules(next_season)`), exit 0 with a heartbeat. No retry needed."
- Avoids retry-workflow noise through the offseason.

### 9. Neon 500 MB free tier is tight; plan underestimates buffer

**Critique (LOW).** Plan §9 says "300 MB plays + 150 MB indexes = 450 MB, budget for Launch tier." Real storage with 25 columns + 5 indexes + `team_phase_*` + `games` is closer to:

- `plays` table: 300k rows × ~25 columns × ~12 bytes avg (with enums, smallints, booleans) ≈ 90 MB.
- `plays` indexes: 5 indexes × ~24 bytes per entry × 300k rows = 36 MB. Plus TOAST and free space = ~50 MB.
- After adding §1's extra columns (+15 cols × ~4 bytes avg × 300k = 18 MB): +18 MB.
- `team_phase_*`, `games`, `meta_refresh`: ~15 MB.
- **Total: ~170 MB.** Well under 500 MB.

But: WAL, vacuum overhead, Postgres's column packing inefficiency, system catalog growth — historically Neon users see 2–3x the "raw" number. Realistic: 300–400 MB.

**Verdict: REJECT (partial).** The plan's conclusion ("budget for Launch tier from day 1") is correct. The math was too pessimistic but the decision is still right — Launch tier is $19/mo, gives us 10 GB and removes the budget anxiety. Don't re-do the math; keep the decision.

**Fix applied:**
- Clarify §9 risk line: "Provision Neon Launch tier ($19/mo) at E2 kickoff to remove the storage+compute squeeze. The 500 MB free tier was adequate for E1 but not for E2+."

### 10. Percentile math: denominator choice could confuse readers

**Critique (LOW).** §3.5 computes `percentile = (K - rank + 1) / K` where K = teams meeting threshold that week. For a week where all 32 teams qualify, this gives percentiles in [1/32, 1.0]. For a week where K=28, ranks run 1..28 and percentiles run [1/28, 1.0]. Rank-1 always gets 1.0 percentile regardless of K. That's correct for "how good relative to the league that week" but might confuse users: a team's rank-1 in Week 3 (K=28) has less competition than rank-1 in Week 10 (K=32).

**Verdict: REJECT.** Correct decision; this is the standard. But document it, because E3 will render these percentiles on phase pages.

**Fix applied:**
- Add one sentence to §3.5: "Percentile is relative to teams meeting the sample-size threshold in that week. When a team is rank 1 of K=28 (4 teams insufficient-sample), its percentile is 1.0 — same as rank 1 of K=32. This is deliberate; the denominator reflects the population being ranked, not an abstract league."
- Pass this to E3 when it renders percentile chips.

### 11. `/status/data` zod schema allowlists only `2020–2026` for season

**Critique (LOW).** Plan's §4.1 unit test asserts the season zod schema rejects 2019. Great for 2026 — but hardcoding the upper bound as 2026 means the first Tuesday of 2027 Week 1, `/status/data` starts rejecting `season=2027` until someone edits the allowlist. A rare but annoying bug.

**Verdict: ACCEPT.** Derive the upper bound from code, not a constant.

**Fix applied:**
- Replace `season ∈ [2020, 2026]` with `season ∈ [2020, new Date().getFullYear() + 1]`. The "+1" accommodates off-by-one during August–December (NFL season year = calendar year of Week 1).
- Update §4.1 test: use a variable for the upper bound so the test is also forward-compatible.

### 12. Drizzle→Pydantic drift check (E2-00b) is worth it, but scope-creeping the CI

**Critique (LOW).** E2-00b adds a GH Actions check that runs `drizzle-kit introspect` + JSON comparison against Pydantic. For 5 tables + 12-value enum, the drift-risk surface is small; the CI cost is real (adds ~30s to every PR). Worth it only if E3+ keeps adding tables at a clip.

**Verdict: PARTIAL.** Keep the check but scope it as a pre-commit-optional / CI-advisory thing for E2, then promote to blocking in E4 when player tables land.

**Fix applied:**
- E2-00b builds the check but CI treats failure as **warning** (non-blocking) in E2. Set it to blocking in E4 when `players` + 2 rollup tables double the drift surface.
- Annotate in `db/schema.ts`: "ANY schema edit requires `etl/models.py` update; CI warns in E2, blocks in E4."

---

## Summary

| # | Severity | Verdict | Finding |
|---|---|---|---|
| 1 | HIGH | ACCEPT | `plays` column subset forces E4/E5 backfill; widen now |
| 2 | MEDIUM | ACCEPT | Pandas baseline is circular; add external golden values |
| 3 | MEDIUM | PARTIAL | `/status/data` static secret → gate to preview-only for 30 days + log + rotate |
| 4 | MEDIUM | ACCEPT | Retry workflow stateless pattern; kill cross-run GH API lookup |
| 5 | MEDIUM | ACCEPT | Team abbreviation normalization (`WSH`→`WAS`) + contract test |
| 6 | LOW-MEDIUM | ACCEPT | Document "no garbage-time filter" policy explicitly |
| 7 | LOW | ACCEPT | `pg_try_advisory_xact_lock` for concurrent-run protection |
| 8 | LOW | ACCEPT | Freshness gate knows about off-season (exit 0 Feb-Aug) |
| 9 | LOW | REJECT (decision OK) | Neon budget math tightened; Launch tier still right call |
| 10 | LOW | REJECT (decision OK) | Percentile denominator documented, not changed |
| 11 | LOW | ACCEPT | Dynamic season upper bound, not hardcoded 2026 |
| 12 | LOW | PARTIAL | Drift check non-blocking in E2; blocking from E4 |

**Plan delta:** 10 accepts + 2 keep-as-is-with-clarification. Net new work: ~3 hours (mostly contract test #12 golden values + team normalization + column additions in schema). No architectural pivots.

**New beads tasks:**
- `E2-11a: Golden-value anchor fixture` — blocks `E2-11` closure.
- (no other new tasks; findings fold into existing task notes).

**Re-run codex canonical review** once `codex login` succeeds and `gpt-5-codex` is accessible under the authed account. This self-review should catch the high-value critiques but misses the independent-model angle.
