# E11 — Historical season browsing (plan v2)

Status: planned 2026-08-25. UX settled with the user via three /ux-brainstorm
prototype rounds (variants A/B/C → B's UI with URL plumbing). v2 incorporates
the adversarial design review (Claude workflow, 5 lenses, 2-refuter
verification: 37 findings survived, 13 killed). Prototype code exists in the
working tree, uncommitted; §3.6 lists disposition.

## 1. Problem

Six complete seasons (2020–2025) sit in `team_phase_season` (384 rows each),
plus games, plays, rosters, and player rollups — and no visitor can reach any
of them. Every page pins to `getCurrentSeason()`. The gap is sharpest during
the preseason transition (shipped 2026-08-24): the site shows blank 2026 with
no path back to the completed 2025 season. The audience (analytics-literate
fans) specifically wants era comparison; season browsing is table stakes for
the reference peers (PFR, rbsdm).

## 2. UX (settled — do not re-litigate)

User decisions, locked across three prototype rounds:

1. **SeasonSwitcher pill in `SiteHeader`** — one consistent spot on every
   screen. Mono bordered pill `2026 ▾`, right of the nav, visible on mobile
   next to the hamburger. Pill border flips to `--positive` and text to
   `--text` while a past season is in view.
2. **State lives in the `?season=YYYY` URL param.** No cookie. Selecting the
   current season returns to the clean URL.
3. **The param rides every nav link** while historical — season-agnostic
   pages ignore it; the context survives detours.
4. **HistoricalMarker** chip (`HISTORICAL · 2023` + `Back to {current}` link
   to the clean URL of the same page) in the page-header block of every
   season-scoped page.
5. Seasons 2020..current (`EARLIEST_SEASON = 2020`). Invalid/out-of-range
   param falls back to current — never 404, never 500.
6. Sub-navigation carries the param: phase cards, breadcrumbs, contributor
   cards, roster cards.

Review-driven refinements (v2):
- **Menu items are links, not buttons** — the menu is a disclosure
  containing a list of real `<Link>`s to the target URLs. Open-in-new-tab
  works (the era-comparison affordance), semantics are plain navigation
  (no ARIA listbox contract to satisfy), Escape closes, focus returns to
  the pill. [review: a11y CRITICAL + links WARNING]
- **Pending state on switch**: the first hit on a historical URL can be an
  on-demand ISR render (seconds). The pill uses `useTransition`; while
  pending it dims + `aria-busy`, cursor progress. [review: CRITICAL]
- **Copy**: historical eyebrows read `{s} SEASON · FINAL`. `NoSeasonData`
  gets a variant: upcoming → "Stats populate after Week 1"; historical →
  "No {season} stats for this view." Player historical shell: "No recorded
  {season} snaps with the Patriots." [review: CRITICAL — the current copy
  promises stats that will never come]
- **`/players` IS season-scoped** (resolving the v1 contradiction):
  `?season=2021` shows the 2021 roster via `getPatsRoster(2021)`
  (roster_snapshots hold every season). Hub eyebrow becomes
  `{s} SEASON · ROSTER`; "current roster" copy is parameterized.
- Mobile acceptance: at 375px the header fits wordmark + pill + hamburger
  with no wrap/overlap; menu tap targets ≥ 40px.

## 3. Architecture

### 3.1 Caching shape (unchanged from v1, review-endorsed)

Reading `searchParams` in a server page opts the route into dynamic
rendering — clean-URL current-season traffic (~99%) would lose ISR.

**Middleware rewrite → internal static segment tree.** Public URLs keep
`?season=`. `middleware.ts` gains one branch: pathname ∈
`SEASON_SCOPED_PATHS` AND the param passes the strict validator → rewrite to
`/s/{season}{pathname}`. Clean routes never read `searchParams`; their ISR
behavior (and the ETL revalidation flush) is untouched. `/s` routes:
`revalidate = 86400`, `generateStaticParams: []` (on-demand ISR; historical
data is immutable).

Verified during review: on a rewrite (not redirect), `usePathname` /
`useSearchParams` resolve to the *public* URL on both server and client —
no hydration mismatch, no internal-path leakage in rendered hrefs.

Note: the repo runs **Next 16.2.4** (not 15); E2E in §5 exercises the
rewrite semantics on the real version.

Rejected alternatives (for the record): cookie context (same URL must vary
per user — uncacheable, unshareable); accepting dynamic rendering on
`?season=` reads (silently converts the highest-traffic ISR routes to
per-request DB hits and neuters the ETL revalidation flush).

### 3.2 One validator, one allowlist [review: CRITICAL]

The middleware regex, the pill, nav decoration, and the notice must agree on
what a season param is — `parseInt('2023x') === 2023` while the anchored
regex rejects it, so a loose client would label current data as historical.

`lib/season-view.ts` is the single source of truth:
- `parseSeasonParam(raw: string | null): number | null` — anchored
  `/^\d{4}$/`, integer, `>= EARLIEST_SEASON`. Pure; usable in middleware
  (edge), server pages, and client components.
- `SEASON_SCOPED_PATHS` — matcher list consumed by BOTH the middleware
  branch and client nav decoration: `/`, `/phases/[slug]`,
  `/team/units/[unit]`, `/coaching`, `/players`, `/players/qb/[id]`,
  `/players/skill/[id]`.
- `resolveSeasonView(param, currentSeason)` — layered on
  `getSeasonContext()`; the upper bound (`< current`) is decided
  server-side where current is known. Middleware validates format+floor
  only and stays DB-free; the `/s` wrapper does the authoritative
  comparison and redirects `>= current` to the clean path.

Client rule: any param that fails `parseSeasonParam` or isn't in the seasons
list is treated as **absent** — pill shows current/no green border, nav
links don't propagate it, notice logic ignores it.

### 3.3 The /s tree: guard, rollover, flush

- **External access guard** [review: CRITICAL, partially refuted to
  "hardening"]: a request arriving from outside with pathname starting
  `/s/` (no rewrite involved) gets a 308 to the public form
  (`/s/2023/coaching` → `/coaching?season=2023`). One middleware line;
  kills the duplicate-URL surface and the broken-chrome state. Not a loop:
  the redirect target is then *rewritten* (internally) on the next request.
- **Rollover invalidation** [review: CRITICAL]: during 2026,
  `/s/2026/...` caches a redirect-to-clean; at the 2027 rollover it must
  start serving 2026 as historical. Two bounds: (a) `/s` revalidate =
  86400 caps staleness at a day; (b) add `/s` paths to the ETL
  revalidation flush allowlist (`lib/revalidation/tags.ts`) so the first
  post-rollover ETL run (the schedule-only ingest already triggers the
  flush) clears them immediately. Cost of flushing immutable pages: one
  re-render per historical page per week — negligible, and it also heals
  any data backfill.
- The wrapper redirect for `season >= current` therefore self-corrects
  within a day worst-case, minutes typical.

### 3.4 Season-scoped pages

| Route | Plumbing (verified) | Historical notes |
|---|---|---|
| `/` | all DAL calls take `season` | hero delta "vs {s-1}": 2019 absent → em-dash (verified in HeroStats) |
| `/phases/[slug]` | `getPhaseDetail/Trend/Distribution/Contributors(season)` | `!detail` on a historical season renders the shell + NoSeasonData(historical) — never 404 [review] |
| `/team/units/[unit]` | null-safe cells | em-dash for missing historical rows |
| `/coaching` | `getCoachSegments/getFourthDownDecisions(team, season)` | empty state exists |
| `/players` | `getPatsRoster(season)` | historical roster is a real feature |
| `/players/{qb,skill}/[gsisId]` | `getPlayer` falls back to `players` table | shell + NoSeasonData when `historical \|\| ctx.awaitingFirstGame` and no stats; shell pages are **noindex** [review] |

Excluded (param ignored, no marker, switcher still present but selecting a
season navigates the *current page's clean path*… no — see below):
`/draft-roi`, `/status`, `/methodology`, `/tokens`, `/admin/*`.

Switcher behavior on excluded pages [review: dead-interaction WARNING —
killed in refutation but worth specifying]: the switcher renders everywhere
(consistent chrome, user decision #1); on a season-agnostic page, selecting
a past season navigates to the **home page** at that season
(`/?season=2023`) rather than appending an inert param to the current page.
This makes the interaction meaningful everywhere.

### 3.5 Preseason transition + SeasonNotice [review: WARNINGs]

- `resolveSeasonView` layers on `getSeasonContext()` — one authority for
  "current" (review PRAISE; preserve).
- The v1 idea of a client-side `useSearchParams` guard hiding SeasonNotice
  is dropped (hydration flash; wrong signal on invalid params). Instead the
  notice moves out of the root layout into the **season-scoped page
  templates**, rendered server-side only when `!historical`. Clean tree
  renders it exactly as today; `/s` tree never does. Excluded pages
  (draft-roi, status, methodology) lose the notice — acceptable, it is
  informational and those pages are season-agnostic.
- The transition blank-shell branches remain; historical seasons with a
  missing row hit the same shell (never 404).

### 3.6 Prototype code disposition (working tree, uncommitted)

Promote (productionizing per tasks): `lib/season-view.ts` (strict validator
added, `SEASON_COOKIE` dropped), `components/SeasonSwitcher.tsx` (rebuild
menu as links + pending state), `components/HistoricalMarker.tsx`,
`components/SiteHeader.tsx` (season-aware nav, all links `seasonAware`,
non-null Suspense fallback: a static pill showing the current season so the
header never layout-shifts), `components/PhaseGrid.tsx` /
`components/PhaseCard.tsx` (`seasonQuery` threading), **`app/layout.tsx`**
(SiteHeader props; SeasonNotice moves per §3.5), transition-branch edits in
`app/page.tsx` / `app/phases/[slug]/page.tsx`.

Delete: `app/playground/`, `components/SeasonPicker.tsx`. The prototype
pages' direct `searchParams` reads are replaced by the §3.1 tree.

### 3.7 SEO / metadata

- Historical pages: **self-canonical in the public `?season=` form**,
  indexable — except blank-shell player pages, which are noindex.
- `/s/[season]` wrappers own `generateMetadata`: season-stamped
  titles/descriptions/OG via existing `pageMetadata` + `/og`.
- Sitemap: add `?season=` variants for team-level routes (home, phases,
  units, coaching) × `EARLIEST..statsSeason-?` (~100 URLs). Player
  historical URLs stay out.
- Sitemap staleness fixes [review: WARNING — the v1 "fix" was itself a
  bug]: `listPlayerRoutes()` must key on the **latest season with stats**
  (MAX(season) in `qb_season`), NOT `getCurrentSeason()` — during the
  preseason window `getCurrentSeason()` returns the transition season with
  zero player rows and would empty the player sitemap for ~6 weeks/year.
  Audit player `generateStaticParams` for the same hardcoded-2025 pattern.

## 4. Landing order [review: CRITICAL — single-branch auto-deploy]

Commits land on `main` → prod. Every task below leaves prod correct on its
own; the feature becomes *visible* only at E11-08 (header switcher), which
lands last. Before it, `?season=` URLs work if hand-typed — correct
behavior, just unadvertised.

## 5. Verification (epic acceptance)

1. On every page, the header switcher lists 2020..current newest-first as
   links; middle-click/cmd-click opens a historical view in a new tab.
   Selecting 2023 lands on `?season=2023` with real 2023 data (home h1
   "New England, 2023", real 2023 record); pill shows pending state during
   the transition.
2. Direct load of `/?season=2023` in a fresh browser renders the identical
   view.
3. Historical marker + working "Back to {current}" on every season-scoped
   page when historical; absent on current.
4. With `?season=2023` active, every nav link carries the param; Draft and
   Status ignore it (render current content, no marker); selecting a season
   from a season-agnostic page lands on `/?season=…`.
5. `?season=1999`, `?season=abc`, `?season=2023x`, `?season={current}`:
   clean-view rendering (current data, no green pill, no marker), and the
   param does not propagate to nav links. Current-season param redirects to
   the clean URL. Direct `/s/2023/coaching` hit → 308 to
   `/coaching?season=2023`.
6. Build output: `/`, `/phases/[slug]`, `/players` remain prerendered
   (●/○, not ƒ). Second hit on a historical URL is served from the ISR
   cache (measure the ISR layer, not just edge cache headers). Rewritten
   responses carry the same CSP/security headers as clean ones.
7. At 375px viewport: wordmark + pill + hamburger fit without wrap; menu
   targets ≥ 40px; switcher menu operable by keyboard (tab through links,
   Escape closes, focus returns to pill).
8. `pnpm test` green incl. `parseSeasonParam`/`resolveSeasonView`/path-
   allowlist units; `pnpm test:e2e` green incl. new specs; existing sandbox
   eyebrow specs untouched-green.
9. Canonicals: clean → clean self; historical → `?season=` self;
   blank-shell player pages noindex. Sitemap contains historical team-level
   URLs and player URLs keyed on the latest stats season.

## 6. Risks

- Middleware rewrite ordering: after the admin gate, before CSP attachment;
  rewritten responses must get identical header treatment (acceptance #6).
- `useSearchParams` needs Suspense boundaries (prototype has them);
  fallback = static current-season pill, so no layout shift.
- Typed routes need `as Route` casts on `?season=` hrefs.
- The shared-template refactor (E11-02..04) is the bulk of the epic —
  sized as three tasks, not one "mechanical" line.
- 12×6 phase-row coverage is asserted from current data; the historical
  shell branch (§3.4) makes a future gap render blank, not 404.

## 7. Review log

Engine: Claude workflow (5 lenses × adversarial reviewers, every
CRITICAL/WARNING attacked by 2 independent refuters). 37 findings survived,
13 killed. All 8 CRITICALs incorporated (§2 copy/a11y/pending, §3.2
validator, §3.3 guard + rollover, §4 landing order, `/players` resolved).
Notable refutation that *shaped* the design: the /s direct-access CRITICAL
was half-refuted (Next rewrite semantics keep public URLs in rendered
HTML), downgrading it to the one-line 308 guard in §3.3. Killed findings
retained as design notes where cheap (§3.4 switcher-on-agnostic-pages,
§3.3 flush cost). PRAISE preserved: rewrite-to-static-tree, DB-free
middleware, `resolveSeasonView` layering, never-404 rule.
