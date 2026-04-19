# E3 — Team Overview + Phase Pages: Plan

**Status:** Draft v2 · 2026-04-19 (post-codex-adversarial-review — see `e3-team-overview-plan-adversarial-review.md`)
**Scope:** Sprint 3 (weeks 5–6). 12 existing + 2 new tasks in beads under epic `patsbythenumbers-xxs`.
**Source-of-truth:** `SPEC.md` §3.1, §3.2, §3.5, §3.5a · `DESIGN.md` (full system) · `IMPLEMENTATION.md` §4 · `docs/phase-definitions.md` (phase filter contract, from E2)

---

## 1. Context — what problem Sprint 3 solves, and for whom

E1 shipped a substrate. E2 loaded 295k plays into Neon and aggregated them into 38k weekly + 2.3k season-long phase rollups across 6 seasons. **Sprint 3 is the first time a Patriots fan opens 28andthree.com and sees a number.**

Users this sprint: **an analytics-literate Patriots fan, on desktop**. They land on `/`, see the team's current-season rank across 12 phases at a glance, spot which phase is alarming (bottom-third amber = negative), click into it, see the full 2025 weekly trend, see where the Pats sit vs. the other 31 teams on a distribution plot, and leave either reassured or provoked. No accounts. No settings. No customization. Pure instrument — **"the site loaded, I got information I couldn't easily get elsewhere."**

**Done** when:
- `/` renders the season-long team overview with real 2025 data: hero stat (team EPA + rank + delta), 12-phase rank grid with sparklines, week-by-week results strip, rank-snapshot card.
- `/phases/[slug]` renders for every allowlisted slug with current rank, weekly trend (4-week rolling default + raw toggle), 32-team league distribution, and an honest placeholder for top contributors (E4 fills in).
- §3.5a rules honored everywhere: `n<10` weekly / `n<30` season → em-dash with `insufficient sample` tooltip. No `NaN`/`null`/`0.0` ever leaks to the DOM.
- Lighthouse CI flips from info-only to enforcing on home + one phase page (perf ≥ 90, a11y ≥ 95).
- Bad-number crawler E2E (`tests/e2e/no-bad-numbers.spec.ts`) passes against a prod-build preview.
- Home LCP < 2s, phase detail LCP < 2.2s, total JS for home < 180 KB gzip.
- ETL's successful run pokes an on-demand revalidation URL; home + phase pages pick up new data on the next request.

**Context note.** 2026-04-19: the 2025 NFL season is fully complete (SB LX ended Feb 2026). The home page shows 2025 season-final numbers. When the 2026 season starts (~Sept), `getCurrentSeason()` flips to 2026 and `/` shows live in-progress data.

---

## 2. UX scope for Sprint 3

### 2.1 Home page `/` — season-long team dashboard

**Structure (top to bottom):**

```
┌───────────────────────────────────────────────────────────────┐
│ SiteHeader                                                    │
│                                                               │
│ Eyebrow: "2025 SEASON · FINAL"                                │
│ H1:      "New England, end of season."   ← Cabinet Grotesk   │
│                                                               │
│ Hero stat grid (3 cells, hairline-divided):                  │
│   OVERALL RANK     RECORD         EPA/PLAY                   │
│   ┌────────┐       ┌────────┐     ┌────────┐                 │
│   │  04    │       │  11-6  │     │  +0.08 │                 │
│   │ ▲ from 12 │    │  +87   │     │ ▲ 0.02  │                │
│   └────────┘       └────────┘     └────────┘                 │
│                                                               │
│ Section: "League rank across phases"                         │
│ 12-card grid (4 × 3 desktop, 2 × 6 tablet, 1 × 12 mobile):   │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│   │ PASS OFFENSE│  │ RUSH OFFENSE│  │   OVERALL   │          │
│   │     01      │  │     14      │  │     04      │          │
│   │ ∼∼∼∼∼∼∼∼    │  │ ∼∼∼∼∼∼∼∼    │  │ ∼∼∼∼∼∼∼∼    │          │
│   │ +0.30 EPA   │  │ +0.00 EPA   │  │ +0.16 EPA   │          │
│   └─────────────┘  └─────────────┘  └─────────────┘         │
│   (rank-colored: top third amber, middle bone, bottom cranberry)│
│                                                               │
│ Section: "Last 6 games"                                      │
│ 6-cell strip (right-to-left chronology, most recent leftmost):│
│   ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐                                   │
│   │W │ │L │ │W │ │W │ │L │ │W │    score + EPA diff in each │
│   └──┘└──┘└──┘└──┘└──┘└──┘                                   │
│                                                               │
│ SiteFooter                                                   │
└───────────────────────────────────────────────────────────────┘
```

**Interaction:**
- Each phase card is `<a href="/phases/[slug]">`. Hover: `--surface` bg fill, 150ms. No other entrance animations (DESIGN.md §Motion).
- Hero stat deltas: `▲`/`▼` glyphs, amber/cranberry by sign. Year-over-year delta (rank vs. end of 2024 season).
- Week-results cells: hover reveals game details (opponent, score, date).
- No toggles, no filters — this is a landing, not a tool.

**Responsive:**
- ≥1024px: 4 × 3 grid, 3-cell hero, 6-cell strip, 1240px max width.
- 640–1023px: 2 × 6 grid, hero cells wrap to 2+1, strip stays 6 but scrollable.
- <640px: 1 × 12 grid (stacked rank cards), hero stacks vertically, strip horizontally scrolls.

Full mobile polish defers to **E6-05a**. E3 ensures basic usability at 375px (no horizontal scroll on home body, 44px touch targets on phase cards, hero text legibility).

### 2.2 Phase detail page `/phases/[slug]`

**Structure:**

```
┌───────────────────────────────────────────────────────────────┐
│ Breadcrumb: ← Season overview / Phases / Pass offense        │
│                                                               │
│ H1: "Pass offense"                                           │
│ Kicker: "EPA per dropback, regular season 2025"              │
│                                                               │
│ Big rank card (full-width hairline group, 3 cells):          │
│   RANK          EPA/PLAY          SUCCESS RATE               │
│   01            +0.30             55%                         │
│                                                               │
│ Section: "Weekly trend"                                      │
│ Trend chart (desktop ~720px tall or ~400 on mobile):         │
│   ─── Pats (amber)         ─── League median (muted)         │
│   [18-week timeline, rolling 4-week default, toggle to raw]  │
│                                                               │
│ Section: "League distribution"                               │
│ Horizontal dot plot of all 32 teams:                         │
│   ░░░░░░░░░●░░░░░░░░░░░░░░░░░░░░░░░░░        ← each dot = 1 │
│   BUF    NE       ...         ...   DAL     team (hover)     │
│   EPA axis: +0.5                   -0.5                      │
│   Pats dot: amber (--positive), enlarged, labeled "NE"        │
│                                                               │
│ Section: "Top contributors"                                  │
│ Placeholder card: "Requires player aggregates. Coming in     │
│ Sprint 4 with QB, skill, and unit deep dives."               │
│                                                               │
│ SiteFooter                                                   │
└───────────────────────────────────────────────────────────────┘
```

**Interaction:**
- Trend chart toggle (ghost button, top-right of the chart): switches between "Rolling 4-week avg" (default) and "Raw weekly." Toggle state lives in URL search param (`?view=raw`) so it's linkable and page-refresh-safe.
- Hover on trend: crosshair + tooltip showing week, Pats value, league median, delta.
- Hover on distribution dot: team name + EPA + rank in tooltip.
- Keyboard: chart elements focusable; Tab cycles focus through interactive points.

**Insufficient-sample handling in the trend chart:** weeks where Pats had `n<10` in the phase render as gaps in the Pats line (not zero, not interpolated). Rolling-4-week avg skips those weeks from the window.

### 2.3 Copy voice

Per DESIGN.md §Content conventions:
- Terse. Specific. No hype.
- `ranked 04 of 32` not `ranked #4 out of thirty-two`.
- `+0.30 EPA/play` not `0.30 expected points added per play`.
- Use `−` (U+2212) not `-` for negative numbers.
- Uppercase mono labels (`PASS OFFENSE`), Cabinet-Grotesk-bold numerics (`04`).

---

## 3. Architecture decisions

### 3.1 Repo additions

```
/
├── app/
│   ├── page.tsx                   # replaced: season overview
│   ├── phases/
│   │   ├── [slug]/
│   │   │   └── page.tsx           # new: phase detail
│   │   └── page.tsx               # new: phase index (redirects to /#phases)
│   └── api/
│       └── revalidate/
│           └── route.ts           # new: on-demand revalidation webhook
├── components/
│   ├── SiteHeader.tsx             # existing
│   ├── SiteFooter.tsx             # existing
│   ├── HeroStats.tsx              # new: 3-cell hero stat grid
│   ├── PhaseCard.tsx              # new: one phase card (rank + sparkline + metric)
│   ├── PhaseGrid.tsx              # new: 12-card layout using PhaseCard
│   ├── RankNumber.tsx             # new: big tiered numeric rank (04 / 14 / 27 with color)
│   ├── RankDelta.tsx              # new: ▲/▼ glyph + signed number in color
│   ├── Sparkline.tsx              # new: 60×20 svg, directional color
│   ├── TrendChart.tsx             # new: 2-series time-series with toggle
│   ├── DistributionPlot.tsx       # new: 32-dot horizontal plot (plain SVG)
│   ├── WeekResultsStrip.tsx       # new: last-6 result cells
│   ├── EmptyStateCell.tsx         # new: em-dash + n=X tooltip
│   └── Breadcrumb.tsx             # new: lightweight breadcrumb
├── lib/
│   ├── data/
│   │   ├── team.ts                # new: getTeamSeasonOverview, getRecentGames
│   │   ├── phases.ts              # new: getPhaseRankSnapshot, getPhaseWeeklyTrend,
│   │   │                          #      getLeagueDistribution, getPhaseDetail
│   │   └── current-season.ts      # new: getCurrentSeason query helper
│   ├── color/
│   │   └── rank.ts                # new: rank → 'positive'|'neutral'|'negative' tier
│   ├── format/
│   │   ├── number.ts              # new: formatEpa, formatRank, formatDelta, formatSuccessRate
│   │   └── phase.ts               # new: slug ↔ display name (e.g. "pass_offense" ↔ "Pass offense")
│   └── revalidate-token.ts        # new: constant-time secret for /api/revalidate
└── tests/
    ├── e2e/
    │   ├── e3.spec.ts             # new: epic-level smoke
    │   └── no-bad-numbers.spec.ts # new: crawl + numeric-sanity assertion
    └── unit/
        ├── rank-tier.test.ts      # new: top-third / middle / bottom-third logic
        ├── format-number.test.ts  # new: −/+ sign handling, em-dash on null
        └── phase-slug.test.ts     # new: phase.ts slug↔name symmetry
```

### 3.2 Rendering strategy

**All pages are React Server Components (RSC) with ISR + on-demand revalidation.**

```ts
// app/page.tsx
export const revalidate = 3600;  // 1 hour TTL
```

On every successful ETL run, `.github/workflows/etl.yml` curls `/api/revalidate` with a shared secret header and a list of paths (`/`, `/phases/[slug]` × 12). The endpoint calls Next's `revalidatePath()` for each. TTL of 1hr is the fallback for any path the ETL forgets to poke (acceptable drift).

Why ISR + on-demand, not full static:
- 13 total pages is trivial to statically build.
- But the ETL runs weekly; relying on full rebuilds would mean every ETL is a Vercel deploy, coupling data freshness to code freshness.
- ISR gets us CDN-cached responses AND a runtime invalidation path without redeploys.
- Fallback TTL means if the revalidation webhook ever fails silently, the page self-heals within an hour.

### 3.3 Data access layer

`lib/data/` contains typed, parameterized Drizzle queries. **No raw SQL from user input anywhere**. Slug is an allowlisted `Phase` union, team is fixed to `'NE'` for v1, season comes from `getCurrentSeason()`.

**Query inventory** (one function per concept, each a single round-trip):

| Function | Purpose | Returns |
|---|---|---|
| `getCurrentSeason()` | Latest season in `team_phase_season`. Cached per-request. | `number` |
| `getTeamSeasonOverview(team, season)` | Record (from games), point diff, overall rank + EPA, YoY delta | `{ record, diff, overallRank, overallEpa, prevSeasonRank }` |
| `getPhaseRankSnapshot(team, season)` | 12 rows: phase + rank + epa + delta-vs-prev-week (via LAG) | `PhaseSnapshot[]` (length 12) |
| `getPhaseSparklineSeries(team, season)` | Last 8 weeks per phase, for all 12 phases (single query) | `Map<Phase, WeeklyPoint[]>` |
| `getRecentGames(team, season, n=6)` | Last n games w/ result, score, EPA diff | `GameResult[]` |
| `getPhaseDetail(phase, team, season)` | Season-aggregate rank + EPA + success for one phase | `{ rank, epa, successRate, K, plays }` |
| `getPhaseWeeklyTrend(phase, team, season)` | All weeks for that team + league median per week | `{ team: WeeklyPoint[], leagueMedian: WeeklyPoint[] }` |
| `getLeagueDistribution(phase, season, week?)` | All 32 teams for the selected phase+season[+week] | `TeamRankRow[]` |

**Query discipline:**
- Typed with Drizzle's `$inferSelect`-style helpers end-to-end.
- Column projections are explicit (no `SELECT *`).
- Parameterized with `eq()`, `and()`, `inArray()` — never string interpolation.
- `getPhaseSparklineSeries` is a single query that loads all 12 phases at once (96 rows); the server component then `groupBy(phase)` in JS — one round-trip, not 12.

**Budget:** each page ≤ 6 round-trips. Home page uses:
1. `getCurrentSeason`
2. `getTeamSeasonOverview`
3. `getPhaseRankSnapshot`
4. `getPhaseSparklineSeries`
5. `getRecentGames`

5 queries. Under budget.

Phase detail uses:
1. `getCurrentSeason`
2. `getPhaseDetail`
3. `getPhaseWeeklyTrend`
4. `getLeagueDistribution`

4 queries. Under budget.

### 3.4 Rank-tier utility (`lib/color/rank.ts`)

Single source of truth shared across `PhaseCard`, `DistributionPlot` (Pats dot tier), and any future rank renderer.

```ts
export type RankTier = 'positive' | 'neutral' | 'negative';

// Tiers always measured against the full 32-team league so a rank of 10
// reads positive whether K=32 or K=28 that week. Users think in NFL terms
// (1-32), not per-week-qualifying-count. When K<32 the UI surfaces the
// denominator in a small caption (see <QualifiedDenominator />).
const LEAGUE_SIZE = 32;
const CUT = Math.ceil(LEAGUE_SIZE / 3);  // 11

export function rankTier(rank: number | null): RankTier {
  if (rank == null) return 'neutral';
  if (rank <= CUT) return 'positive';
  if (rank > LEAGUE_SIZE - CUT) return 'negative';
  return 'neutral';
}
```

**Change after adversarial review (finding #2):** tier used to scale with dynamic K, which made "rank 10" look positive when K=28 but neutral when K=32. Codex flagged this as misleading — fans map ranks to the 32-team league regardless of weekly qualifying count. Tiers now fixed to 32; the shrinkage gets surfaced separately.

**Qualifying-denominator caption.** When a phase row has `k !== 32`, render a small mono caption below the rank: "of 28 qualified teams." Absent at K=32. Carries the nuance without distorting color semantics.

Edge cases tested:
- `rank === null` → `'neutral'` (we render em-dash separately; tier is for visual fallback)
- `rank === 1` → `'positive'`
- `rank === 11` → `'positive'` (top ceil(32/3) = 11)
- `rank === 12` → `'neutral'`
- `rank === 21` → `'neutral'` (32 - 11 = 21; rank > 21 is negative)
- `rank === 22` → `'negative'`
- `rank === 32` → `'negative'`

### 3.5 Number formatting (`lib/format/number.ts`)

One place where NaN/null/undefined stop:

```ts
export function formatEpa(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v >= 0 ? '+' : '−';           // U+2212 for negatives
  return `${sign}${Math.abs(v).toFixed(2)}`;
}

export function formatRank(rank: number | null | undefined): string {
  if (rank == null || !Number.isFinite(rank)) return '—';
  return String(rank).padStart(2, '0');      // two-digit zero-padded
}

export function formatDelta(delta: number | null | undefined): string {
  if (delta == null || !Number.isFinite(delta)) return '';
  if (delta === 0) return '·';                // middle-dot for no change
  const sign = delta > 0 ? '▲' : '▼';
  return `${sign} ${Math.abs(delta)}`;
}
```

Any rendered numeric **must** go through one of these helpers. The bad-number crawler regex (`/\bNaN\b|\bundefined\b|\bnull\b|^0\.0+$/`) enforces this at E2E time.

### 3.6 Chart library choice — measure before committing

**Change after adversarial review (finding #1):** the plan's original "Recharts = ~55 KB" math was optimistic. Recharts 3.x still pulls `victory-vendor` + locale and routinely lands 80–95 KB after Next's flight serialization. `@tremor/react` (my original fallback) is Recharts underneath so it won't rescue us. Flipping the approach from "start with Recharts, fall back if needed" to **"measure first, pick second."**

**Day-1 task:** install `@next/bundle-analyzer`. Spike a one-LineChart route with Recharts + stubbed data. Run `pnpm build --analyze`. Two paths forward based on the measurement:

- **If Recharts ≤ 70 KB gzip on the spike page:** proceed with Recharts for Sparkline + TrendChart.
- **If > 70 KB:** hand-roll both Sparkline and TrendChart as plain inline SVG. For a 2-series time-series with hover tooltip, that's ~120 lines total — one day of work, owns the visual language fully.

**DistributionPlot is plain inline SVG regardless** — 32 dots on a single axis is 30 lines, no case for a chart library.

**Enforced bundle budget (not just informational):** `lighthouserc.json` gets `resource-summary:script:size = 200kb` as a failing check starting Sprint 3. The Lighthouse CI transition from info-only to enforcing (§0.4) now has a real budget behind it.

### 3.7 On-demand revalidation (`/api/revalidate`)

Route handler at `app/api/revalidate/route.ts`, edge runtime, POST only.

**Change after adversarial review (finding #3):** switched from `revalidatePath` to `revalidateTag` so query-string cache variants (e.g., `?view=raw`) clear in one call. Single source of truth for tags — `lib/revalidation/tags.ts` — consumed by both the workflow and the route handler.

```ts
// lib/revalidation/tags.ts
import { PHASES } from '@/lib/constants/phases';
export const REVALIDATE_TAGS = ['home', ...PHASES.map((p) => `phase:${p}`)] as const;

// app/api/revalidate/route.ts (pseudocode)
import { revalidateTag } from 'next/cache';
import { REVALIDATE_TAGS } from '@/lib/revalidation/tags';
const TAG_SET: ReadonlySet<string> = new Set(REVALIDATE_TAGS);

export async function POST(req: Request) {
  const token = req.headers.get('x-revalidate-token') ?? '';
  if (!constantTimeEqual(token, process.env.REVALIDATE_TOKEN ?? '')) {
    return new Response('unauthorized', { status: 401 });
  }
  const { tags } = await req.json();
  const allowed = (tags as string[]).filter((t) => TAG_SET.has(t));
  for (const t of allowed) revalidateTag(t);
  return Response.json({ revalidated: allowed }, { status: 200 });
}
```

Server components tag their DAL fetches:

```ts
// In the home page's server component:
unstable_cache(fn, key, { tags: ['home'] });
// In each phase detail page:
unstable_cache(fn, key, { tags: [`phase:${slug}`] });
```

**Note on toggle state (finding #3 ripple):** `?view=raw` dropped in favor of client-state toggle over precomputed arrays (see §3.9). Removes the query-string ISR split entirely and simplifies the revalidation story.

**Auth:** shared secret in `REVALIDATE_TOKEN` env var. Constant-time compare via `crypto.timingSafeEqual`. Set in Vercel prod + preview + GH Actions secret.

**ETL integration:** last step of `.github/workflows/etl.yml`, post-contract-tests:

```yaml
- name: Revalidate ISR cache
  if: success()
  env:
    REVALIDATE_TOKEN: ${{ secrets.REVALIDATE_TOKEN }}
  run: |
    TAGS=$(node -e "console.log(JSON.stringify(require('./lib/revalidation/tags.cjs').REVALIDATE_TAGS))")
    curl -X POST https://28andthree.com/api/revalidate \
      -H "x-revalidate-token: $REVALIDATE_TOKEN" \
      -H "content-type: application/json" \
      -d "{\"tags\":$TAGS}"
```

(`.cjs` mirror of the TS file committed alongside, generated by a build step. Alternative: bash hardcodes `PHASES` locally — we already have that list in YAML comments. Decision at E3-10 implementation time based on which is less brittle.)

**Security note on the curl step:** the header is inlined via env expansion; no `echo "$REVALIDATE_TOKEN"` or other output that would leak it to GH Actions logs. Same operational pattern as `ETL_DATABASE_URL` which is also in the same workflow file. Quarterly rotation in `docs/runbook.md#status-data-auth`.

### 3.8 Current-season resolution

**Change after adversarial review (finding #6):** `team_phase_season` lags weekly data during the first weeks of a new season (season rollup needs ≥30 plays/phase before it produces a row). If we keyed off the season table, the home page would still say "2025 SEASON · FINAL" for hours or days into 2026.

```ts
// lib/data/current-season.ts
export async function getCurrentSeason(): Promise<number> {
  const row = await db
    .select({ s: max(teamPhaseWeekly.season) })
    .from(teamPhaseWeekly);
  return row[0]?.s ?? FALLBACK_SEASON;  // FALLBACK = 2025, last shipped
}
```

Returns the latest season present in **`team_phase_weekly`**. Fires the moment any team has enough plays in any phase in the new season (first-Tuesday-of-season for the regular season start).

**Derived from that:**
- `seasonStatus(season, currentMaxWeek)`: returns `"final"` if `currentMaxWeek >= 22` (post-SB) or if a row exists in `team_phase_season` for that season; `"in_progress"` otherwise.
- Hero eyebrow renders `"<SEASON> SEASON · FINAL"` or `"<SEASON> SEASON · WK <N>"`.

Cached per-request via React's `cache()` so the 5 home-page queries don't hit it 5×.

### 3.8a Hero YoY delta — week-1 fallback (finding #7)

Week 1 of a new season has no current-season rank (season table empty). Previously would crash or show stale 2025 values.

`getTeamSeasonOverview` returns both fields nullable:
```ts
{ currentSeasonRank: number | null, prevSeasonRank: number | null, ... }
```

Hero component:
- If `currentSeasonRank === null` → render `—` via `formatRank(null)`, delta empty via `formatDelta(null)`. Tooltip: "Season rank available after week 3 (30-play threshold, SPEC §3.5a)."
- If `currentSeasonRank != null && prevSeasonRank == null` → show current rank, empty delta, tooltip: "No prior season data."
- Both present → normal rank + delta render.

Unit test (`hero.test.tsx`): week-1 fixture, assert em-dash + tooltip text.

### 3.9 Insufficient-sample rendering + rolling-4-week (§3.5a)

The **data layer preserves null**. Every DAL function returns `rank: number | null` (not `rank: number | 0`). The **render layer collapses nulls into `<EmptyStateCell n={plays} />`** which renders:

```jsx
<span data-numeric="true" className="font-mono text-base text-text-muted" title={`n=${n}, insufficient sample`}>
  —
</span>
```

The bad-number E2E crawl enforces this: any `data-numeric="true"` element with text matching `/\bNaN\b|\bnull\b|\bundefined\b|^0\.0+$/` fails the test.

**Numeric output discipline (finding #10):** every rendered metric must go through one of three components: `<RankNumber />`, `<MetricValue />`, `<Delta />`. Each always emits `data-numeric="true"` + the formatted string. A raw `{value.toFixed(2)}` in JSX is a lint violation. `ci.yml` adds a grep step flagging any numeric-like JSX outside these wrappers.

**Change after adversarial review (finding #8):** rolling 4-week average moved from the client into the DAL (SQL window function). Keeps the sample-size rule in one place (the SQL) and trims client JS.

```sql
-- getPhaseWeeklyTrend, simplified:
SELECT
  week,
  epa_per_play AS raw,
  -- Rolling 4 with insufficient-sample weeks skipped:
  AVG(epa_per_play) FILTER (WHERE insufficient_sample = false)
    OVER (
      PARTITION BY team, phase
      ORDER BY week
      ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
    ) AS rolling4
FROM team_phase_weekly
WHERE team = $1 AND phase = $2 AND season = $3
ORDER BY week
```

Returns both series. Client toggle swaps between them with zero math.

**Insufficient-sample weeks render as gaps** in the chart (null values produce line breaks in Recharts `connectNulls={false}` mode).

### 3.10 Phase slug mapping

DB `phase_enum` uses underscore-separated slugs (`pass_offense`). URLs use the same for consistency: `/phases/pass_offense` not `/phases/pass-offense`. Decision: stick with the enum values verbatim — one less mapping to maintain, less risk of drift with the DB. IMPLEMENTATION.md §4 mentioned `/phases/pass-offense` (hyphen) but the enum is underscore; underscore wins.

`lib/format/phase.ts` provides the display-name mapping:
```ts
export const PHASE_DISPLAY_NAMES: Record<Phase, string> = {
  pass_offense: 'Pass offense',
  rush_offense: 'Rush offense',
  overall_offense: 'Overall offense',
  pass_defense: 'Pass defense',
  run_defense: 'Run defense',
  redzone_offense: 'Red zone offense',
  redzone_defense: 'Red zone defense',
  third_down_offense: '3rd down offense',
  third_down_defense: '3rd down defense',
  explosive_offense: 'Explosive (O)',
  explosive_defense: 'Explosive (D)',
  special_teams: 'Special teams',
};
```

### 3.11 Accessibility

- Every interactive SVG element has `role="img"` + `aria-label` (sparkline: "Weekly trend for pass offense"; distribution dot: "New England, EPA per play +0.30, rank 1 of 32").
- Focus rings on all interactive elements (`focus-visible:outline focus-visible:outline-2`).
- Chart toggle is a real `<button>` with `aria-pressed` state.
- Color contrast verified against WCAG AA — `text-text-muted` on `bg` is 4.52:1 (passes). `positive` on bg is 8.7:1 (passes).

**Change after adversarial review (finding #11):** `--negative` cranberry at 2.84:1 on `--bg` fails AA for body text (needs 4.5:1). Previously the plan waved hands at "use on icons/borders only." Now strictly bounded:

| Element | Allowed color |
|---|---|
| `<RankNumber>` at display size (≥30px Cabinet Grotesk Bold) | `--negative` OK — WCAG AA Large passes at 3:1; this passes |
| Small rank badges (<18px), delta numbers, tooltips | `--text` (bone) for the number + `--negative` only for an adjacent glyph (`▼`) or a 2px border. The semantic signal is the glyph + badge border, not text color |
| Icons & borders at any size | `--negative` OK |
| Body text in error/negative states | Always `--text` — never `--negative` |

Axe scan runs in Playwright for `/` + one phase page; target: 0 serious/critical violations, including contrast. Visual regression baseline captures the rank badges so any regression to cranberry-text shows up as a pixel diff.

### 3.12 Performance

- Home LCP target: < 2s. Hero stat text is above-the-fold + doesn't depend on chart JS, so LCP element is likely the H1 — rendered server-side, very fast.
- Phase detail LCP target: < 2.2s. Slightly higher budget because the trend chart is above the fold; acceptable.
- Bundle budgets (from §0.4 IMPLEMENTATION.md): home < 180 KB gzip; phase detail < 250 KB gzip.
- Recharts imports: named-only; no barrel imports.
- Images: none on home or phase detail in E3. (No team logos — DESIGN.md anti-pattern.)
- Fonts: already self-hosted via E1. No new font loads.
- **Lighthouse CI flips to enforcing in this sprint** per IMPLEMENTATION.md §0.4. Budgets in `lighthouserc.json` move from informational to a failing check.

---

## 4. E2E tests — written upfront

### 4.1 `tests/e2e/e3.spec.ts` — epic smoke

```typescript
import { expect, test } from '@playwright/test';

test.describe('E3 smoke', () => {
  test('home renders hero stats and 12 phase cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('hero-overall-rank')).toBeVisible();
    // Hero rank is a real number, not em-dash.
    const heroRank = await page.getByTestId('hero-overall-rank').textContent();
    expect(heroRank).toMatch(/^\d{2}$/);
    // 12 phase cards.
    const cards = page.getByTestId(/^phase-card-/);
    await expect(cards).toHaveCount(12);
  });

  test('clicking Pass offense card navigates to its detail page', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('phase-card-pass_offense').click();
    await expect(page).toHaveURL(/\/phases\/pass_offense$/);
    await expect(page.getByRole('heading', { name: /pass offense/i })).toBeVisible();
  });

  test('phase detail shows a rank card, trend chart, and distribution', async ({ page }) => {
    await page.goto('/phases/pass_offense');
    await expect(page.getByTestId('phase-rank-card')).toBeVisible();
    await expect(page.getByTestId('trend-chart')).toBeVisible();
    await expect(page.getByTestId('distribution-plot')).toBeVisible();
    // Exactly 32 dots in the distribution.
    const dots = page.locator('[data-testid="distribution-plot"] [data-team]');
    await expect(dots).toHaveCount(32);
  });

  test('trend chart rolling/raw toggle changes the data shape', async ({ page }) => {
    await page.goto('/phases/pass_offense');
    // Default = rolling.
    await expect(page.getByRole('button', { pressed: true, name: /rolling/i })).toBeVisible();
    // Toggle to raw.
    await page.getByRole('button', { name: /raw/i }).click();
    await expect(page).toHaveURL(/\?view=raw/);
    await expect(page.getByRole('button', { pressed: true, name: /raw/i })).toBeVisible();
  });

  test('unknown phase slug returns 404', async ({ page }) => {
    const res = await page.goto('/phases/nonsense');
    expect(res?.status()).toBe(404);
  });

  test('Pats dot on distribution is amber + labeled', async ({ page }) => {
    await page.goto('/phases/pass_offense');
    const ne = page.locator('[data-testid="distribution-plot"] [data-team="NE"]');
    await expect(ne).toBeVisible();
    // Amber fill (DESIGN.md §Color positive). Brittle-color check: assert the
    // element has the `--positive` data-class or the computed fill matches.
    await expect(ne).toHaveAttribute('data-tier', /positive|neutral|negative/);
  });
});
```

### 4.2 `tests/e2e/no-bad-numbers.spec.ts` — numeric-sanity crawler

```typescript
import { expect, test } from '@playwright/test';
import { PHASES } from '@/lib/constants/phases';

const BAD_NUMBER = /\bNaN\b|\bundefined\b|\bnull\b|^0\.0+$|^-?\.?Infinity$/;

const ROUTES = ['/', '/status', ...PHASES.map((p) => `/phases/${p}`)];

test.describe('no-bad-numbers crawler', () => {
  for (const route of ROUTES) {
    test(`no NaN/null/undefined/0.0 on ${route}`, async ({ page }) => {
      await page.goto(route);
      // Any element with data-numeric="true" is a rendered metric.
      const metrics = page.locator('[data-numeric="true"]');
      const count = await metrics.count();
      for (let i = 0; i < count; i++) {
        const text = (await metrics.nth(i).textContent())?.trim() ?? '';
        // Em-dash is acceptable (insufficient-sample).
        if (text === '—') continue;
        expect(text, `"${text}" on ${route} violates bad-number rule`).not.toMatch(BAD_NUMBER);
      }
    });
  }
});
```

### 4.3 `tests/unit/rank-tier.test.ts`

```typescript
import test from 'node:test';
import assert from 'node:assert';
import { rankTier } from '@/lib/color/rank';

test('rank 1 of 32 is positive', () => assert.strictEqual(rankTier(1, 32), 'positive'));
test('rank 11 of 32 is positive (top ceil(32/3))', () => assert.strictEqual(rankTier(11, 32), 'positive'));
test('rank 12 of 32 is neutral', () => assert.strictEqual(rankTier(12, 32), 'neutral'));
test('rank 21 of 32 is neutral', () => assert.strictEqual(rankTier(21, 32), 'neutral'));
test('rank 22 of 32 is negative', () => assert.strictEqual(rankTier(22, 32), 'negative'));
test('rank 32 of 32 is negative', () => assert.strictEqual(rankTier(32, 32), 'negative'));
test('null rank is neutral', () => assert.strictEqual(rankTier(null, 32), 'neutral'));
test('K<32 scales tiers: rank 3 of 9 is positive (top 3)', () =>
  assert.strictEqual(rankTier(3, 9), 'positive'));
test('K<32: rank 4 of 9 is neutral', () => assert.strictEqual(rankTier(4, 9), 'neutral'));
test('K=0 defaults to neutral', () => assert.strictEqual(rankTier(1, 0), 'neutral'));
```

### 4.4 `tests/unit/format-number.test.ts`

```typescript
import test from 'node:test';
import assert from 'node:assert';
import { formatEpa, formatRank, formatDelta } from '@/lib/format/number';

test('formatEpa null returns em-dash', () => assert.strictEqual(formatEpa(null), '—'));
test('formatEpa NaN returns em-dash', () => assert.strictEqual(formatEpa(NaN), '—'));
test('formatEpa positive has + sign', () => assert.strictEqual(formatEpa(0.3), '+0.30'));
test('formatEpa negative uses U+2212 not hyphen', () => assert.strictEqual(formatEpa(-0.08), '−0.08'));
test('formatEpa zero is +0.00 (not unsigned)', () => assert.strictEqual(formatEpa(0), '+0.00'));

test('formatRank 4 is "04"', () => assert.strictEqual(formatRank(4), '04'));
test('formatRank null is em-dash', () => assert.strictEqual(formatRank(null), '—'));

test('formatDelta 0 is middle dot', () => assert.strictEqual(formatDelta(0), '·'));
test('formatDelta +3 is "▲ 3"', () => assert.strictEqual(formatDelta(3), '▲ 3'));
test('formatDelta -5 is "▼ 5"', () => assert.strictEqual(formatDelta(-5), '▼ 5'));
test('formatDelta null is empty', () => assert.strictEqual(formatDelta(null), ''));
```

### 4.5 `tests/unit/phase-slug.test.ts`

Every phase slug has a display name; every display name is non-empty; round-trip symmetry holds.

```typescript
import { PHASES } from '@/lib/constants/phases';
import { PHASE_DISPLAY_NAMES } from '@/lib/format/phase';

test('every phase has a display name', () => {
  for (const p of PHASES) {
    assert.ok(PHASE_DISPLAY_NAMES[p]?.length > 0, `${p} missing display name`);
  }
});
```

---

## 5. Task sequencing — critical path

```
                 ┌────────────────────────────┐
                 │ E3-01 DAL (team+phases)    │  (blocks most UI)
                 └──────────────┬─────────────┘
                                │
        ┌───────────────────────┼─────────────────────────┐
        ▼                       ▼                         ▼
   E3-03 Phase grid          E3-04 Sparkline          E3-08 Empty states +
   + rank-tier util          primitive                bad-number crawler
   (lib/color/rank.ts)                                (cross-cutting)
        │                       │                         │
        │                       ▼                         │
        │                  E3-02 Hero block               │
        │                  (home composition)             │
        │                       │                         │
        └─────┬─────────────────┘                         │
              ▼                                           │
         E3-12 Rank-snapshot card                         │
         E3-11 Week-results strip                         │
              │                                           │
              ▼                                           │
         HOME PAGE DONE                                   │
              │                                           │
              ▼                                           │
        E3-05 Phase detail page skeleton                  │
              │                                           │
      ┌───────┼───────────┬──────────────┐                │
      ▼       ▼           ▼              ▼                │
   E3-06   E3-07       E3-13         (existing E3-05     │
   Trend   Distribution Placeholder)                     │
   chart   plot        (top contributors)                │
      │       │           │                              │
      └───┬───┴───────────┘                              │
          ▼                                              │
     PHASE DETAIL DONE                                   │
          │                                              │
          ▼                                              │
     E3-10 ISR + revalidation webhook ────────────┐     │
     E3-14 A11y pass ──────────────────────────────┤     │
                                                   │     │
          ┌────────────────────────────────────────┘     │
          ▼                                              │
     Sprint 3 demo gate ──────────────────────────────── ┘
     (e3.spec.ts + no-bad-numbers.spec.ts green on prod-build preview)
```

**Critical path** (longest chain): E3-01 → E3-03 → E3-02 → E3-05 → E3-06 + E3-07 → E3-10 → E3-14. About 14–16 hours of focused work.

**Parallel opportunities:**
- E3-04 (Sparkline) + E3-01 (DAL): Sparkline primitive is pure-visual, no DAL dependency.
- E3-08 (empty states + crawler): can be built against placeholder data; tested once pages exist.
- E3-11 (week-results strip) and E3-12 (rank-snapshot card) are small home-page pieces that can land any time after E3-01 + E3-02.

**Realistic 2-week schedule:**

| Week | Focus |
|---|---|
| Week 1 Mon | E3-01 DAL + `rank.ts` utility + format helpers + unit tests |
| Week 1 Tue | E3-03 PhaseGrid + E3-04 Sparkline against fixture data |
| Week 1 Wed | E3-02 Hero block + wire DAL into `/` |
| Week 1 Thu | E3-11 Week-results strip + E3-12 Rank-snapshot card |
| Week 1 Fri | Home page polish, demo-able end of week |
| Week 2 Mon | E3-05 Phase detail page skeleton |
| Week 2 Tue | E3-06 TrendChart (with rolling/raw toggle) |
| Week 2 Wed | E3-07 DistributionPlot (plain SVG) + E3-13 contributors placeholder |
| Week 2 Thu | E3-10 /api/revalidate + E3-08 empty states + no-bad-numbers crawler |
| Week 2 Fri | E3-14 A11y pass + Lighthouse CI enforcement + demo + retro |

---

## 6. Simplicity review

Applied "is this as simple as possible without sacrificing correctness/perf/a11y" to every decision:

| Decision | Simpler alternative? | Verdict |
|---|---|---|
| RSC with ISR + on-demand revalidation | Full static build, redeploy per ETL | Keep ISR — decoupling data freshness from deploys is worth the small complexity. |
| `lib/color/rank.ts` as single tier utility | Inline tier logic in each component | Keep centralized. Same shared logic 3× = guaranteed drift otherwise. |
| `formatEpa` / `formatRank` / `formatDelta` helpers | Inline `toFixed(2)` in each template | Keep. This is where the bad-number guarantee lives. |
| Plain SVG for DistributionPlot | Recharts ScatterChart | Keep plain SVG. ~40 lines vs +10 KB dep noise. |
| Recharts for TrendChart + Sparkline | Hand-rolled SVG charts | Keep Recharts for TrendChart (hover/tooltip/zoom would be painful to hand-roll). Sparkline is borderline; keep for consistency with TrendChart. |
| Phase slugs identical to DB enum (`pass_offense`) | Hyphenated URLs (`pass-offense`) | Underscore everywhere. One less mapping to maintain, one less drift vector. |
| `getPhaseSparklineSeries` as one query loading all 12 | 12 separate queries | Keep single query. 96 rows vs 12 round-trips. |
| `?view=raw` search param for trend toggle | Client-side React state only | Keep URL param. Linkable + refresh-safe; 5 extra lines. |
| Shared secret for `/api/revalidate` | Open endpoint | Keep secret + zod path allowlist. Open endpoint is a cache-bust DoS vector. |
| `getCurrentSeason()` as DB query | Env var or derived from `new Date()` | Keep DB query. Single source of truth; handles ETL-before-season-starts edge cases. |
| 12 ISR paths revalidated per ETL | Wildcard revalidation | Explicit is safer. No accidental full-site invalidation. |

**Deliberately NOT adopted:**
- Storybook — no separate component playground until the library grows.
- A state-management library (Zustand, Redux) — no client state to manage; URL params for toggles.
- `@vercel/og` dynamic OG images — deferred to E6-02.
- Internationalization / date-fns — single-locale app; `Intl.NumberFormat`/`DateTimeFormat` + toFixed handle everything.
- Opponent-team views — SPEC §3.1 is Pats-only for v1.
- Client-side data fetching (SWR, React Query) — server components handle everything.

---

## 7. Adversarial review

Codex surfaced 12 findings. Full adjudication in `docs/plans/e3-team-overview-plan-adversarial-review.md`. Summary:

| # | Sev | Verdict | Topic |
|---|---|---|---|
| 1 | MED | ACCEPT | Measure bundle first with `@next/bundle-analyzer`; escape to hand-rolled SVG if Recharts > 70 KB on the spike |
| 2 | MED | PARTIAL | `rankTier` always divides by 32; K-denominator surfaced as caption when K<32 |
| 3 | MED | ACCEPT | `revalidateTag` instead of `revalidatePath`; single path-list source; URL toggle dropped |
| 4 | MED | ACCEPT | Split sparkline query (Pats-only) from trend query (w/ league median via window func) |
| 5 | **HIGH** | ACCEPT | Denormalize per-game EPA into `games` during ETL — new task **E3-15** |
| 6 | MED | ACCEPT | `getCurrentSeason` sources from `team_phase_weekly`, not season |
| 7 | MED | ACCEPT | Hero handles week-1 `null` rank + delta cleanly |
| 8 | LOW | ACCEPT | Rolling 4-week computed in SQL; client toggles precomputed arrays |
| 9 | LOW | REJECT | GH Actions secret handling is our accepted threat model for ETL_DATABASE_URL already |
| 10 | MED | ACCEPT | Numeric wrappers (`<RankNumber>` etc.) always emit `data-numeric="true"` |
| 11 | MED | ACCEPT | `--negative` restricted to ≥30px display type or icons/borders |
| 12 | MED | ACCEPT | Rename `overall_offense` → `overall` as EPA differential per SPEC §3.2 — new task **E3-16** |

Net new work from adjudicated accepts: ~3 hours, mostly in ETL (E3-15 + E3-16).

---

## 8. Task set — status vs this plan

Cross-checking IMPLEMENTATION.md §4 task list + beads epic `patsbythenumbers-xxs`:

| Task | Plan coverage | New info this plan adds |
|---|---|---|
| E3-01 DAL | §3.3 | 8 functions named + return types sketched; ≤6 round-trips/page budget |
| E3-02 Hero block | §2.1, §3.5 | Three-cell hairline grid with YoY delta; overall rank + record + EPA |
| E3-03 Phase grid + rank-tier util | §3.4 | Dynamic K support (not always 32); lib/color/rank.ts as single source |
| E3-04 Sparkline | §3.6 | Recharts, named imports only; directional color from rankTier |
| E3-05 Phase detail skeleton | §2.2, §3.10 | Slug = enum value (underscore), not hyphen |
| E3-06 Trend chart + toggle | §2.2, §3.9 | URL search param `?view=raw` for toggle; insufficient weeks = gaps |
| E3-07 Distribution chart | §3.6 | Plain SVG (not Recharts ScatterChart) for bundle size |
| E3-08 Empty states + crawler | §3.5, §3.9, §4.2 | `data-numeric="true"` attribute convention; em-dash is the only acceptable non-number |
| E3-10 ISR + revalidation | §3.2, §3.7 | `/api/revalidate` with path allowlist + constant-time auth |
| E3-11 Week-results strip | §2.1 | Last 6 games, REG season only |
| E3-12 Home rank-snapshot card | §3.3 | Delta vs. last week computed via SQL LAG in `getPhaseRankSnapshot` |
| E3-13 Top contributors placeholder | §2.2 | (No plan change) |
| E3-14 A11y pass | §3.11 | Axe target: 0 serious/critical; focus rings on SVG |

**Gaps / new tasks:**
- **E3-01a `lib/format/number.ts` + unit tests** — not in the existing task list but load-bearing for the bad-number guarantee. Splitting from E3-01 so it can land first.
- **E3-01b `lib/format/phase.ts` + slug↔name mapping** — same pattern.

**Tasks whose acceptance needs updating** (via `bd update --notes`):
- `E3-03`: "rank-tier util accepts K (not always 32); top/bottom third scales to qualifying-team count"
- `E3-05`: "slug uses underscore (pass_offense), matches DB enum"
- `E3-06`: "toggle state in URL search param (?view=raw); insufficient-sample weeks render as gaps"
- `E3-07`: "plain SVG, not Recharts; 32 dots with data-team + data-tier attributes"
- `E3-08`: "`data-numeric='true'` attribute convention; bad-number regex includes `\\.Infinity`"
- `E3-10`: "/api/revalidate route handler + path allowlist + shared-secret auth"
- `E3-11`: "REG-season only, last 6 completed games"

---

## 9. Open risks for Sprint 3

| Risk | Mitigation |
|---|---|
| Recharts bundle blows the 180 KB home budget | Measure after first build; fallback to hand-rolled SVG for TrendChart. |
| On-demand revalidation fires before ETL commits land | Revalidate happens as the last step of the ETL workflow, after `conn.commit()` and contract tests pass. Worst case: 1hr ISR TTL catches any miss. |
| Neon compute hours exhausted by page-render queries | Each page ≤ 5 round-trips, <150ms p95 warm. With 1hr ISR, a single render is shared across the CDN cache window. Free-tier compute is plenty. |
| Lighthouse CI enforcement breaks CI on a legit change (image size, etc.) | Enforcement starts at the beginning of sprint so flakes surface early. Budget overrides landed as needed in `lighthouserc.json`. |
| A visitor hits a phase page between ETL committing and revalidation firing | ISR returns the previous render; next cache-miss after revalidation returns fresh. No broken state. |
| SPEC §3.2 "overall (team EPA differential)" is subtly different from `overall_offense` | Plan uses `overall_offense` as the home-page hero overall rank. If the spec meant a (posteam_epa − defteam_epa) differential, that's a different phase. Flag for the adversarial review; default assumption is `overall_offense`. |
| Home page displays season-final 2025 data forever if the 2026 season doesn't start | `getCurrentSeason()` always returns max(season); first 2026 game auto-flips. If 2026 is delayed, "final 2025" is still correct to show. Acceptable. |
| Mobile rendering breaks at 375px | E3 aims for basic usability only; full mobile polish is E6-05a. Add a 375px Playwright smoke to `e3.spec.ts` to catch horizontal scroll. |
| Phase page URL collision with a future non-phase route | `/phases/[slug]` with a 12-value allowlist plus a Next.js 404 on unknown slug prevents collision in any practical case. |
| A11y axe scan flags a serious violation late in sprint | Scan integrated into `ci.yml` against preview URL on every PR — catches early. |

---

## 10. Sprint 3 exit criteria

Same split as E1 + E2: automated + operator-verified.

### Automated (verified by `tests/e2e/e3.spec.ts` + `no-bad-numbers.spec.ts` + unit tests in CI)

- Home page renders with 12 phase cards, 3-cell hero, last-6-game strip — all numeric values non-null (or em-dash for insufficient-sample).
- Clicking the Pass Offense card navigates to `/phases/pass_offense`.
- Phase detail shows rank card, trend chart (rolling by default), distribution plot with 32 dots.
- `?view=raw` toggle persists across page refresh and changes trend-chart data.
- Unknown phase slug (e.g. `/phases/nonsense`) returns 404.
- No-bad-numbers crawler passes on 14 routes (`/`, `/status`, 12 phase pages).
- Unit tests: rank-tier 10 cases, formatEpa/Rank/Delta 11 cases, phase-slug symmetry pass.
- Axe scan: 0 serious/critical violations on `/` + `/phases/pass_offense`.
- Lighthouse CI enforced budgets: home perf ≥ 90, a11y ≥ 95, phase detail perf ≥ 88.

### Operator-verified (checklist in `docs/sprint-3-exit.md`)

- All 12 E3 beads tasks closed (+ 2 new ones from §8 if spawned).
- `/api/revalidate` called after a manual dispatch of `etl.yml`; home page + phase pages show a newer `updated_at` on next load.
- `REVALIDATE_TOKEN` set in Vercel prod + preview + GH Actions.
- Home page LCP < 2s and phase detail LCP < 2.2s verified via `pnpm lh` against prod URL.
- Bundle analyzer (`pnpm build` + inspection) confirms home page < 180 KB gzip.
- Manual visual regression against DESIGN.md for rank cards (colors match tokens), hero (Cabinet Grotesk loaded, amber "and" in wordmark), tables (tabular-nums), week-results strip.
- Demo walkthrough: `/` → click Pass Offense → trend chart → toggle raw → distribution plot with Pats amber dot.

E3 is done when **both buckets are green** AND the prod URL shows a Patriots fan their season at a glance.
