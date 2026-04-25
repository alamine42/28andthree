# E9 Adversarial Review — Codex CLI

**Plan reviewed:** `docs/plans/e9-schedule-aware-plan.md` (v1)
**Reviewer:** Codex CLI (gpt-5)
**Date:** 2026-04-25

## Codex output (verbatim)

### CRITICAL — Offseason Freshness Gate Deadlock
- **Dimension:** Architecture
- **Location:** §3 "ETL freshness.py refactor"
- **Problem:** The new gate skips the ETL whenever `phase === 'offseason'` and `days_until_next_game` is `None` or >7. Because the gate runs *before* the ingest step, the only way `nextGameDate` ever becomes non-null is by running the ingest at least once after the next-season schedule is published. With the proposed guard, the job will never rerun to pull that schedule — `days_until_next_game` stays `None`, so the cron will skip forever and the site will miss the entire upcoming season.
- **Recommendation:** Treat a missing `nextGameDate` as "run to refresh schedule" (not "safe to skip"). For example, always run when `nextGameDate` is `None`, or add a max-skip window (e.g., force a run every N days in offseason) so new schedule releases get ingested.

### WARNING — Accent & Negative Colors Fail Contrast
- **Dimension:** UX/Design
- **Location:** DESIGN.md §Color (dark mode palette)
- **Problem:** On the default dark backgrounds (`--bg`/`--surface`), `--accent` (#D21F3C) and `--negative` (#A23A4A) only reach contrast ratios ≈3.6:1 and 2.9:1 respectively — well below WCAG AA 4.5:1 for normal text. These tokens are earmarked for CTA labels, live indicators, and negative deltas, so the design would ship inaccessible text.
- **Recommendation:** Darken/saturate these colors (or reserve them strictly for backgrounds with light text) until they meet ≥4.5:1 on both `--bg` and `--surface`. Adjust the usage guidance accordingly.

### WARNING — Playoff Round Mapping Assumes Numeric Weeks
- **Dimension:** Edge Cases
- **Location:** §5 "Simplicity review" / §3 "Phase derivation rules"
- **Problem:** The plan hardcodes postseason round detection to "week 19 = wild card", etc. In nflverse schedule data the `week` field is string-valued (`'Wildcard'`, `'Divisional'`, etc.), so the mapping will never fire and `playoffRound` will stay `null`, breaking the playoff eyebrow copy.
- **Recommendation:** Derive the round from `season_type` + `game_type` or from the string `week` values provided by nflverse, not assumed numeric week numbers.

### SUGGESTION — Normalize Date Math To Local Midnight
- **Dimension:** Edge Cases
- **Location:** §3 ("ScheduleSnapshot" fields & UI consumers)
- **Problem:** `daysUntilNextGame`/`daysSinceLastGame` will be computed with JavaScript `Date`s coming back as UTC midnights. Without normalizing to the Pats' timezone, countdown text (e.g., "NEXT GAME IN 87 DAYS") can swing by ±1 around midnight boundaries.
- **Recommendation:** When deriving the day deltas, convert the stored date to an `America/New_York` local date (or add 12h before diffing) to produce stable whole-day counts.

### PRAISE — Data Integrity Guardrails Called Out Explicitly
- **Dimension:** Architecture
- **Location:** SPEC.md §3.5a & §8
- **What's working:** The spec elevates deterministic ranks, small-sample handling, and ETL contract tests to first-class rules. That rigor is exactly what keeps a data property credible — keep leaning on it during implementation.

### Summary
- **Total findings:** 1 critical, 2 warnings, 1 suggestion, 1 praise
- **Top 3 risks:** (1) ETL freshness deadlock prevents next-season ingest, (2) inaccessible accent/negative colors, (3) playoff round detection failing due to nflverse week formats.
- **Overall assessment:** Needs revisions before implementation.
- **Confidence level:** Medium.

---

## Adjudication

| # | Severity | Verdict | Notes |
|---|---|---|---|
| 1 | CRITICAL | **Accepted** | Real bug. Plan v2 §3 adds three skip guards: (a) skip only when `next_game_date IS NOT NULL`, (b) and `days_until > 7`, (c) and last successful run < 14 days ago. The 14-day ceiling is the deadlock breaker — even a "stale forever" view forces a periodic refresh attempt. |
| 2 | WARNING | **Deferred (out of scope)** | DESIGN.md issue. Filed as separate beads issue. Not blocking E9. |
| 3 | WARNING | **Rejected with note** | Codex's premise is correct for raw nflverse output — but our ETL normalizes via `etl/ingest/nflverse.py::fetch_schedules` to `smallint week`. Verified against actual DB rows (2024-25 + 2025-26 POST): weeks are 19, 20, 21, 22 with counts 6/4/2/1 — exactly the wild-card/divisional/conference/SB shape. Numeric mapping is correct here; documented inline in v2 §5. |
| 4 | SUGGESTION | **Accepted** | Plan v2 §3 specifies `America/New_York` for day-delta math in both TS (`Intl.DateTimeFormat` or date-fns-tz) and Python (`zoneinfo.ZoneInfo`). |
| Praise | — | **Noted** | Will continue ETL contract-test discipline for the new helper (golden-values fixture shared between TS + Python tests). |
