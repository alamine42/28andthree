# E5: Pats Differentiators — Draft ROI + Coaching

**Status:** planned
**Owner:** alamine@gmail.com
**Beads epic:** `patsbythenumbers-nzw`
**Priority:** P1 (differentiating content — not launch-blocking per SPEC §3.5, but launch-shaping)
**Related:** SPEC §3.4, IMPLEMENTATION.md §6, DESIGN.md §Components, E4 plan (player DAL patterns)

---

## 1. Context

### 1.1 Problem
Through E4, the site answers *what* the team + each player is doing. E5 is the first sprint that answers *was this a good pick* (Draft ROI) and *how is this coach calling the game* (Coaching tendencies). Every other Patriots blog + board covers game-recap narrative; nobody has a durable, public-facing ROI tracker for the last five draft classes or a tendency dashboard that survives coordinator changes. E5 ships the content that makes the site worth bookmarking during the offseason.

### 1.2 Audience
- **Draft ROI** — the fan who argues about Mayo + Wolf's drafting on Twitter/Reddit/barstool and wants numbers for the argument. Mostly desktop.
- **Coaching** — the analytics-literate viewer who wants to see HC/OC tendencies splits without re-mixing ESPN fantasy data. Skims on mobile during games.

### 1.3 Definition of done
- **`/draft-roi`** lists the 2021–2025 Pats draft classes. Each pick renders as a row with: slot / player / position / actual value / slot-expected value / delta / **HIT / FAIR / MISS** grade. Grades are derived from a slot-EV curve fit against 2010–2024 league-wide draft outcomes.
- **`/coaching`** shows current-season HC + OC + DC tendencies: play-call mix (pass/run by down + distance bucket), shotgun / pre-snap motion / play-action rates, tempo (seconds-per-snap), blitz rate, personnel usage, and — if `nfl4th` is available — a 4th-down actual-vs-recommended scatter.
- **Coordinator-change segmentation** per SPEC §3.5a: when a coordinator changes mid-season, the page renders two adjacent segment rows ("Weeks 1–6: Coordinator A", "Weeks 7–18: Coordinator B"). Applies to HC, OC, DC.
- **`nfl4th` runs in the ETL, not at request time** (security / perf).
- **E2E**: `tests/e2e/e5.spec.ts` green — 5 class years render, Drake Maye's row shows HIT, `/coaching` renders current-season splits, coordinator-segment rows visible if fixture includes one.
- **A11y**: axe clean on `/draft-roi` + `/coaching`. No-bad-numbers crawler extended. Both pages under the 180KB gzip home-page budget.

### 1.4 Non-goals
- **Cross-team draft comparisons** ("how does Wolf compare to Howie Roseman?") — post-launch.
- **Historical coaching tendencies** (2024 HC splits, 2023 OC splits) — current-season only for E5; historical roll in E6/E7.
- **Individual-defender ratings** (still deferred to v2 per SPEC §3.3).
- **Predictive modeling** ("what would a league-average OC call here?") — the `nfl4th` 4th-down chart is the only model on the page.
- **Pro Football Focus–style grades** — we're not licensing PFF.

### 1.5 Decided defaults (flag if you want different)
Four open questions surfaced during planning. Plan proceeds on these defaults (revised after codex adversarial review):

1. **Hit/Fair/Miss threshold:** `actual_value / slot_expected_value` ratio.
   - **HIT** ≥ 1.25 (exceeded slot by 25%+)
   - **FAIR** ∈ [0.75, 1.25)
   - **MISS** < 0.75 (including injured-and-never-contributed)
   - **PENDING** — pick is ≤2 years old (rookie / sophomore season not finished); renders a neutral grey badge.
2. **Actual-value definition** — scoped to what the warehouse actually has (review findings #2, #3, #4, #7):
   - **QB**: season-summed EPA/dropback × dropbacks from `qb_weekly`. Already populated.
   - **RB / WR / TE / FB (skill positions)**: season-summed EPA attributable to the player. **Requires adding `epa_receiving` and `epa_rushing` columns to `skill_weekly`** (E5-04a schema bump; the ETL already computes these per play, we just weren't persisting them). Without the schema bump there's no signal here.
   - **OL / DL / LB / DB (trench + secondary)**: a **unit-proxy grade**, not per-play attribution. We don't have player-level participation for non-skill positions, so pretending we can attribute per-play EPA to a specific guard would ship misleading numbers. Instead: grade is a function of the team unit's tier during the player's active seasons. Formula below in §3.6.
   - **K / P / LS (ST)**: grade = **PENDING** indefinitely. No meaningful metric without deep-diving ST play-level data. Tooltip: "ST grades coming in v2."
   - **All grades** normalized to "value per active season."
3. **Coaching splits granularity:** kept tight. One table per split dimension; no full cross-product.
   - Pass/run mix: **down × distance-bucket** (short 0–3 / mid 4–7 / long 8+) → 4×3 = 12 cells.
   - Score-state splits: **leading 8+ / leading ≤7 / tied / trailing ≤7 / trailing 8+** → 5 rows.
   - Shotgun / play-action / motion / no-huddle rates: one four-row summary table.
   - Personnel: top 5 groupings by share.
   - 4th-down: scatter of **Pats attempts only**, with a pre-computed league-average reference line (review finding #8). No league dots — we don't store them.
4. **`nfl4th` fallback acceptable for launch:** if both rpy2 and the Python port fail in CI, we ship `/coaching` without the 4th-down scatter and render an inline "Model pending — check back" card. E5-08c is the feature-toggle that makes this reversible.

If any of these differ from intent, redirect before we spend build-it cycles.

---

## 2. UX scope

### 2.1 `/draft-roi` — desktop layout

```
┌──────────────────────────────────────────────────────────────────┐
│ DRAFT · 2021–2025                                                │
│                                                                  │
│ Mayo & Wolf, by the draft class.                                 │
│                                                                  │
│ Five classes, fifty-odd picks. Slot-expected value is the        │
│ curve fit against 2010–2024 league-wide outcomes at the same     │
│ slot. Actual value is EPA-weighted contribution to date,         │
│ normalized per career season.                                    │
│                                                                  │
│ ┌────┬──────────────┬─────┬──────────────────────────────────┐   │
│ │2025│ Drake Maye   │  3  │ QB   [HIT +42%]  actual +0.18 … │   │
│ │2025│ Caedan Wallace│ 68 │ OT   [PENDING]                  │   │
│ │2025│ …            │     │                                 │   │
│ ├────┼──────────────┼─────┼─────────────────────────────────┤   │
│ │2024│ Christian Gonzalez│ 17│ CB  [HIT +38%] actual -0.04 …│   │
│ │2024│ Keion White  │ 46  │ EDGE [FAIR  -8%]                │   │
│ │2024│ …                                                    │   │
│ ├────┼─────────────────────────────────────────────────────┤   │
│ │2023│ Drake Maye → see 2025 (trade out)                   │   │
│ │ …                                                        │   │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ [Class summary: 2025 · 3 HIT / 4 FAIR / 2 MISS]                 │
└──────────────────────────────────────────────────────────────────┘
```

- **One accordion-free table per class year**, stacked by year descending. No collapse — scrolling is fine for 50 rows total.
- **Slot column** is the overall pick number (not round.pick). Primary sort key within a class.
- **Grade badge** uses the hit-tier color from `lib/color/rank.ts` — HIT = `--positive` amber, MISS = `--negative` cranberry, FAIR + PENDING = `--text-muted`.
- **Actual / expected values** render in two narrow cells with em-dash when data is missing (injured rookie, cut before season).
- **Class summary footer** aggregates counts — the at-a-glance answer to "was 2023 a good class?"
- **Player name is a `<Link>`** to the player's deep-dive page when we have one (QB/RB/WR/TE). OL/DL/LB/DB link to the appropriate unit page (same routing as E7 Players Hub).

### 2.2 `/draft-roi` — mobile layout
- Collapse to a single stacked card per pick. Grade badge + name + actual/expected on one row; delta + position on a second line.
- Class headers sticky at the top of each section.

### 2.3 `/coaching` — desktop layout

```
┌──────────────────────────────────────────────────────────────────┐
│ 2025 SEASON · COACHING TENDENCIES                                │
│                                                                  │
│ Patriots coaching, the tendencies that decide games.             │
│                                                                  │
│ ┌─ WEEKS 1–18 · Mike Vrabel (HC)  ────────────────────────────┐  │
│ └─ WEEKS 1–6 · Josh McDaniels (OC) | WEEKS 7–18 · Alex Van Pelt (OC)    │
│                                                                  │
│ ─── Play-call mix (pass %) ──────────────────────────────────── │
│                                                                  │
│        1st-short  1st-mid  1st-long  2nd-short  2nd-mid  2nd-long│
│  Pass    42%       55%      70%        38%        48%      65%   │
│  League  45%       58%      72%        41%        50%      68%   │
│                                                                  │
│ ─── Situational splits ───────────────────────────────────────── │
│  Shotgun      64%   (league 62%)                                │
│  Play-action  26%   (league 24%)                                │
│  Pre-snap motion 38%   (league 42%)                             │
│  No-huddle     7%   (league 5%)                                  │
│                                                                  │
│ ─── 4th down aggressiveness ──────────────────────────────────── │
│  [ scatter:  go rate (y) vs. win-probability gain to go (x) ]   │
│  [ Pats dots highlighted; league dots in muted grey             │
│                                                                  │
│ ─── Personnel + tempo ────────────────────────────────────────── │
│  11 personnel   64%       Snaps/sec  27.2s                      │
│  12 personnel   18%       League     26.5s                      │
│  21 personnel   9%                                               │
│                                                                  │
│ ─── Blitz rate ───────────────────────────────────────────────── │
│  Weeks 1–6  (Coordinator A):  28%                                │
│  Weeks 7–18 (Coordinator B):  34%    (league 29%)                │
└──────────────────────────────────────────────────────────────────┘
```

- **Coordinator banner(s) at the top** — one per role. When HC/OC/DC changes mid-season, we render the segmented version ("WEEKS 1–6 … | WEEKS 7–18 …"). This applies per SPEC §3.5a.
- **Play-call mix table:** 2×6 grid (rows: Pats / league-avg; columns: down-distance bucket). Same mono/tabular treatment as phase rank tables.
- **Situational splits:** inline list with league baseline in parentheses, muted.
- **4th-down scatter:** one dot per Pats 4th-down decision (coords = model-predicted go rate × actual go = {0,1}). League dots in muted grey for context. Hovering a Pats dot shows week + situation. If `nfl4th` unavailable, the whole section is replaced with a "Model pending — check back" callout.
- **Personnel + tempo:** two small stats.
- **Blitz rate:** segmented if DC change occurred mid-season.

### 2.4 `/coaching` — mobile layout
- Play-call-mix table collapses: hide the "League" row behind a toggle (default visible), scroll horizontally only within the table (not the whole page).
- 4th-down scatter: min-height 280px so dots are tappable (≥44px hit area via padding).
- Blitz/personnel/tempo stack vertically as cards.

### 2.5 Copy voice
Per DESIGN.md §Content: terse, declarative, no exclamation points. Tooltips explain what a grade means on first hover.
- Eyebrow: `DRAFT · 2021–2025` / `2025 SEASON · COACHING TENDENCIES`.
- H1: `Mayo & Wolf, by the draft class.` / `Patriots coaching, the tendencies that decide games.`
- Grade badges: single word — `HIT`, `FAIR`, `MISS`, `PENDING`.
- Coordinator banner: `WEEKS X–Y · <Full Name> (HC|OC|DC)`.

---

## 3. Architecture decisions

### 3.1 Schema (new tables)

Four new tables. All migrations via `pnpm db:generate` → commit → migrate.

**`draft_picks`** — Pats picks, curated + derived.
```
gsis_id            text                              -- nullable (trade-out picks have no resulting player); FK when non-null. Review finding #5.
draft_season       smallint not null
round              smallint not null                 -- 1-7, or 8 = compensatory
pick_overall       smallint not null                 -- the slot, 1..257-ish
position           varchar(3)                        -- canonical nflverse code; NULL for trade-outs
traded_to          varchar(3)                        -- team abbreviation if the Pats traded the pick away
primary_keys: (draft_season, pick_overall)
```

**`draft_outcomes_historical`** — 2010–2024 all-team, for fitting the slot-EV curve.
```
draft_season       smallint not null  -- 2010..2024
pick_overall       smallint not null
gsis_id            text                -- nullable if we can't resolve
position           varchar(3)
career_epa         double precision    -- total EPA over career through 2025
career_seasons     smallint            -- seasons with ≥100 snaps
primary_keys: (draft_season, pick_overall)
```

**`draft_expected_value`** — the fitted curve, keyed by (slot, bucket). Six rows per slot.
```
pick_overall       smallint not null   -- 1..260
position_bucket    varchar(8) not null -- 'QB' | 'OFF_SKILL' | 'OL' | 'DL' | 'LB' | 'DB'  (ST excluded — review finding #7)
expected_value     double precision    -- smoothed per-season value at this slot, scaled per bucket
fit_version        smallint            -- bumped when we re-fit
primary_keys: (pick_overall, position_bucket)  -- review finding #1
```

Composite PK because the fit produces one curve per bucket; a slot has different expected-value depending on whether we're looking at QB slot-3 or OL slot-3.

**`coaching_tendencies_weekly`** — one row per (team, season, week, coach_role).
```
team               varchar(3) not null
season             smallint not null
week               smallint not null
coach_role         varchar(3) not null  -- 'HC' | 'OC' | 'DC'
coach_id           text                 -- stable id from nflreadpy; NULL if the feed doesn't expose one. Segmentation keys on this first (review finding #9).
coach_name         text not null        -- display string; fallback when coach_id is null (after normalization)
-- play-call mix flattened by down × distance-bucket (6 cols each)
pass_rate_1_short  double precision
pass_rate_1_mid    double precision
pass_rate_1_long   double precision
pass_rate_2_short  double precision
-- … 6 total down-distance cells
pass_rate_3_short  double precision
pass_rate_3_mid    double precision
pass_rate_3_long   double precision
-- situational rates
shotgun_rate       double precision
play_action_rate   double precision
motion_rate        double precision
no_huddle_rate     double precision
-- scores
score_leading_big_pass_rate    double precision
score_leading_small_pass_rate  double precision
score_tied_pass_rate           double precision
score_trailing_small_pass_rate double precision
score_trailing_big_pass_rate   double precision
-- tempo
seconds_per_snap   double precision
-- personnel
personnel_top_groups  jsonb     -- [{grouping: '11', share: 0.64}, {grouping: '12', share: 0.18}, ...]
-- defensive-side
blitz_rate         double precision  -- NULL for HC/OC rows
-- 4th down (if nfl4th available)
fourth_down_decisions  jsonb  -- [{pbp_id, wp_go, went_for_it, result}, ...]
primary_key: (team, season, week, coach_role)
```

That's a wide table (~25 numeric columns). All nullable. Wide + nullable is OK here because we read only what a given page view needs.

Coordinator-change segmentation is **computed at read time** from this weekly table — we scan the week range and split whenever `coach_name` changes. Not a stored artifact. See §3.5.

### 3.2 ETL: draft outcomes ingest (E5-02a)
Source: **`nflreadpy.load_draft_picks(seasons)`** — confirmed available. Returns one row per (season, pick_overall) with gsis_id, position, team.

**Cohort narrowed to 2015–2024** (review finding #6). Fitting on 2010–2014 with only 2020+ PBP biases toward long-career survivors — busted early-career picks look like zeros in the warehouse. 2015 onward means every career has meaningful 2020+ overlap.

Career value metric for the fit:
- **PBP-era picks (2015–2024)**: EPA from plays the player is attributable on (already in our warehouse for 2020–2025).
- **Pre-2020 careers that ended before we have PBP**: fall back to `career_seasons × games_played` from nflreadpy's roster history. Worse signal than EPA but survives the coverage gap. Stored in a `longevity_proxy` column so the fit can see both.

The fit consumes ~2,400 rows with non-null value (10 drafts × 257 picks × ~0.9 coverage), producing 6 × 260 = 1,560 rows in `draft_expected_value`.

### 3.3 ETL: slot-EV model fit (E5-02b)

**Fit approach: isotonic regression per position bucket, with a monotonicity-preserving smoother.** Not machine learning. Just: EV is non-increasing as pick number increases.

- Bucket the picks by position (7 buckets above).
- Within each bucket, compute the per-slot median `career_epa / career_seasons`.
- Smooth with a rolling-5 median so noise in individual slots gets ironed out.
- Clip to a monotone non-increasing envelope (pool-adjacent-violators).
- Emit 260 rows per bucket into `draft_expected_value`.

No Python ML libraries; `numpy` + `scipy.stats.isotonic_regression` suffice. **Contract test**: the fit must produce strictly non-increasing values within each bucket; slot 1 > slot 100 > slot 250.

### 3.4 ETL: Pats draft-pick seed (E5-03)
Seed from `nflreadpy.load_draft_picks((2021, 2022, 2023, 2024, 2025))` filtered to `team = 'NE'` (and picks the Pats owned-then-traded, which we mark with `traded_to`). Hand-curate the 5 or so trade-out cases by cross-referencing `team_at_pick` (nflreadpy includes that).

### 3.5 Coordinator-change segmentation (E5-09)
Implemented as a **DAL read helper**, not a new table. One function, one query:

```ts
// lib/data/coaching.ts
export type CoachSegment = {
  role: 'HC' | 'OC' | 'DC';
  coachId: string | null;
  coachName: string;
  weekStart: number;
  weekEnd: number;
  rollup: CoachingTendencyRollup;  // averaged over the segment
};

export async function getCoachSegments(
  team: string,
  season: number,
): Promise<CoachSegment[]>;
```

Algorithm:
1. Read all `coaching_tendencies_weekly` rows for (team, season) → up to 18 weeks × 3 roles = 54 rows.
2. Group by role, sort by week ascending.
3. Scan left-to-right; close + open a segment whenever `coach_id` changes. If `coach_id` is null for a row (feed didn't expose one), fall back to a **normalized** `coach_name` comparison: lowercase + whitespace collapse + ignore middle-initial punctuation. Review finding #9.
4. Compute the segment rollup (snap-weighted average of the numeric columns).
5. Return the array — typically 3 rows in a stable season, 4–5 rows when a coordinator flip happens.

Reading at query time keeps the storage model simple (one row per week always) and makes it trivial to re-run after an in-season change. Keying on `coach_id` avoids the "Alex Van Pelt" vs "Alex VanPelt" phantom-segment trap.

### 3.6 DAL shape + grading logic

```ts
// lib/data/draft.ts
export async function getDraftRoiByClass(season: number): Promise<DraftRoiRow[]>;
export async function getDraftClassSummary(season: number): Promise<{hit: number; fair: number; miss: number; pending: number}>;

// lib/data/coaching.ts
export async function getCoachSegments(team: string, season: number): Promise<CoachSegment[]>;
export async function getFourthDownDecisions(team: string, season: number): Promise<FourthDownDecision[]>;  // null-tolerant — returns [] if nfl4th disabled
export async function getLeagueFourthDownReferenceLine(season: number): Promise<ReferenceLinePoint[]>;  // pre-computed league go-rate by WP-boost bucket
```

**Grading branches by role** (review findings #2, #3, #4):

```ts
// lib/logic/draft-grade.ts
export function gradePick(pick: DraftPick): Grade {
  if (pick.draftSeason > currentSeason - 2) return 'PENDING';
  if (pick.positionBucket === 'ST') return 'PENDING';   // review finding #7
  if (pick.gsisId === null) return 'PENDING';           // trade-out
  const ratio = pick.actualValue / pick.expectedValue;
  if (ratio >= 1.25) return 'HIT';
  if (ratio < 0.75) return 'MISS';
  return 'FAIR';
}

// actualValue computed differently by role:
//   QB:           sum(qb_weekly.epa_per_dropback × dropbacks) over active seasons
//   skill:        sum(skill_weekly.epa_receiving + epa_rushing) over active seasons
//                 — requires adding these 2 columns to skill_weekly in E5-04a.
//   OL/DL/LB/DB:  unit-proxy = mean(team unit's league rank) over active seasons
//                 Lower-is-better rank inverted to 1..32 scale, normalized per slot.
//                 Review finding #4: no per-player attribution without participation data.
//   ST:           not computed; grade is PENDING.
```

The unit-proxy approach for trench/secondary picks is deliberately cruder than for skill positions. This is honest — we don't have participation data attributing OL plays to specific linemen, and pretending otherwise ships misleading grades. The UI labels these picks with a small "unit-proxy" badge on hover to disclose the methodology difference.

**Role routing for draft player links** — re-use `lib/format/player-routes.ts` `roleFor` + `playerHref` from E7. Consistent destination logic across the app.

### 3.7 `nfl4th` integration (E5-08a/b/c)
Three ordered tasks:

**E5-08a (spike, 90m)**: decide rpy2 vs. Python port. Document the decision in `docs/solutions/architecture/nfl4th-rpy2-vs-python-port-decision.md`. Evaluation criteria:
- Build: does it install in GH Actions with the current ubuntu-latest image?
- Maintenance: will rpy2 + R version drift break us in 6 months?
- Output parity: do both produce the same `go_boost` (WP delta if you go vs. kick)?

**E5-08b (integration, depends on 08a decision)**: wire the chosen path into the ETL. Add a transform that runs over the season's 4th-down plays and writes into `coaching_tendencies_weekly.fourth_down_decisions` as JSONB. Runs once per weekly ETL tick.

**E5-08c (feature toggle)**: a single env flag `DISABLE_NFL4TH=1` that (i) skips the ETL step and (ii) makes `getFourthDownDecisions` return `[]`. The UI already renders a "Model pending" callout when the array is empty — no page-level branching needed.

Security note: `nfl4th` runs **only** in the ETL GitHub Action, in a controlled Python environment. The website never loads R / rpy2 at request time. This is the launch-critical invariant.

### 3.8 Charts (components/charts/)

New primitives:
- **`ScatterPlot.tsx`** — used for 4th-down. Props: `data: {x, y, highlighted?: boolean, tooltip?: string}[]`. Renders an SVG scatter with Pats dots in accent + league dots muted. Keyboard-focusable legend.
- **`SegmentedBanner.tsx`** — renders the coordinator banner. One or two rows. Mono header, full name, week range.

Existing primitives reused:
- `TrendChart.tsx` (for any weekly trend on /coaching)
- `Sparkline.tsx` (for draft-class summaries)

### 3.9 Routes + ISR

New pages + revalidation paths:
- `app/draft-roi/page.tsx` — server component, `revalidate = 3600`
- `app/coaching/page.tsx` — server component, `revalidate = 3600`

Update `lib/revalidation/tags.ts`:
```ts
export const REVALIDATE_PATHS: readonly string[] = [
  '/',
  '/players',
  '/draft-roi',
  '/coaching',
  ...PHASES.map((p) => `/phases/${p}`),
];
```

Nav wiring: `components/SiteHeader.tsx` — update `Draft` → `/draft-roi`, `Coaching` → `/coaching`.

### 3.10 Methodology deep-links (E5-12)
Each non-obvious metric on `/draft-roi` and `/coaching` gets a small `(?)` icon next to its label. Hover / focus shows a concise definition. Clicking the icon routes to `/methodology#<slug>` (which will land in E6). For E5, the anchor links are stubs — they route to `/methodology` with a fragment but the methodology page doesn't exist yet; we render a 404-like fallback that says "Detailed methodology coming in E6."

### 3.11 Performance budget
- `/draft-roi`: ~50 rows × static HTML. Negligible JS client-side. <50KB gzip.
- `/coaching`: scatter plot adds ~8KB of dots. Still under the 180KB home budget.
- DAL reads: draft ROI = 2 queries (classes + summary). Coaching = 1 query + client-side segmentation = fast.

### 3.12 Security
- `nfl4th` never at request time (§3.7 invariant).
- All DAL inputs are route params (year for draft) or hardcoded (team = 'NE'). No user input.
- `players.gsis_id` is a controlled format (`00-XXXXXXX`), safe in DOM ids + hrefs.
- Rate limiting is a separate E6 task — both pages are safe for unlimited hits given ISR.

---

## 4. Tests

### 4.1 E2E — `tests/e2e/e5.spec.ts`
```ts
test.describe('E5 draft-roi + coaching', () => {
  test('draft_roi_renders_5_class_years', async ({ page }) => {
    await page.goto('/draft-roi');
    const sections = page.locator('[data-testid^="draft-class-"]');
    await expect.poll(async () => sections.count()).toBe(5);
  });

  test('drake_maye_row_shows_hit_badge', async ({ page }) => {
    await page.goto('/draft-roi');
    const maye = page.getByTestId('draft-pick-maye-2024');
    await expect(maye.getByText(/HIT/)).toBeVisible();
  });

  test('class_summary_shows_counts', async ({ page }) => {
    await page.goto('/draft-roi');
    const summary = page.locator('[data-testid^="draft-class-summary-"]').first();
    await expect(summary).toContainText(/\d+\s*HIT/);
  });

  test('coaching_renders_current_season_splits', async ({ page }) => {
    await page.goto('/coaching');
    await expect(page.getByTestId('play-call-mix-table')).toBeVisible();
    await expect(page.getByTestId('situational-splits')).toBeVisible();
  });

  test('coaching_renders_coordinator_banner', async ({ page }) => {
    await page.goto('/coaching');
    const banners = page.locator('[data-testid^="coach-segment-"]');
    // At least HC + OC + DC = 3; more if mid-season change.
    await expect.poll(async () => banners.count()).toBeGreaterThanOrEqual(3);
  });

  test('fourth_down_chart_or_model_pending_callout', async ({ page }) => {
    await page.goto('/coaching');
    const chart = page.getByTestId('fourth-down-scatter');
    const pending = page.getByTestId('fourth-down-pending');
    // Exactly one renders.
    const chartVisible = await chart.isVisible().catch(() => false);
    const pendingVisible = await pending.isVisible().catch(() => false);
    expect(chartVisible !== pendingVisible).toBe(true);
  });

  test('draft_roi_player_link_routes_to_correct_destination', async ({ page }) => {
    await page.goto('/draft-roi');
    await page.getByTestId('draft-pick-maye-2024').getByRole('link').click();
    await expect(page).toHaveURL(/\/players\/qb\/00-\d{7}/);
  });

  test('nav_draft_link_lands_on_draft_roi', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^Draft$/i }).first().click();
    await expect(page).toHaveURL(/\/draft-roi$/);
  });

  test('nav_coaching_link_lands_on_coaching', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^Coaching$/i }).first().click();
    await expect(page).toHaveURL(/\/coaching$/);
  });

  test('mobile_viewport_draft_roi_no_horizontal_scroll', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/draft-roi');
    await expect(page.locator('[data-testid^="draft-pick-"]').first()).toBeVisible();
  });
});
```

### 4.2 A11y + no-bad-numbers
- Add `/draft-roi` and `/coaching` to `tests/e2e/a11y.spec.ts` ROUTES.
- Add both to `tests/e2e/no-bad-numbers.spec.ts` ROUTES.
- The 4th-down scatter dots should carry `data-numeric="true"` on their tooltip payload (go-rate %, WP delta) to catch NaN.

### 4.3 Python contract tests (etl/tests/test_contracts.py)
Five new contracts, bringing the suite from 19 to 24:
- **#21**: `draft_expected_value` is strictly non-increasing within each position bucket (monotone-pooled curve).
- **#22**: every `coaching_tendencies_weekly` row has `coach_name` non-null and non-empty.
- **#23**: `(team, season, week, coach_role)` is unique in `coaching_tendencies_weekly`.
- **#24**: every `draft_picks` row with `gsis_id` non-null has a matching row in `players` (FK spot-check). Null gsis_id allowed (trade-out picks).
- **#25**: no `draft_expected_value` rows emitted for the `'ST'` bucket (scope exclusion per finding #7).

### 4.4 Unit tests
- `tests/unit/draft-grade.test.ts` — `grade(actual, expected, draftYear)` returns HIT/FAIR/MISS/PENDING per the boundaries.
- `tests/unit/coach-segments.test.ts` — segmentation algorithm on synthetic weekly data (stable season, mid-season flip, three flips, first-week-only).
- `tests/unit/draft-roi-rollup.test.ts` — snap-weighted class summary counts.

### 4.5 Fixture data
For E2E: we need at least one mid-season coordinator change in the fixture or the segmentation branch is untested. If 2025 doesn't have one, seed the test database with a synthetic 2025 OC change at week 10 — reversible in a teardown.

---

## 5. Task sequencing

```
E5-01 (schema) ──▶ E5-02a (historical ingest) ──▶ E5-02b (EV fit) ──┐
                                                                     ├──▶ E5-04a/b ──▶ E5-05
                   E5-03 (Pats seed) ─────────────────────────────── ┘
                                                                        │
                                                                        ▼
                                                                    E5-13 (E2E)
                                                                        ▲
                                                                        │
E5-06 (schema) ──▶ E5-07 (splits ETL) ──▶ E5-09 (coord segments) ──┐    │
                   E5-08a (spike) ──▶ E5-08b (integrate) ──▶ 08c ──┤    │
                                                                    ├──▶ E5-10a ──▶ 10b ──▶ 10c ─┘
                                                                        │
                                                                        ▼
                                                                    E5-12 (methodology stubs)
```

### 5.1 Estimates
| Task | Estimate |
|---|---|
| E5-01: Draft schema (3 tables) | 45m |
| E5-02a: Historical draft ingest | 90m |
| E5-02b: Slot-EV fit + contract | 90m |
| E5-03: Pats seed | 30m |
| E5-04a: Offensive ROI computation | 75m |
| E5-04b: Defensive ROI computation | 75m |
| E5-05: /draft-roi page | 2h |
| E5-06: coaching_tendencies_weekly schema | 30m |
| E5-07: Play-calling splits ETL | 2h |
| E5-08a: nfl4th spike | 90m |
| E5-08b: nfl4th integration | 2h |
| E5-08c: Fallback toggle | 30m |
| E5-09: Coordinator-segment DAL | 90m |
| E5-10a: /coaching shell + play-call | 2h |
| E5-10b: 4th-down scatter | 90m |
| E5-10c: Blitz/personnel/tempo | 90m |
| E5-12: Methodology stubs | 45m |
| E5-13: E2E | 2h |
| **Total** | **~22h** |

---

## 6. Simplicity review

What we're **not** doing:
1. **No ML model for draft value.** Isotonic regression + rolling median is enough. SPEC says "historical baseline," not "prediction model."
2. **No per-pick trade-value tracking** (Jimmy Johnson chart, etc.). One pick, one slot-EV, one grade.
3. **No YoY class-vs-class comparison ("is 2023 better than 2022?").** The class summary footer surfaces counts but we don't rank classes against each other.
4. **No per-coach career history.** Current season only. "Show me Vrabel's 2023 tendencies" is a post-launch feature.
5. **No custom 4th-down model.** If `nfl4th` doesn't work, we don't build a replacement — we ship without the chart. SPEC is explicit.
6. **No live game mode.** `/coaching` is a season-to-date dashboard. "How is Vrabel calling this game" during active kickoff is out of scope.
7. **One DAL read per page.** Draft ROI's two queries are fine — classes + summary — rather than joining them.

---

## 7. Adversarial review (codex)

Completed 2026-04-20. Full findings in [`e5-pats-differentiators-plan-adversarial-review.md`](./e5-pats-differentiators-plan-adversarial-review.md). 9 findings (4 HIGH / 5 MEDIUM); all adjudicated and folded into the plan above:

| # | Severity | Finding | Resolution | Section |
|---|---|---|---|---|
| 1 | HIGH | `draft_expected_value` PK too narrow for bucketed fit | Composite PK `(pick_overall, position_bucket)` | §3.1 |
| 2 | HIGH | `skill_weekly` has no EPA column for grading | Add `epa_receiving` + `epa_rushing` columns in E5-04a | §1.5, §3.6 |
| 3 | HIGH | Trench formulas call for data we don't have | Scope cut — unit-proxy grade, not per-play | §1.5, §3.6 |
| 4 | HIGH | Per-player unit attribution needs participation data | Same scope cut — grade the unit, not the individual | §3.6 |
| 5 | MED | `draft_picks.gsis_id NOT NULL` blocks trade-outs | Made nullable | §3.1 |
| 6 | MED | 2010–2024 fit biased toward survivors with only 2020+ PBP | Narrow fit cohort to 2015–2024; blend in longevity proxy | §3.2 |
| 7 | MED | ST bucket has no value metric | Drop ST from grading; render PENDING | §1.5, §3.1 |
| 8 | MED | 4th-down scatter promises league dots we don't store | Drop league dots; use pre-computed league reference line | §1.5 |
| 9 | MED | Coach segmentation on raw name drifts on spelling variants | Add `coach_id` column; fall back to normalized name | §3.1, §3.5 |

---

## 8. Task set (beads)

| ID | Task | Pri | Est | Blocks on |
|---|---|---|---|---|
| `nzw.1` | E5-01: Draft schema | P2 | 45m | — |
| `nzw.2` | E5-02a: Historical draft ingest | P2 | 90m | nzw.1 |
| `nzw.3` | E5-02b: Slot-EV fit | P2 | 90m | nzw.2 |
| `nzw.4` | E5-03: Pats draft seed | P2 | 30m | nzw.1 |
| `nzw.5` | E5-04a: Offensive ROI computation | P2 | 75m | nzw.3, nzw.4 |
| `nzw.6` | E5-04b: Defensive ROI computation | P2 | 75m | nzw.3, nzw.4 |
| `nzw.7` | E5-05: /draft-roi page | P2 | 2h | nzw.5, nzw.6 |
| `nzw.8` | E5-06: coaching schema | P2 | 30m | — |
| `nzw.9` | E5-07: Play-calling splits ETL | P2 | 2h | nzw.8 |
| `nzw.10` | E5-08a: nfl4th spike | P1 | 90m | — |
| `nzw.11` | E5-08b: nfl4th integration | P2 | 2h | nzw.10 |
| `nzw.12` | E5-08c: nfl4th fallback toggle | P2 | 30m | nzw.11 |
| `nzw.13` | E5-09: Coordinator-segment DAL | P2 | 90m | nzw.9 |
| `nzw.14` | E5-10a: /coaching shell | P2 | 2h | nzw.13 |
| `nzw.15` | E5-10b: 4th-down scatter | P2 | 90m | nzw.12, nzw.14 |
| `nzw.16` | E5-10c: Blitz/personnel/tempo | P2 | 90m | nzw.14 |
| `nzw.17` | E5-12: Methodology stubs | P2 | 45m | nzw.7, nzw.16 |
| `nzw.18` | E5-13: E5 E2E | P2 | 2h | nzw.7, nzw.15, nzw.16 |

Epic: `patsbythenumbers-nzw` (P1, open, 0/18 children complete).

---

## 9. Open risks

1. **`nfl4th` install hell.** rpy2 is brittle in CI; Python ports drift from upstream. Mitigation: E5-08a spike de-risks day one. Fallback (08c) means we ship `/coaching` without the 4th-down chart if both fail — acceptable per §1.5.
2. **Unit-proxy grade for OL/DL/LB/DB is crude.** Every trench/secondary pick on a given team inherits the same unit-tier trajectory regardless of how much they actually played (review finding #4). This is an honest cruder-signal; the UI discloses it with a "unit-proxy" badge. Post-launch task: ingest participation data coverage for pre-2016 seasons and upgrade.
3. **Draft career-value gaps for 2015 cohort.** Picks drafted 2015 who played 2015–2019 have no PBP — their grade relies on the longevity-proxy fallback. Mitigation: publish sample size per slot in the methodology doc; flag slots with <5 data points as "low-confidence EV" on the page.
4. **Drake Maye = HIT is the marketing hook.** If the slot-EV fit somehow grades him FAIR, the page reads as contrarian. Mitigation: E5-04a unit test explicitly asserts Maye is HIT given his 2024+2025 EPA; if the fit produces FAIR, revisit grade thresholds before publishing.
5. **`coach_id` may not exist in `nflreadpy`.** Review finding #9's cleanest fix assumes stable coach IDs from the feed. If nflreadpy only exposes names, we fall back to normalized-name comparison — tested in unit tests but inherently fragile. Document the limitation if it bites.
6. **Personnel-grouping column overflow.** E4 already hit the 16-char limit on `personnel_offense`; current column is 96 chars. Risk: nflverse emits a longer string in some future season and we silently truncate. Mitigation: extend to 128 chars in E5-06 migration (now, while we're touching the schema).

---

## 10. Exit criteria

**Automated:**
- `pnpm test` green (unit suite including the 3 new unit tests).
- `cd etl && uv run pytest` green — 22 contracts pass.
- `pnpm test:e2e --grep e5` green on chromium + Pixel 5.
- `@axe-core/playwright` green on both new routes.
- `pnpm build` completes; `/draft-roi` and `/coaching` appear in the build manifest.

**Operator-verified:**
- Click *Draft* in nav → land on `/draft-roi`; Maye row shows HIT.
- Click *Coaching* in nav → land on `/coaching`; 4th-down scatter visible OR "Model pending" callout shown.
- Coordinator segmentation banner for at least HC + OC + DC visible.
- Methodology links land on `/methodology#<slug>` (404 body acceptable; E6 builds the real page).
- Typecheck clean, lint clean.
