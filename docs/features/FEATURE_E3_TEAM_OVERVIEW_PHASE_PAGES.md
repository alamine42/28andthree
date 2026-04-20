# Feature: E3 — Team Overview + Phase Pages

**Epic ID:** `patsbythenumbers-xxs`
**Date:** 2026-04-19 (planning + build + review all in one day)
**Author:** Mehdi El-Amine + Claude Opus 4.7

## Summary

First user-facing data sprint. Home page renders the Patriots' season-long
overview (hero stats, 12-phase rank grid with sparklines, last-6-games strip)
and every `/phases/[slug]` route ships the matching detail page (rank card,
weekly trend chart with rolling/raw toggle, 32-team distribution plot).
Reads the ~295k plays + 38k team-phase rollups E2 loaded into Neon. No
charts library — hand-rolled SVG beats a 139 KB Recharts bolt-on.

## Context & Motivation

### Problem Statement

E1 shipped a substrate. E2 loaded 2020–2025 league PBP and aggregated 12
phases. Until Sprint 3, nothing was visible to anyone. E3 is the moment a
Patriots fan can open 28andthree.com, see a number, and form an opinion.

### User Story

As an analytics-literate Patriots fan on desktop, I want to land on a page
and see — at a glance — where New England ranks across every phase of play
relative to the 31 other NFL teams, so I can spot which part of the game
is alarming and click through to a detail view that shows the full season
trend + distribution without marketing fluff.

### Prior Art

- **Internal**: E1 Foundation (app shell + Neon + Sentry), E2 Data Ingest
  (the rollups we query). Placeholder `/` was "Season starts soon."
- **External references** in DESIGN.md: rbsdm.com (chart-legibility gold
  standard), sumersports.com (premium dark aesthetic), FTN Fantasy
  (tabular density).

## Architecture & Design

### High-Level Design

```
       ┌───────────────────────────────────────┐
       │ Neon Postgres (prod, E2-loaded)       │
       │   games (1,693 rows)                  │
       │   plays (294,989 rows)                │
       │   team_phase_weekly (38,634 rows)     │
       │   team_phase_season (2,304 rows)      │
       └──────────────┬────────────────────────┘
                      │ Drizzle (typed, parameterized)
                      ▼
       ┌───────────────────────────────────────┐
       │ lib/data/*  DAL — 8 typed queries     │
       │  getCurrentSeason()                   │
       │  getTeamSeasonOverview()              │
       │  getPhaseRankSnapshot() ← LAG delta   │
       │  getPatsPhaseSparklines()             │
       │  getRecentGames()                     │
       │  getPhaseDetail()                     │
       │  getPhaseWeeklyTrend() ← window fn    │
       │  getLeagueDistribution()              │
       └──────────────┬────────────────────────┘
                      │ React Server Components
                      ▼
       ┌───────────────────────────────────────┐
       │ Next.js 16 App Router                 │
       │   /  (Static, revalidate 3600s)       │
       │   /phases/[slug]  (SSG × 12 + ISR)    │
       │   /api/revalidate  (edge, POST)       │
       └──────────────┬────────────────────────┘
                      │ Plain SVG charts
                      ▼
                browser / crawler
```

### Key Components

| Component | Location | Purpose |
|---|---|---|
| Home page | `app/page.tsx` | Hero stats + phase grid + last-6 strip |
| Phase detail | `app/phases/[slug]/page.tsx` | Rank card + trend + distribution + placeholder |
| Revalidate webhook | `app/api/revalidate/route.ts` | Token-authed POST that flushes ISR paths after ETL |
| DAL — team | `lib/data/team.ts` | `getTeamSeasonOverview`, `getRecentGames` |
| DAL — phases | `lib/data/phases.ts` | `getPhaseRankSnapshot` (LAG delta), `getPatsPhaseSparklines`, `getPhaseDetail`, `getPhaseWeeklyTrend` (raw + rolling4 + median), `getLeagueDistribution` |
| DAL — season | `lib/data/current-season.ts` | `getCurrentSeason` (sourced from `team_phase_weekly` so it flips on first new-season ETL run) |
| `rankTier` | `lib/color/rank.ts` | rank → positive/neutral/negative, fixed to 32-team scale |
| Number formatters | `lib/format/number.ts` | `formatEpa`/`formatRank`/`formatDelta`/`formatPercent`/`formatSignedInt` — single place where null/NaN/Infinity collapse to em-dash |
| Phase display names | `lib/format/phase.ts` | slug → "Pass offense" etc. |
| Numeric wrappers | `components/numeric.tsx` | `<RankNumber>/<MetricValue>/<Delta>` — auto-emit `data-numeric="true"` |
| Charts | `components/charts/*.tsx` | Hand-rolled SVG: Sparkline, TrendChart, DistributionPlot |
| Hero | `components/HeroStats.tsx` | 3-cell hairline grid: overall rank + delta, record + point diff, EPA/play |
| Grid + card | `components/PhaseGrid.tsx` + `PhaseCard.tsx` | 12-card 4×3 (desktop) / 2×6 (tablet) / 1×12 (mobile) |
| Strip | `components/WeekResultsStrip.tsx` | Last 6 REG games with W/L, score, EPA differential |
| Revalidation tags | `lib/revalidation/tags.ts` | `REVALIDATE_PATHS` single source — workflow + API both consume |

### Data Model Changes

- **`overall_offense` phase → `overall`** (migration `0004`). The old value
  computed offensive EPA/play grouped by `posteam`. The SPEC §3.2 #12 phase
  is *team EPA differential* (off − def). ETL transform updated
  (`etl/transform/phases.py` gains `metric='differential'` kind).
- **`games.posteam_epa` + `defteam_epa` → `home_offense_epa_per_play` +
  `away_offense_epa_per_play`** (migration `0005`). Renamed for clarity;
  populated per-team during ETL via `etl/transform/games_epa.py`. Feeds
  the home-page Last-6-Games strip's EPA differential per cell.
- Contract test #15 added: every completed REG game has both
  offense-EPA columns non-null.

### API Changes

- **`POST /api/revalidate`** (new). Constant-time auth via
  `crypto.timingSafeEqual`. Accepts `{ paths: string[] }` filtered through
  the `REVALIDATABLE_PATHS` allowlist. Empty array → revalidate everything.
- No changes to `/status` or `/status/data`.

## Implementation Details

### Files Changed (net +1,900 lines across 35 files)

Highlights:
- `db/schema.ts` — 2 column renames, `phase_enum` value rename
- `drizzle/0004*.sql` + `0005*.sql` — applied to prod
- `etl/transform/phases.py` — `MetricKind` gains `differential`; FULL OUTER
  JOIN CTE for EPA differential; shared `_insert_tail()` prevents drift
  between single-side and differential paths
- `etl/transform/games_epa.py` — new; UPDATE games with AVG(epa) per team
- `etl/tests/test_contracts.py` — +1 contract (#15); existing rename-aware
- `golden_values.yml` — `overall` ranks anchored (2020–2025: 22/4/9/27/27/2)
- `app/page.tsx` + `app/phases/[slug]/page.tsx` — new home + detail
- `app/api/revalidate/route.ts` — new
- `components/*.tsx` — 10 new files
- `lib/data/*.ts` — 3 new DAL modules
- `lib/format/*.ts` + `lib/color/rank.ts` + `lib/revalidation/tags.ts`
- `tests/e2e/e3.spec.ts` + `no-bad-numbers.spec.ts` + `a11y.spec.ts` — new
- `tests/unit/rank-tier.test.ts` + `format-number.test.ts` +
  `format-phase.test.ts` + `sparkline-path.test.ts` +
  `numeric-components.test.tsx` — new

### Key Decisions

1. **Hand-rolled SVG > Recharts.** Bundle spike measured Recharts at 104 KB
   gzip on top of a 139 KB framework baseline — blew the 180 KB home
   budget. 120 lines of SVG for Sparkline + TrendChart + DistributionPlot
   owns every pixel.
2. **Rank tier fixed to 32 (not dynamic K).** Post-adversarial-review
   finding: a fan seeing "rank 10" should read positive whether 32 or 28
   teams qualified that week. When K<32, a small caption surfaces the
   denominator separately.
3. **Rolling 4-week in SQL, not client.** Window function in
   `getPhaseWeeklyTrend` precomputes both `raw` and `rolling4` series with
   insufficient-sample weeks excluded. Client toggle just swaps arrays.
4. **Toggle state in React state, not URL.** Skipped `?view=raw` to avoid
   ISR query-string cache splits. Loses linkability of a specific view;
   accepted trade.
5. **Numeric wrappers with auto-emitted `data-numeric`.** Bad-number
   crawler needs a reliable hook to find every rendered metric; baking it
   into `<RankNumber>`/`<MetricValue>`/`<Delta>` means new code can't
   forget the attribute.
6. **Rank delta computed as `prev - last`.** SQL math would naturally
   express rank improvement as negative; UI expects positive. Converted at
   the DAL boundary so React components never see the sign-flipped value.
   See `docs/solutions/gotchas/rank-delta-sign-semantics.md`.
7. **On-demand revalidation via `revalidatePath`, not tags.** Simple path
   allowlist is enough since toggle state isn't in the URL and the path
   set is small (13).

### Tradeoffs Considered

| Decision | Alt | Chosen | Why |
|---|---|---|---|
| Charting | Recharts / Tremor / hand-rolled SVG | Hand-rolled SVG | Bundle size (see Key Decisions #1) |
| Rank tier | Dynamic K / Fixed 32 | Fixed 32 | Stable user intuition across weeks |
| Rolling avg | Client / SQL | SQL (window fn) | Single source of truth for sample-skip rule |
| Toggle state | URL param / React state | React state | Avoids ISR cache-variant split |
| Revalidation | `revalidateTag` / `revalidatePath` | `revalidatePath` | Small path set; no tag infra needed |
| `overall` phase | Rename → differential / Keep + new name | Rename | Align enum with SPEC §3.2 #12 |

## Testing

### Test Coverage

- **Node unit (94 tests)**: rank tier (9), format helpers (20), phase
  slugs (6), sparkline path (7), numeric components (12), plus existing
  constants/env/db tests.
- **Python unit (61 tests)**: constants, ingest normalization, freshness
  gate, models, schema drift.
- **Python integration (9 tests)**: aggregation SQL against local
  Postgres (rank contiguity, tiebreak chain, idempotency, kneel exclusion,
  K-threshold denominator).
- **Python contract (15 tests)**: run after every ETL. All green on prod
  after the 2x re-run today.
- **Playwright E2E** (3 spec files):
  - `e3.spec.ts` — home + phase detail navigation + toggle + 404
  - `no-bad-numbers.spec.ts` — crawls 14 routes, asserts no NaN/null/0.0
    in any `data-numeric` element
  - `a11y.spec.ts` — axe-core WCAG 2.1 AA, 0 serious/critical on / +
    /phases/pass_offense

### Manual Testing Steps

Executed during this session:
1. ✅ Applied migrations 0004 + 0005 to prod Neon
2. ✅ Re-ran full backfill 2020–2025 (completed in 25s, contract tests
   green)
3. ✅ Sniff-checked Pats ranks (2025 overall 2 Maye; 2023 overall 27 Mac
   Jones collapse; 2020 rush 4 Cam Newton)
4. ✅ `pnpm start` → home renders with 12 phase cards, hero stats, last-6
   strip; `/phases/pass_offense` → rank card, trend, distribution; toggle
   flips between rolling/raw; `/phases/nonsense` → 404
5. ✅ Axe scan 2/2 pass after contrast fixes

## Security Considerations

- **`/api/revalidate`** uses `crypto.timingSafeEqual` for constant-time
  token comparison. Path allowlist filters the input — a leaked token
  can't trigger arbitrary-path revalidation (cache-bust DoS surface is
  bounded to the 13 known routes).
- All DAL queries parameterized via Drizzle; no string concatenation with
  user input. Slug validated by `isValidPhase` (allowlist membership
  check) before any DAL call.
- No new secrets introduced; `REVALIDATE_TOKEN` follows the same rotation
  pattern as `STATUS_ADMIN_TOKEN` (see `docs/runbook.md#status-data-auth`).
- `generateStaticParams` uses `PHASES` only — no user input reaches the
  build-time path generator.
- Security headers unchanged; `/api/revalidate` inherits them from
  `next.config.ts`.

## Future Improvements

- [ ] **Top contributors (E4).** Phase detail has a placeholder card;
  fills in with QB + skill + unit top-3 when E4 lands player rollups.
- [ ] **Mobile polish (E6-05a).** E3 ships basic 375px usability
  (no horizontal scroll, 44px touch targets on cards). A11y audit on
  mobile viewport is deferred.
- [ ] **Distribution tooltip on phase detail is text-only.** Could add a
  richer hover card with team logo-free name + rank + EPA. Deferred —
  current tooltip is via native SVG `<title>`, works for screen readers
  too.
- [ ] **Promote golden values from `source=self` to `source=rbsdm`** for
  stronger source-drift detection. ~15 min of manual cross-checking.
- [ ] **Lighthouse CI budgets enforced.** Config exists, transition to
  enforcing deferred per plan §3.6 until a stable baseline is visible.
- [ ] **2026 season transition validation.** The eyebrow heuristic
  (`plays >= 100` → "FINAL") and `getCurrentSeason` (sources from weekly
  table) handle the rollover in theory; first real proof is Week 1 2026
  (Sept 2026).

## Related

- **Beads epic:** `patsbythenumbers-xxs` (14/14 closed)
- **Plans:** `docs/plans/e3-team-overview-plan.md` (v2, post-codex) +
  adversarial-review
- **KB gotcha:** `docs/solutions/gotchas/rank-delta-sign-semantics.md`
  (delta-sign inversion caught + fixed during /fullreview)
- **Predecessor features:**
  `docs/features/FEATURE_E2_DATA_INGEST_AND_LEAGUE_AGGREGATES.md`
- **Spec anchors:** SPEC.md §3.1 (home), §3.2 (phases), §3.5 (trend),
  §3.5a (data integrity rules)
- **Design anchors:** DESIGN.md (full system)
- **Phase filter contract:** `docs/phase-definitions.md`
- **Runbook:** `docs/runbook.md#etl-rollback`, `#etl-failure`,
  `#status-data-auth`
