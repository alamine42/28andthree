# E3 Plan — Adversarial Review Adjudication

**Date:** 2026-04-19
**Reviewer:** Codex CLI (gpt-5-codex via API-key auth), challenge mode.
**Plan under review:** `docs/plans/e3-team-overview-plan.md` v1.
**Raw output:** `/tmp/codex-e3-review-output.txt` (session-local).

Codex raised 12 findings. Each is adjudicated: **ACCEPT** (apply to plan + tasks), **PARTIAL** (adopt some mitigation, not all), **REJECT** (keep plan as-is, with reason).

---

## Findings

### 1. Recharts bundle math is optimistic

**Severity: MEDIUM.** Codex argues `~55 KB gzip` is a 2024 number; 2026 Recharts 3.x drags `victory-vendor` and locale chunks, landing closer to 80–95 KB. The reactive fallback ("escape to SVG if it blows the budget") means we'd re-do TrendChart mid-sprint.

**Verdict: ACCEPT.** Flip the plan from "use Recharts unless it blows the budget" to "measure first, pick library second."

**Fix applied:**
- §3.6 rewritten: install `@next/bundle-analyzer` as the first E3 task. Run `pnpm build --analyze` against a one-LineChart-spike (even stubbed data) before committing to Recharts for the real pages.
- If Recharts pushes home page > 160 KB, implement TrendChart + Sparkline as plain SVG too. Decision point at the end of day 1, not end of sprint.
- Add an enforced Lighthouse CI budget in `lighthouserc.json`: `total-byte-weight: 200kb` (with ~20 KB headroom for asset growth).

### 2. Dynamic `K` in `rankTier` will confuse users

**Severity: MEDIUM.** Codex: a fan seeing "rank 10" during a week where 4 teams are insufficient-sample sees amber, even though they instinctively map ranks to 32 teams. UI gives no shrinkage hint.

**Verdict: PARTIAL.** The original intent (tier relative to population being ranked) is defensible statistically but codex is right that it misleads on the rare weeks. Tier **against 32** is the right default; surface K in a subtitle when it's not 32.

**Fix applied:**
- §3.4 `rankTier(rank, totalTeams = 32)` now always divides by 32 unless the caller explicitly passes a smaller total (which we won't). Ranks 1–11 positive, 12–21 neutral, 22–32 negative — stable and recognizable.
- When K<32 in a given week, a small caption appears below the rank: "of 28 qualified teams." Rendered by `<QualifiedDenominator k={k} />`; absent when K=32.
- Unit tests updated: `rankTier(10, 32)` is positive regardless of K.

### 3. Revalidate paths hardcoded in two places + query-string ISR split

**Severity: MEDIUM.** Both findings correct: (a) drift risk if a phase is added; (b) Next's ISR caches `?view=raw` as a separate entry from the default view, so `revalidatePath('/phases/pass_offense')` doesn't clear both.

**Verdict: ACCEPT.**

**Fix applied:**
- Single source of truth: `lib/revalidation/paths.ts` exports `REVALIDATABLE_PATHS` built from `PHASES`. ETL workflow curl body and `/api/revalidate` allowlist both import this list (the workflow generates the JSON inline from a step that runs `node -e 'console.log(JSON.stringify(require(...)))'` — or we commit a generated JSON file that both consume).
- Switch from `revalidatePath` to **`revalidateTag`**. Server components tag fetches with `phase:<slug>` and `home`. One `revalidateTag('phase:pass_offense')` call flushes every URL variant of that page (default view AND `?view=raw`).
- Drop `?view=raw` from the URL entirely — see finding #8 (client-side toggle over a precomputed series). Removes the query-string ISR split problem permanently.

### 4. `getPhaseSparklineSeries` conflates home + trend-chart needs

**Severity: MEDIUM.** Home-page sparklines only need Pats data. The TrendChart needs Pats + league median. Blending makes both slower.

**Verdict: ACCEPT.** Split the DAL.

**Fix applied:**
- `getPatsPhaseSparklines(season)`: one query, returns 12 phases × last 8 weeks of Pats-only data (96 rows). For the home grid.
- `getPhaseWeeklyTrend(phase, team, season)`: one query, returns 18 weeks × (Pats + league median precomputed via `AVG(epa_per_play) OVER (PARTITION BY season, week)`). For the phase detail.
- Eliminates the "96 rows vs 192+" ambiguity from the plan; each function has a documented row bound.

### 5. Week-results EPA diff has no data source

**Severity: HIGH.** `getRecentGames` reads from `games`, which only has scores — not EPA differentials. The strip renders `+0.12 EPA` in the sketch; the data doesn't exist.

**Verdict: ACCEPT.** Denormalize EPA per game into `games` during ETL. Cheap to compute, cheap to store (2 doubles × 1,693 rows = negligible).

**Fix applied:**
- Add two columns to `games`: `home_offense_epa_per_play` and `away_offense_epa_per_play` (both double precision, nullable). Migration `0004_e3_games_epa`.
- `etl/load/plays.py` or a new `etl/transform/games_epa.py`: after plays for a game load, compute `AVG(epa)` per `(game_id, posteam)` over REG qualifying plays (same filter as phase aggregations, minus the phase-specific predicates). UPDATE the games row.
- `getRecentGames(team, season, n=6)` returns `{ game_id, opponent, result, score_for, score_against, team_epa_per_play, opp_epa_per_play }`. The strip displays the differential `team_epa - opp_epa`.
- Contract test addition (#15): every completed REG game has both `home_offense_epa_per_play` AND `away_offense_epa_per_play` non-null.
- This is **cross-cutting into E2's ETL code** — file a new beads task `E3-15: ETL denormalize per-game EPA into games table` (or extend E2-04 scope retroactively — new task is cleaner).

### 6. `getCurrentSeason()` stale at season rollover

**Severity: MEDIUM.** Correct. When the first 2026 ETL runs, `team_phase_weekly` gets 2026 rows before `team_phase_season` does (season rollup needs ≥30 plays/phase per SPEC §3.5a threshold). For the first few weeks of a new season, `MAX(season) FROM team_phase_season` is still 2025.

**Verdict: ACCEPT.** Use `team_phase_weekly` as the source.

**Fix applied:**
- §3.8 rewritten: `getCurrentSeason()` returns `MAX(season) FROM team_phase_weekly WHERE insufficient_sample = false`. Fires as soon as any team has enough plays in any phase in the new season.
- Hero eyebrow becomes `"2026 SEASON · WK N"` (in progress) vs `"2025 SEASON · FINAL"` (completed) — state driven by whether the season table has a row for that year yet.
- Unit test for the transition case: fixture with 2025 fully populated in season table, 2026 only in weekly → `getCurrentSeason()` returns 2026, rendering picks up the "in progress" suffix.

### 7. Hero YoY delta has no week-1 fallback

**Severity: MEDIUM.** Correct. Week 1 of a new season has no current-season rank, so the delta crashes or shows stale 2025 numbers.

**Verdict: ACCEPT.**

**Fix applied:**
- `getTeamSeasonOverview` now returns `currentSeasonRank: number | null` and `prevSeasonRank: number | null`.
- Hero delta component: if `currentSeasonRank === null`, render the current rank and delta as em-dash with tooltip "Season rank available after week 3" (threshold chosen to match the 30-plays-season sample-size guard).
- `formatDelta(null)` already returns empty string — integrates cleanly.
- Unit test added: week-1 fixture → hero renders "—" for rank + empty delta.

### 8. Client-side rolling average wastes JS + risks SQL/JS parity drift

**Severity: LOW.** Computing 4-week rolling on client means the sample-size skip rule lives in two places.

**Verdict: ACCEPT.** Pushed to the DAL.

**Fix applied:**
- `getPhaseWeeklyTrend` returns **two series** per phase: `raw` (one point per week, `null` for insufficient-sample weeks) and `rolling4` (one point per week, computed via SQL window function, skipping `insufficient_sample = true` weeks from the window).
- TrendChart client component toggles between the two precomputed arrays — no client-side math. Toggle state now **lives in React component state, not a URL param**; simpler, and eliminates the ISR query-string cache split (finding #3) entirely.
- Bundle win: one less window function to ship.

### 9. Revalidate token via curl-in-CI leak risk

**Severity: LOW.** Codex suggests Vercel's webhook-from-data-job as a mitigation.

**Verdict: REJECT (decision), keep mitigation doc.** The GH Actions secret handling is already our accepted threat model for `ETL_DATABASE_URL` (a much higher-value secret). If that's acceptable, `REVALIDATE_TOKEN` is too. Moving invocation into the Python ETL would couple Next's revalidation API to the Python process and give us fewer inspection points, not more.

**Fix applied:**
- §3.7 gets an explicit security note: token never echoed in GH Actions log output (use `run: |` with the header inlined; no `echo`). Quarterly rotation is in `docs/runbook.md#status-data-auth` (already documented for a similar secret).
- Add contract-test-style assertion: unit test that the workflow YAML contains `${{ secrets.REVALIDATE_TOKEN }}` and no plaintext token value.

### 10. `data-numeric` attribute forgettable → crawler blind spot

**Severity: MEDIUM.** Correct. If someone renders a metric with raw JSX, the crawler misses it.

**Verdict: ACCEPT.**

**Fix applied:**
- Define three renderer components: `<RankNumber rank={...} />`, `<MetricValue value={...} format={formatEpa} />`, `<Delta value={...} />`. Each always emits `data-numeric="true"` + the already-formatted string.
- Eslint rule (or CI grep): any numeric-like JSX outside these wrappers is a style error. Minimum enforcement: a grep in `ci.yml` for raw `{.*\.toFixed\(` or `{.*\.toString\(}` in `app/` and `components/` — warns on untagged metrics.
- `no-bad-numbers.spec.ts` gains an invariant test: count of `data-numeric="true"` elements on `/` ≥ 12 (hero + phase cards) and on `/phases/pass_offense` ≥ 5 (rank card + distribution + trend axis labels). If the count drops, something slipped through without a wrapper.

### 11. Cranberry contrast fails WCAG AA for body text

**Severity: MEDIUM.** Correct. 2.84:1 is fine for display-size text (AA large = 3:1) but fails for deltas/tooltips at body size.

**Verdict: ACCEPT.**

**Fix applied:**
- §3.11 pinned: `--negative` (#a23a4a) is usable only on elements ≥ 24 px AND weight ≥ 500, OR as a border/icon color. The "big rank" `RankNumber` at 30 px Cabinet Grotesk Bold qualifies.
- For deltas, rank-badges, tooltips: the text stays `--text` and the semantic color is carried by the adjacent glyph or a border. E.g. `▼ 03` uses `--text` for the number and `--negative` only for the ▼ glyph (which is a 14 px decorative character, not body text).
- Playwright axe scan will catch regressions here automatically.

### 12. `overall_offense` ≠ SPEC's "overall team EPA differential"

**Severity: MEDIUM.** Correct spec-reading. SPEC §3.2 phase #12 is the team's offensive EPA/play *minus* defensive EPA/play allowed. We computed `overall_offense` in E2 (offensive plays only, grouped by posteam, AVG(epa)). Not the same thing.

**Verdict: ACCEPT.** Fix the divergence now.

**Fix applied:**
- Rename the E2 `overall_offense` phase to **`overall`**, and redefine its aggregation to `posteam_epa − defteam_epa` at the team-season level. This requires:
  1. A new ETL transform that computes `AVG(epa) FILTER (WHERE posteam = team) − AVG(epa) FILTER (WHERE defteam = team)` per team-season-week.
  2. Renaming the `phase_enum` value `overall_offense` → `overall` (Postgres enum rename; not in-txn so separate migration step).
  3. Updating `PHASES` + `PHASE_DISPLAY_NAMES` + `PHASE_FILTERS` + `golden_values.yml`.
- File a new beads task `E3-16: Overall-phase redefinition (spec alignment with §3.2 #12)`. Depends on `E3-15`. Blocks Home hero (E3-02) since the hero's "overall rank" comes from this.
- Golden values for the `overall` phase will be `pending` until we can cross-check against rbsdm (which defines "overall" the same way).

---

## Summary

| # | Severity | Verdict | Finding |
|---|---|---|---|
| 1 | MEDIUM | ACCEPT | Install bundle analyzer + spike chart lib before committing to Recharts |
| 2 | MEDIUM | PARTIAL | Tier vs 32 always; surface K-denominator when not 32 |
| 3 | MEDIUM | ACCEPT | Single path-list source + switch to revalidateTag + drop URL query toggle |
| 4 | MEDIUM | ACCEPT | Split sparkline query (Pats-only) from trend query (w/ league median) |
| 5 | **HIGH** | ACCEPT | Denormalize per-game EPA into `games` during ETL (new beads task E3-15) |
| 6 | MEDIUM | ACCEPT | `getCurrentSeason()` uses `team_phase_weekly`, not season |
| 7 | MEDIUM | ACCEPT | Hero YoY handles `null` rank cleanly; em-dash + tooltip |
| 8 | LOW | ACCEPT | Rolling 4-week in SQL (window function); client just toggles arrays |
| 9 | LOW | REJECT (decision) | Keep GH-Actions curl; document secret-handling in runbook |
| 10 | MEDIUM | ACCEPT | Wrap numeric output in components that auto-emit `data-numeric` |
| 11 | MEDIUM | ACCEPT | `--negative` restricted to ≥24 px type + icons; deltas use `--text` |
| 12 | MEDIUM | ACCEPT | Rename `overall_offense` → `overall` + recompute as EPA differential (E3-16) |

**Plan delta:** 11 accepts (2 with partial), 1 decision-hold. Two new beads tasks to file:
- `E3-15: ETL denormalize per-game EPA into games table` (blocks E3-11 week-results strip)
- `E3-16: Redefine `overall` phase as team EPA differential per SPEC §3.2` (blocks E3-02 hero + E3-12 rank snapshot)

**Net new work:** ~3 hours mostly in ETL (E3-15 + E3-16), plus minor touch-ups across the Web DAL to match the new function shapes. Architectural direction unchanged.
