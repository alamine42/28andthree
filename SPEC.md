# 28 and Three — Spec

> An advanced analytics web app for New England Patriots fans. Name references the Super Bowl LI comeback (28-3 deficit overturned).

## 1. Vision & Audience

**Primary audience:** Hardcore analytics-literate Patriots fans who are comfortable with advanced metrics (EPA, CPOE, success rate, pressure rate) and want depth over hand-holding.

**Core promise:** Give Pats fans a single place to track how the team is progressing — week over week and season over season — across every phase of play, benchmarked against the rest of the NFL, plus Patriots-specific lenses (draft ROI, coaching tendencies) no generic NFL stats site provides.

**Not in scope (v1):** user accounts, paid tiers, live in-game updates, fantasy tools, betting/odds integration, PFF grades (licensing cost).

## 2. Data

### Sources
- **nflverse** (`nflfastR` / `nflreadr` via Python `nfl_data_py`): play-by-play, EPA, CPOE, rosters, schedules, participation data, next-gen stats where available. Primary backbone.
- **ESPN / NFL public APIs**: live schedules, injuries, game context, team/player metadata, headshots.

**Explicitly excluded:** PFF (paywalled, not legally scrapeable), Pro Football Reference scraping (ToS gray area).

### Scope of history
- **v1 launch:** 2020–2025 (6 seasons). Covers the post-Brady rebuild, the Mac Jones era, and the current regime — enough historical context to make §3.5 progression comparisons meaningful from day one.
- **Ongoing:** ingest weekly during the season; accumulate new seasons each year.
- Backfill earlier seasons (2015–2019) is a future option if deeper historical comparisons are needed.
- Schema designed to scale to multi-season from day one.

### Update cadence
- **Weekly refresh, Tuesday morning** (post-MNF). Matches `nflverse` release cadence.
- Triggered by **GitHub Actions cron**.
- Idempotent: re-running on the same week overwrites cleanly, never duplicates.

## 3. Core Features

### 3.1 Home / Season-long Team Overview
Landing page is the **season-long team dashboard**:
- Current record, point differential, SOS
- League rank card across all phases of play (see §3.2)
- 4-week rolling trend sparklines for each phase
- Week-by-week results strip with quick EPA differential per game
- Top performers this season (QB, skill, defense, OL/DL units)

### 3.2 Phases of Play — League-wide Percentile Rankings
The Pats are ranked **1–32 league-wide** on each phase, each week and season-to-date. The ranking metric is **EPA per play** in that phase (gold standard, single-number summary from nflfastR).

**Phases tracked (10+):**
1. Pass offense
2. Rush offense
3. Pass defense
4. Run defense
5. Special teams
6. Red zone offense
7. Red zone defense
8. 3rd down offense
9. 3rd down defense
10. Explosive play rate (offense)
11. Explosive play rate allowed (defense)
12. Overall (team EPA differential)

Each phase page shows:
- Current rank + EPA/play
- Weekly trend (rolling 4-week average; raw weeks available as a secondary toggle if easy)
- Distribution vs. league (where Pats sit on the curve)
- Top contributing players to that phase

### 3.3 Player Deep Dives
All four player view types are in scope:

**QB deep dive**
- EPA/play, CPOE, aDOT, air yards, pressure %, clean-pocket vs. pressured splits, success rate, deep-ball efficiency.

**Skill position usage & efficiency (RB/WR/TE)**
- Target share, route participation, YAC/reception, EPA/target, aDOT, red-zone usage, separation where NGS provides it.

**Defensive player impact** — v1 ships **unit-level only**
- Team/unit-level: pressure rate, coverage EPA allowed, run-stop rate, explosive plays allowed.
- **Individual defender ratings are deferred.** Computing per-player defensive value from nflverse alone is unreliable: participation data starts 2016 and is spotty, and without PFF grades (out of scope) or ESPN advanced defense data (limited public API), numbers would be misleading. Better to ship nothing than ship bad defensive player numbers.
- Revisit in v2 if a credible data source opens up.

**OL / DL unit metrics**
- Pass block win rate proxies, run block win rate, pressures allowed, ESPN win rates where available, aggregate EPA on designed runs / dropbacks by unit.

### 3.4 Pats-Specific Differentiators

**Draft Pick ROI Tracker**
- Scope: **last 5 Patriots drafts (2021–2025)**.
- For offensive picks: actual EPA contribution vs. expected production curve for that draft slot (historical slot-based baseline from nflverse).
- For defensive picks: **unit-level contribution + games played / snap share** instead of an individual-EPA proxy (see §3.3 defense caveat). Honest but less satisfying than offensive picks — call this out in the UI.
- Visualized as: hit / fair / miss per pick, with a class-year summary.

**Coaching Tendency Analysis (full strategic profile)**
- Play-calling splits by HC/OC: pass/run rate by down-distance-score-state, shotgun %, pre-snap motion %, play-action rate, tempo (seconds/snap), personnel groupings.
- 4th down aggressiveness: actual vs. model-recommended using **Ben Baldwin's `nfl4th` model** (wrap via `rpy2` or use an existing Python port; do not build our own).
- Blitz rate, man/zone proxy rates where data permits.
- Comparison view: current HC vs. league average and vs. predecessor(s).

### 3.5a Data-integrity rules (resolves §13 critical gaps)

These rules are part of the spec, not implementation details — the whole site's credibility depends on them.

**Rank tiebreaks (phase rankings, §3.2).** When two or more teams have identical EPA/play in a phase, break ties in this order:
1. More plays in that phase (larger sample = more reliable).
2. Higher success rate in that phase.
3. Team abbreviation alphabetical (deterministic final fallback).

Rule must be applied in the ETL aggregation query (not at render time) so ranks are stable across page loads and week-over-week trend lines don't flicker from tiebreaker noise.

**Empty / small-sample states (phase pages, §3.2).** Some phases have very few plays in a given week (e.g., special-teams EPA in a game with no punts or FGs). Rules:
- If plays-in-phase < **10** for a team in a week: show "—" and a small "n=X, insufficient sample" tooltip in place of the EPA number. Do not compute a rank for that team-week-phase.
- Rolling 4-week averages include only weeks where n ≥ 10.
- Season-to-date views always render once cumulative plays-in-phase ≥ 30.
- Never display `NaN`, `null`, or `0` when the correct answer is "not enough data."

**Mid-season personnel changes (QB §3.3, HC/OC §3.4).**
- **QB pages:** default view is "games as primary starter" (>50% of team dropbacks in that game). A secondary "all games played" toggle shows every appearance. Small-sample banner appears below 100 dropbacks season-to-date.
- **Coaching tendencies:** attribute tendencies to HC and OC by **date range**, not by season. When a coordinator changes mid-season, the page shows two segmented rows ("Weeks 1–6: Coordinator A", "Weeks 7–18: Coordinator B"). League-comparison baselines use full-season league averages in both segments.
- **Player team changes:** if a player changes teams mid-season, stats are attributed to the team they played for at the time of each play. Player page shows team-filtered splits. Draft ROI for a traded player still counts toward the drafting team's ROI (they made the pick).

### 3.5 Progression / Comparative Ranking
- Trend views default to **rolling 4-week average** to smooth game-to-game variance.
- Every phase and every headline player stat supports week-over-week and season-to-date comparisons.
- League context is always adjacent to Pats numbers (never show a raw number without rank or percentile).

## 4. Technical Architecture

### Stack
- **Frontend/API:** Next.js (App Router, TypeScript) on **Vercel**.
- **Database:** **Neon Postgres** (serverless, branching for ETL testing).
- **ETL:** Python, using `nfl_data_py` + `requests` for ESPN/NFL endpoints.
- **ETL runtime:** **GitHub Actions** scheduled workflow (weekly cron, Tuesday morning ET).
- **Charts:** **Recharts** (with Visx as escape hatch for anything Recharts can't handle cleanly — e.g., distribution plots).
- **Styling:** Tailwind CSS.

### Repository layout
```
/app                 Next.js app (routes, components, server actions)
/lib                 Shared TS: db client, query helpers, metric formatters
/etl                 Python ETL package
  /ingest            nflverse + ESPN pullers
  /transform         phase aggregations, percentile/rank computation, tendency metrics
  /load              SQL writers (idempotent upserts)
  /models            draft ROI expected-value curves, 4th down model wrapper
/db                  SQL migrations, seed, schema docs
/.github/workflows   weekly-etl.yml (cron)
```

### Data model (initial sketch — to be refined in migrations)
- `games` (game_id, season, week, opponent, home/away, result, pats_epa, opp_epa, …)
- `plays` — **all league PBP for every loaded season**, not just Pats games. Ranking the Pats 1-of-32 requires league aggregates; storing raw plays league-wide keeps the ETL simple and makes new phases/metrics a SQL query, not an ETL change. ~50K plays/season × 6 seasons ≈ 300K rows — negligible for Postgres; index on `(season, week, posteam, defteam)`.
- `team_phase_weekly` (team, season, week, phase, epa_per_play, success_rate, plays, rank, percentile)
- `team_phase_season` (team, season, phase, epa_per_play, …, rank)
- `players` (gsis_id, name, position, current_team, meta)
- `player_weekly` / `player_season` (per-player metric rollups)
- `draft_picks` (season, round, pick, player, slot_expected_value, actual_value, delta)
- `coaching_tendencies_weekly` (team, season, week, tendency metrics)
- `meta_refresh` (last_run_at, week, season, status, source_versions)

### ETL flow (weekly)
**Schedule:** Tuesday **10:00 AM ET** via GitHub Actions cron (after nflverse's typical 6–10am release window). If data isn't fresh yet, the job exits non-zero and retries at 14:00 and 18:00 ET.

1. **Freshness gate:** compare `max(game_id)` in nflverse against the week's completed schedule. If the latest completed game isn't yet in nflverse, exit non-zero (retry workflow will try again).
2. Pull latest `nflverse` PBP + rosters + schedules for current season.
3. Pull ESPN injuries / game meta for current week.
4. Compute league-wide aggregates (all 32 teams) for each phase — needed because Pats' rank requires the full league.
5. Compute player rollups (Pats + top-N league for comparison widgets).
6. Recompute draft ROI (`2021–2025` cohort) with updated expected-value curves.
7. Recompute coaching tendencies through latest week (including `nfl4th`-based 4th down aggressiveness).
8. Upsert into Neon in a single transaction; write row counts, duration, and `nflverse` release version to `meta_refresh`.
9. Trigger Vercel deploy hook on success (so ISR pages revalidate cleanly).
10. On failure: GH Actions sends workflow-failure email (built-in). On retries exhausted: send a more urgent alert.

### Rendering strategy
- Mostly **static / ISR**: pages revalidate after each weekly refresh via a deploy hook or on-demand revalidation.
- No client-side data fetching for core stats — query Postgres server-side, render server components.
- Interactive charts (toggles, tooltips) hydrated client-side on top of server-fetched data.

## 5. Design

**Vibe:** Modern data-dense — think FTN Fantasy, Sumer Sports, rbsdm.
- Dark mode default; light mode as a later nice-to-have.
- Monospace numerics for all tabular stats (tabular-nums).
- Tight tables, lots of sparklines, rank badges.
- Patriots colors used sparingly as accent (navy / red / silver), but brand is **28 and Three**, not official team marks.
- **No NFL or Patriots logos, wordmarks, or team uniform imagery** in branding/chrome. Player headshots from public endpoints are fine in content areas.

## 6. Legal / Branding

- Name: **28 and Three** (references the SB LI comeback; not a team trademark).
- Footer disclaimer on every page: *"28 and Three is an independent fan project. Not affiliated with, endorsed by, or sponsored by the New England Patriots, the NFL, or any of its teams."*
- Use only publicly available stats; attribute nflverse on an About page.
- Do not use NFL/Patriots logos or wordmarks in branding.
- Revisit trademark search (USPTO TESS) before any monetization or public launch with significant audience.

## 7. Milestones

**M1 — Skeleton (week 1)**
- Next.js + Neon wired up, Tailwind, base layout, dark theme, brand mark.
- GitHub Actions cron scaffolded, runs a no-op Python job writing to `meta_refresh`.

**M2 — Core ingest (weeks 2–3)**
- nflverse PBP ingest for 2025, league-wide phase aggregations (12 phases).
- `team_phase_weekly` and `team_phase_season` populated.
- Home page: team overview with rank cards + 4-week trend sparklines for all phases.

**M3 — Phase detail pages (week 4)**
- One page per phase with rank, trend, distribution, top contributors.

**M4 — Player deep dives (weeks 5–6)**
- QB page first (highest-leverage), then skill, defense, OL/DL.

**M5 — Pats differentiators (weeks 7–8)**
- Draft ROI tracker (2021–2025).
- Coaching tendency dashboard (full strategic profile).

**M6 — Polish (week 9)**
- Empty/loading states, mobile layout pass, About/methodology page, disclaimer footer, basic SEO/OG images.

## 8. Testing Strategy

For a data site, the real failure mode is shipping wrong numbers, not throwing exceptions. Test posture accordingly.

**Data contract tests (primary).** Run at the end of every ETL run; fail the workflow if any assert fails:
- All 32 teams present in `team_phase_weekly` for the loaded week.
- No NULL EPA values on completed games.
- Ranks for each phase sum to `1+2+…+32 = 528` (simple integrity check).
- Pats' weekly team EPA matches the season-to-date aggregate identity (weekly rollup consistent with season rollup).
- Known-value spot checks: e.g., Pats' Week 1 2025 total EPA matches a value computed independently from nflverse on a local dev run.
- nflverse release version logged in `meta_refresh` matches the latest public release.

**Smoke E2E (Playwright).** 3–5 tests covering:
- Home page renders with non-zero numbers.
- One phase detail page loads and shows all 32 teams in the distribution.
- QB deep dive loads with current starter's data.
- Draft ROI page loads with 5 class-years.
- 404 and empty-state behavior.

**No broad unit-test pyramid.** The bugs will be in the data, not in component render logic. Don't overbuild.

## 9. Observability

- **ETL failures:** GitHub Actions built-in workflow-failure email to repo owner. On retries exhausted (all three Tuesday attempts failed), a more urgent alert (PR-style issue auto-filed in the repo).
- **Runtime errors:** Sentry on Next.js (free tier). Wire for both server and client.
- **Refresh visibility:** `meta_refresh` table captures `last_run_at`, season/week, row counts per table, ETL duration, `nflverse` release version, and status. Expose at `/status` — a tiny public page so any visitor can see when data was last updated.
- **Site analytics:** Plausible or Vercel Analytics — decide at M6. Not critical for v1.

## 10. Open Questions (for later, not blocking v1)
- Light mode: needed for launch or post-launch?
- Backfill 2015–2019 if deeper historical comparisons are desired.
- Defensive individual metrics: revisit in v2 if a credible data source opens up.
- `rpy2` vs. pure-Python port for `nfl4th` — decide in M5 based on deployment ease in GH Actions.

## 10a. E11 addendum — historical season browsing (shipped)

Season-by-season browsing across the loaded window (2020..current).

- **URL contract:** `?season=YYYY` on season-scoped routes (`/`,
  `/phases/[slug]`, `/team/units/[unit]`, `/coaching`, `/players`,
  player deep-dives). Clean URL = current season. Invalid or
  out-of-range values fall back to current — never a 404.
- **Control:** SeasonSwitcher pill in the site header (menu of links);
  the param rides every nav link while a past season is in view;
  HistoricalMarker + "Back to current" on season-scoped pages.
- **Rendering:** middleware rewrites valid `?season=` requests to the
  internal static tree `/s/[season]/...` so clean URLs keep ISR and
  immutable historical pages cache for a day. External `/s` hits 308 to
  the public form. §3.5a data-integrity rules apply per rendered season.
- Authority: docs/plans/e11-historical-seasons-plan.md.

## 11. NOT in scope for v1

Explicitly deferred work, with one-line rationale:

- **PFF grades integration.** Paywalled; license cost not justified for v1.
- **Pro Football Reference scraping.** ToS gray area; nflverse covers the need.
- **Historical backfill (2015–2019).** 2020–2025 loaded at launch; earlier seasons can be backfilled later with the same ETL pipeline if deeper history is needed.
- **Individual defender ratings.** Data quality not good enough from free sources alone (§3.3).
- **User accounts, saved views, favorites.** Adds auth complexity; not essential for v1.
- **Paid tier / subscriptions.** Revisit only if there's demonstrated audience.
- **Live in-game updates.** Weekly refresh is the product promise.
- **Fantasy football tools.** Different audience; scope creep.
- **Betting / odds integration.** Different audience; compliance burden.
- **Mobile native apps.** Responsive web first.
- **Light mode.** Dark-first; revisit post-launch.
- **Custom 4th down model.** Wrap `nfl4th` (§3.4).
- **Full OpenTelemetry observability stack.** Overkill; §9 covers enough for v1.
- **Site-wide analytics dashboard.** Decide at M6.
- **AFC East / rivalry dashboards, dynasty-era comparisons.** Considered during spec interview; deferred to keep v1 scope tight.

## 12. What already exists (reuse, don't rebuild)

- **`nfl_data_py`** — primary Python library for nflverse access. Use directly; do not wrap.
- **`nflfastR` precomputed EPA, CPOE, WP, success columns** — already in the PBP. Do not recompute.
- **`nfl4th`** (Ben Baldwin) — wrap for 4th down recommendations instead of building our own.
- **ESPN public endpoints** — injuries, schedules, headshots.
- **Neon Postgres branching** — use for ETL dev/test branches, not a custom staging DB.
- **Vercel ISR + deploy hooks** — use for cache invalidation post-ETL; no custom cache layer.
- **GitHub Actions cron + retries** — native primitives cover the weekly refresh + retry story; no separate scheduler.

## 13. Failure modes (for review & test planning)

For each new codepath, one realistic production failure and whether we're covered:

| Codepath | Failure | Test? | Handled? | User sees? |
|---|---|---|---|---|
| Weekly ETL | nflverse release slips past 10am Tue | ✓ freshness gate + retry workflow | ✓ | `/status` shows stale timestamp |
| Weekly ETL | nflverse schema change (new/renamed column) | ✓ data contract tests | ✗ (will fail loudly, needs manual fix) | stale data until patched |
| Weekly ETL | Neon write partial-commit | ✓ single transaction; contract tests would catch row-count drift | ✓ | none (tx rollback) |
| Rank computation | Tie in EPA/play | ✓ contract test: rank sum = 528 + deterministic tiebreak | ✓ §3.5a rule | stable rank order |
| Phase page | Zero plays in a phase for a week | ✓ test: n<10 renders "—" not NaN | ✓ §3.5a rule (n≥10 threshold) | "insufficient sample" tooltip |
| QB page | Mid-season QB change | ✓ test: "primary starter" filter correctness | ✓ §3.5a rule (starter filter + small-sample banner) | filtered view + toggle |
| Draft ROI | Player traded mid-season | ✓ §3.5a rule: attributed to drafting team | ✓ | team-filtered splits on player page |
| Coaching tendencies | HC or OC change mid-season | ✓ test: segmented rows by date range | ✓ §3.5a rule | two rows with date ranges |
| 4th down model | `nfl4th` install fails in GH Actions (rpy2 is finicky) | ✓ CI run on merge | ✓ (can swap to Python port) | none |
| Sentry | Next.js server errors on cold start | ✗ | ✓ (Sentry captures) | error page |

**Critical gaps: all 3 resolved** via §3.5a rules. Data contract tests in §8 enforce them at ETL time.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 7 decisions resolved; 3 critical gaps resolved in §3.5a (tiebreak, empty-state thresholds, mid-season personnel rules); history depth upgraded to 2020–2025 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**UNRESOLVED:** 0
**CRITICAL GAPS:** 0 (all resolved in §3.5a)
**VERDICT:** ENG CLEARED. Design review recommended before frontend implementation (M3+). CEO review optional.

