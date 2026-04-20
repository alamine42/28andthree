# E4 — Player Deep Dives: Plan

**Status:** Draft v2 · 2026-04-19 (post-codex adversarial review — see `e4-player-deep-dives-plan-adversarial-review.md`)
**Scope:** Sprint 4 (weeks 7–8). 16 existing + 2 new tasks in beads under epic `patsbythenumbers-39d`.
**Source-of-truth:** `SPEC.md` §3.3, §3.5a · `IMPLEMENTATION.md` §5 · `DESIGN.md` · `docs/plans/e3-team-overview-plan.md` (for component + DAL conventions carried forward)

---

## 1. Context — what problem Sprint 4 solves, and for whom

E3 gave fans a team-level view: rank cards, 12 phase pages, weekly trends, league distribution. Open question every phase page now raises: **"who is driving that rank?"** Pass-offense rank 1 is interesting; pass-offense rank 1 powered by a 22-year-old QB with CPOE +8% over league average is a story.

E4 closes the gap. Ships:
- **QB deep dive** — the single most-loaded page on a fan site. The face of the season.
- **Skill-position pages** — WR / RB / TE usage, efficiency, and routes.
- **Unit pages** — honest team-level defense, OL, DL metrics (no per-defender ratings; SPEC §3.3 defers that as "better to ship nothing than ship bad numbers").
- **Top contributors on phase pages** — wires the E3-13 placeholder so every phase page credits the 3 Pats players who drive the number.

Users this sprint: same analytics-literate Patriots fan as E3, now clicking past the rank card into "tell me about Drake Maye specifically." Mobile still secondary (full mobile pass is E6-05a).

**Done** when:
- `/players/qb/[id]` renders for the current primary starter with EPA/dropback, CPOE, aDOT, pressure %, clean-pocket vs pressured splits, 18-week trend, and the §3.5a primary-starter filter defaulting to on.
- `/players/skill/[id]` renders for a WR, RB, or TE with targets, routes, YAC, target share, aDOT on targets, red-zone usage.
- `/team/units/defense` / `/team/units/offensive-line` / `/team/units/defensive-line` each render their unit metrics with the honest "individual defender ratings deferred" methodology callout.
- Top-3 contributor cards appear on each of the 12 phase pages.
- Primary-starter + traded-mid-season behavior respects §3.5a rules, verified by contract tests.
- Player headshots load from the NFL CDN with initials fallback.
- Small-sample banner appears on any player page below the 100-dropbacks / 100-routes / 100-snaps thresholds.
- `tests/e2e/e4.spec.ts` green.

---

## 2. UX scope for Sprint 4

Four page types + one phase-page enhancement.

### 2.1 QB deep dive — `/players/qb/[gsis_id]`

The marquee page.

```
┌───────────────────────────────────────────────────────────────┐
│ Breadcrumb: ← Season / Players / Drake Maye                   │
│                                                               │
│ Header row:                                                   │
│   [avatar 80×80]  DRAKE MAYE                                  │
│                   QB · New England · #10                       │
│                   2025 · Rookie · 11-6                         │
│                                                               │
│ Hero stat grid (4 cells, hairline):                          │
│   EPA/DROPBACK   CPOE    ADOT      PRESSURE RATE              │
│   +0.30          +8.4%   8.2 yds   26%                        │
│   ▲ league        top 5  avg        top 10                    │
│                                                               │
│ Toggle row: [ Primary starter ] [ All games ]                │
│   (URL-query-stateless; React state)                         │
│                                                               │
│ Weekly trend chart (shared TrendChart component):            │
│   EPA/dropback vs league median, 18-week timeline            │
│   (respects toggle — "primary starter" filters games          │
│    where he was >50% of team dropbacks)                       │
│                                                               │
│ Clean-pocket vs pressured split (2-cell hairline):           │
│   CLEAN POCKET          UNDER PRESSURE                       │
│   +0.34 EPA/dropback    −0.18 EPA/dropback                   │
│   68% of dropbacks       32% of dropbacks                    │
│                                                               │
│ Deep-ball efficiency (2-cell):                               │
│   DEEP (20+ YARDS)     SHORT/INTERMEDIATE                    │
│   45% completion       72% completion                        │
│   +0.50 EPA/attempt    +0.22 EPA/attempt                     │
│                                                               │
│ Methodology callout (--callout style):                       │
│   "Primary starter = games where the QB took >50% of team     │
│    dropbacks. See Methodology."                               │
│                                                               │
│ SiteFooter                                                   │
└───────────────────────────────────────────────────────────────┘
```

**Interaction:**
- Primary-starter toggle is a real `<button aria-pressed>`; state lives in React (not URL). Default: "Primary starter".
- All charts are the same hand-rolled SVG TrendChart from E3. Deep-ball / clean-pocket split cells are plain hairline grids with numeric wrappers.

### 2.2 Skill-position page — `/players/skill/[gsis_id]`

Same skeleton, different stat surface.

```
┌───────────────────────────────────────────────────────────────┐
│ Breadcrumb: ← Season / Players / DeMario Douglas              │
│                                                               │
│ Header: avatar + name + WR · New England · #81                │
│                                                               │
│ Hero stat grid (4 cells):                                    │
│   TARGETS/GAME   TARGET SHARE   YAC/RECEPTION   EPA/TARGET    │
│   7.2            24%            4.8 yds         +0.18         │
│                                                               │
│ Position-specific stat strip (RB variant or WR/TE variant):  │
│   — For RB: carries, YPC, broken tackles, designed/scrambles │
│   — For WR/TE: routes run, aDOT on targets, separation       │
│                                                               │
│ Weekly trend: EPA/target (shared TrendChart)                 │
│                                                               │
│ Red-zone usage card:                                         │
│   RZ TARGETS · 8          RZ TDs · 3          RZ TARGET SHARE │
│                                                                38% │
│                                                               │
│ Methodology callout.                                         │
└───────────────────────────────────────────────────────────────┘
```

**Variant routing:** single `/players/skill/[id]` route. The page dispatches on the player's stored `position` to render WR/TE vs RB stat sections. Keeps URLs simple and lets a traded-mid-season player who changed positions still resolve.

### 2.3 Unit pages — `/team/units/{defense,offensive-line,defensive-line}`

All three share the same layout pattern; stats differ.

```
┌───────────────────────────────────────────────────────────────┐
│ Breadcrumb: ← Season / Team units / Defense                   │
│                                                               │
│ Header: DEFENSE UNIT — 2025                                   │
│                                                               │
│ Hero stat grid (4 cells):                                    │
│   PRESSURE RATE   COVERAGE EPA   RUN STOP %   EXPLOSIVE ALLOW │
│   32%             −0.15/play     72%          8.2%            │
│   rank 6/32        rank 9/32       rank 11     rank 14         │
│                                                               │
│ Weekly trend: primary unit metric vs league median           │
│                                                               │
│ Methodology callout — THIS ONE IS LOAD-BEARING:              │
│   "Individual defender ratings are deferred for v1.           │
│    See Methodology for why."                                  │
└───────────────────────────────────────────────────────────────┘
```

- **Defense:** pressure rate, coverage EPA allowed, run-stop rate, explosive plays allowed.
- **Offensive line:** pass block win proxy, run block proxy, pressures allowed, EPA on dropbacks.
- **Defensive line:** pressures generated, pass rush win proxy, run-stop rate, sack rate.

Each unit has a `/team/units/[unit-slug]` route; allowlisted slugs (3).

### 2.4 Top contributors on phase pages (E4-11)

Replaces the "Coming in Sprint 4" placeholder. Three cards per phase page, each: avatar + name + 1-2 top stats driving the rank.

```
│ Top contributors                                              │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│ │ avatar      │ │ avatar      │ │ avatar      │              │
│ │ Drake Maye  │ │ Kayshon B.  │ │ DeMario D.  │              │
│ │ QB          │ │ WR          │ │ WR          │              │
│ │ +0.30 EPA   │ │ 26% target  │ │ 24% target  │              │
│ │ /dropback   │ │ share       │ │ share       │              │
│ └─────────────┘ └─────────────┘ └─────────────┘              │
```

- Each card is `<Link>` to the player's page. `PlayerAvatar` with NFL CDN headshot + initials fallback.
- "Top" is phase-contextual: top-by-EPA for offensive phases, top-by-percentage-allowed for defensive, etc. Per phase, DAL returns top-3.

### 2.5 Copy voice (carried from DESIGN.md)

- "Drake Maye" not "Quarterback Drake Maye."
- "+0.30 EPA/dropback" not "0.30 Expected Points Added per dropback."
- "Primary starter" not "Primary Starting Quarterback Status Indicator."
- `n < 100` mono caption when below threshold.

---

## 3. Architecture decisions

> **Read `e4-player-deep-dives-plan-adversarial-review.md` before implementing.** Several load-bearing decisions were corrected post-review — see inline "Change after review" callouts below. Where the review doc and this section disagree, the review doc wins.

### 3.1 Repo additions

```
/
├── app/
│   ├── players/
│   │   ├── qb/[gsis_id]/page.tsx           # QB deep dive
│   │   └── skill/[gsis_id]/page.tsx        # WR/RB/TE (variant-dispatched)
│   ├── team/units/[unit]/page.tsx          # defense | offensive-line | defensive-line
│   ├── methodology/page.tsx                # (E6-01 owns fully; E4 stubs anchors)
│   └── phases/[slug]/page.tsx              # extended with real top contributors
├── components/
│   ├── PlayerAvatar.tsx                    # new: NFL CDN image + initials fallback
│   ├── SmallSampleBanner.tsx               # new: n<100 warning
│   ├── PlayerHeader.tsx                    # new: avatar + name + meta
│   ├── TopContributorCard.tsx              # new: phase-page contributor card
│   ├── CleanPocketSplit.tsx                # new: 2-cell hairline split for QB
│   ├── UnitHero.tsx                        # new: shared hero for unit pages
│   └── charts/TrendChart.tsx               # reused from E3
├── lib/
│   ├── data/player.ts                      # new: getQbDeepDive, getSkillUsage, etc.
│   ├── data/units.ts                       # new: getDefenseUnit, getOlUnit, getDlUnit
│   ├── data/contributors.ts                # new: getTopContributors(phase, season)
│   └── constants/positions.ts              # new: position slugs + display names
├── etl/
│   ├── ingest/nflverse.py                  # extended: fetch_participation()
│   ├── load/players.py                     # new: upsert_players + rosters
│   ├── load/rollups.py                     # new: QB + skill + unit upserts
│   └── transform/
│       ├── qb_rollups.py                   # new
│       ├── skill_rollups.py                # new
│       ├── unit_rollups.py                 # new
│       └── primary_starter.py              # new: sets per-game starter flag
├── drizzle/0006_*.sql                      # player tables + plays player-ID cols
└── tests/
    ├── e2e/e4.spec.ts                      # epic smoke
    └── unit/position-dispatch.test.ts      # skill page variant test
```

### 3.2 Data model — new tables

**`players`** — metadata, one row per player.

| column | type | notes |
|---|---|---|
| `gsis_id` | TEXT PK | nflverse's stable player id |
| `display_name` | TEXT NOT NULL | "Drake Maye" |
| `first_name` | TEXT | |
| `last_name` | TEXT | |
| `position` | VARCHAR(3) NOT NULL | QB/WR/RB/TE/… |
| `current_team` | VARCHAR(3) | may be null (retired/FA) |
| `jersey_number` | SMALLINT | |
| `rookie_year` | SMALLINT | |
| `headshot_url` | TEXT | from NFL CDN; nullable (fallback to initials) |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

Indexes: `(position)`, `(current_team, position)` for unit-page lookups.

**`qb_weekly`** — one row per (gsis_id, game_id, team). **Change after review (#4):** PK moved from `(gsis_id, season, week, team)` to `(gsis_id, game_id, team)` so a Tuesday trade + Thursday game both land cleanly. `season` and `week` are stored for query ergonomics but not part of the PK.

| column | type | notes |
|---|---|---|
| `gsis_id` | TEXT NOT NULL | → `players` |
| `season` | INTEGER NOT NULL | |
| `week` | SMALLINT NOT NULL | |
| `team` | VARCHAR(3) NOT NULL | attribution at the time |
| `dropbacks` | SMALLINT NOT NULL | |
| `attempts` | SMALLINT NOT NULL | |
| `completions` | SMALLINT NOT NULL | |
| `yards` | SMALLINT NOT NULL | |
| `epa_per_dropback` | DOUBLE PRECISION | null when dropbacks=0 |
| `cpoe` | DOUBLE PRECISION | avg of per-pass cpoe |
| `adot` | DOUBLE PRECISION | avg air_yards per attempt |
| `success_rate` | DOUBLE PRECISION | |
| `pressure_rate` | DOUBLE PRECISION | NULL when participation data missing |
| `pressured_dropbacks` | SMALLINT | NULL when participation data missing |
| `clean_pocket_epa_per_dropback` | DOUBLE PRECISION | NULL when pressure data missing |
| `pressured_epa_per_dropback` | DOUBLE PRECISION | NULL when pressure data missing |
| `deep_attempts` | SMALLINT | `air_yards >= 20` |
| `deep_completions` | SMALLINT | |
| `deep_epa_per_attempt` | DOUBLE PRECISION | |
| `primary_starter` | BOOLEAN NOT NULL | E4-03 flag; true when dropbacks > 0.5 × team dropbacks for the game |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

Unique index: `(gsis_id, season, week, team)` — unique because a player can only have one row per team per week (typical trade happens between weeks, not mid-game; in the edge case of mid-game trade, the data fidelity of the rollup is bounded by whatever nflverse reports in `passer_player_id`).

**`qb_season`** — season-level rollup. Same columns minus `week`, plus `games_played` and a derived `primary_starter_games`.

**`skill_weekly`** — one row per (gsis_id, season, week, team). Position-aware projection (single table, some columns only relevant for some positions — WR-specific `separation` is null for RBs).

| column | notes |
|---|---|
| `gsis_id`, `season`, `week`, `team` | PK-like grouping |
| `position` | WR/RB/TE; fixed at ingest time so historical position changes are honored |
| `targets` | |
| `receptions` | |
| `yards_receiving` | |
| `yac_total` | |
| `yac_per_reception` | computed |
| `routes` | from participation data; NULL when missing |
| `target_share` | targets / team_dropbacks for that week; NULL when team_dropbacks=0 |
| `adot_on_targets` | AVG(air_yards) on targets |
| `redzone_targets` | |
| `redzone_receptions` | |
| `carries` (RB) | NULL for WR/TE |
| `yards_rushing` (RB) | |
| `ypc` (RB) | |
| `broken_tackles` (RB) | from participation; NULL if missing |

**`skill_season`** — as above, minus week.

**Unit rollup tables** — **Change after review (#8):** dropped the single JSONB-metrics approach in favor of three typed tables:

- `team_defense_weekly` (team, season, week, pressure_rate, coverage_epa_allowed, run_stop_rate, explosive_plays_allowed)
- `team_ol_weekly` (team, season, week, pass_block_win_rate, run_block_rate, pressures_allowed, epa_on_dropbacks)
- `team_dl_weekly` (team, season, week, pressures_generated, pass_rush_win_rate, run_stop_rate, sack_rate)

Plus three `_season` sibling tables.

Rationale: Drizzle loses type inference on JSONB → typos ship silently. Three extra tables is a worthwhile trade for compile-time checks across the DAL.

**`roster_snapshots`** — **New after review (#12):** one row per (gsis_id, season, team). Columns: jersey_number, position, headshot_url, display_name. `getPlayer(gsisId, season?)` queries this table first so historical pages render the player's season-correct identity. Falls back to `players.current_*` if a snapshot is missing.

### 3.3 `plays` table — new player-ID columns (migration 0006)

Base PBP has player IDs we haven't loaded. E4-01 adds:

```sql
ALTER TABLE plays ADD COLUMN passer_player_id TEXT;
ALTER TABLE plays ADD COLUMN passer_player_name TEXT;
ALTER TABLE plays ADD COLUMN receiver_player_id TEXT;
ALTER TABLE plays ADD COLUMN receiver_player_name TEXT;
ALTER TABLE plays ADD COLUMN rusher_player_id TEXT;
ALTER TABLE plays ADD COLUMN rusher_player_name TEXT;
ALTER TABLE plays ADD COLUMN yards_after_catch SMALLINT;
```

Indexes: `(passer_player_id, season)`, `(rusher_player_id, season)`, `(receiver_player_id, season)` for player-centric queries.

### 3.4 Participation data ingest

nflverse exposes `load_participation(seasons=...)` separately from PBP. Keys on `(nflverse_game_id, play_id)`. Columns relevant to E4:

- `offense_players` — array of gsis_ids on the field for each offensive play
- `defense_players` — array of gsis_ids
- `defenders_in_box`
- `number_of_pass_rushers`
- `offense_personnel`
- `defense_personnel`
- `was_pressure` (when available)

E2 pre-emptively added these as columns on `plays` (all null). E4 fills them via a join during ETL.

**ETL shape:**
1. `fetch_pbp(seasons)` — already exists
2. `fetch_participation(seasons)` — new
3. Join in polars: `pbp.join(part, on=['game_id', 'play_id'], how='left')`
4. Update the existing column subset before loading to `plays`. No schema change needed for participation columns (they already exist).

**Data caveat (SPEC §3.3) + coverage gate (post-review #1):**

Participation data starts 2016 and is spotty. At ETL time, compute `participationCoverage` per game:

```python
coverage = tagged_plays / total_plays_with_passer_or_rusher
```

Pass this through to the rollups. In the UI:
- `coverage ≥ 80%` — show participation-derived stats normally.
- `coverage < 80%` — hide the pressure / clean-pocket / routes modules behind a banner: *"Participation data incomplete for this game (47% tagged). Hiding pressure + routes until upstream coverage improves."*

Contract test #22 asserts non-null participation-derived stats only appear when coverage ≥ 80% for the underlying weeks.

### 3.5 Rollup computation

**QB rollups** (`etl/transform/qb_rollups.py`):

```sql
-- One SQL per granularity (weekly, season)
WITH qb_plays AS (
  SELECT p.*
  FROM plays p
  WHERE season = %(season)s
    AND season_type = 'REG'
    AND p.passer_player_id IS NOT NULL
    AND <global garbage-play filter>
),
per_game_starter AS (
  -- who had >50% of dropbacks for their team for each game?
  SELECT game_id, posteam AS team, passer_player_id,
         COUNT(*) FILTER (WHERE qb_dropback) AS qb_dropbacks,
         SUM(COUNT(*) FILTER (WHERE qb_dropback)) OVER (PARTITION BY game_id, posteam)
           AS team_dropbacks
  FROM qb_plays
  GROUP BY game_id, posteam, passer_player_id
),
starter_flags AS (
  SELECT game_id, team, passer_player_id,
         (qb_dropbacks::float / NULLIF(team_dropbacks, 0)) > 0.5 AS primary_starter
  FROM per_game_starter
),
weekly AS (
  SELECT passer_player_id, season, week, posteam AS team,
         COUNT(*) FILTER (WHERE qb_dropback) AS dropbacks,
         COUNT(*) FILTER (WHERE pass_attempt) AS attempts,
         …,
         AVG(epa) FILTER (WHERE qb_dropback) AS epa_per_dropback,
         AVG(cpoe) FILTER (WHERE pass_attempt) AS cpoe,
         …
         BOOL_OR(sf.primary_starter) AS primary_starter
  FROM qb_plays p
  LEFT JOIN starter_flags sf USING (game_id, team, passer_player_id)
  GROUP BY passer_player_id, season, week, posteam
)
INSERT INTO qb_weekly (...)
SELECT … FROM weekly
ON CONFLICT (gsis_id, season, week, team) DO UPDATE SET …
```

Parallel logic for `qb_season`, `skill_weekly`/`season`, and `team_unit_weekly`/`season`. All follow the same E2 pattern: filtered CTE → aggregates → upsert with idempotency.

**Integration with main pipeline:** `run_season()` in `etl/main.py` gains three new calls after `recompute_games_epa`:

```python
recompute_qb_rollups(conn, season=season)
recompute_skill_rollups(conn, season=season)
recompute_unit_rollups(conn, season=season)
```

Same per-season-commit pattern. Adds ~5s to the ~25s backfill budget; well within tolerance.

### 3.6 Primary-starter flag (E4-03, SPEC §3.5a)

**Change after review (#2):** rule extended to always produce exactly one primary starter per game, preventing empty QB pages on blowouts where nobody crossed 50%.

Deterministic tiebreaker (applied in order):
1. QB with `> 50%` of team dropbacks → primary_starter = true.
2. If nobody: QB with the **most** dropbacks (force-marked).
3. If tied: QB whose **earliest play** as passer came first in the game.

Contract test #17 asserts exactly one primary_starter per (game_id, team). Test #18: no two primary_starter rows for the same (game_id, team).

`primary_starter` is a BOOLEAN on `qb_weekly` rows. QB season rollup derives `primary_starter_games` (COUNT of games where primary_starter=true).

**DAL behavior:**
- `getQbDeepDive(id, { primaryStarterOnly })` — when true (default), filters `qb_weekly` rows to `primary_starter = true` before aggregating.
- UI toggle flips the flag and re-runs the query (client-side, ~1 round-trip per toggle).

Rationale: a second round-trip on toggle is acceptable — the toggle is rarely flipped, and keeping both datasets in memory forces a larger payload that most users never see.

**Alternative considered:** server component with a `<Suspense>` boundary that re-renders on param change. Rejected: no URL param means no Suspense trigger; React state would need a client component anyway.

### 3.7 Mid-season trade handling (E4-04, SPEC §3.5a)

Rollup tables key on `(gsis_id, season, week, team)`, so a player traded mid-season naturally splits into rows per team. Weekly aggregate stat quality is preserved per team.

**DAL:**
- Default view sums rows across teams (full-season player view).
- `?team=NE` search param filters to a single team's contribution.
- `/draft-roi` (E5) still attributes the pick to the drafting team regardless of the `team` key.

**Contract test:** synthetic fixture where a player has rows in both NE and MIA in 2024. Test:
- `getQbDeepDive(id)` without `team` filter returns all rows → aggregate reflects both teams' contributions.
- `getQbDeepDive(id, { team: 'NE' })` returns only NE rows.
- Draft ROI (E5) query of the same player returns the full combined stat line but attributes the ROI card to NE.

### 3.8 Player metadata ETL (rosters + headshots)

nflreadpy: `load_rosters(seasons=[...])` returns one row per (player, season, team) with display_name, position, jersey, headshot_url, etc.

**Flow:**
1. `fetch_rosters(seasons)` (new in `etl/ingest/nflverse.py`).
2. Collapse to one row per `gsis_id`, picking the most-recent season's values.
3. `upsert_players()` — simple INSERT … ON CONFLICT (gsis_id) DO UPDATE.

Runs after plays load, before rollups. Small dataset (~3000 players across the 6-season window).

### 3.9 DAL layer

`lib/data/player.ts`:

| Function | Purpose |
|---|---|
| `getPlayer(gsisId)` | Metadata for header + avatar |
| `getQbDeepDive(gsisId, { season, primaryStarterOnly })` | QB rollup + weekly trend + splits |
| `getSkillUsage(gsisId, { season, team? })` | WR/RB/TE rollup + weekly trend |
| `getCleanPocketSplit(gsisId, season)` | Derived per-pressure-state aggregate |
| `getDeepBallSplit(gsisId, season)` | Derived deep/short aggregate |
| `getCurrentStarter(position, team, season)` | Who to route to if URL has no id |

`lib/data/units.ts`:

| Function | Purpose |
|---|---|
| `getDefenseUnit(team, season)` | Season aggregate + 18-week trend + 4 top metrics |
| `getOlUnit(team, season)` | Same shape |
| `getDlUnit(team, season)` | Same shape |

`lib/data/contributors.ts`:

| Function | Purpose |
|---|---|
| `getTopContributors(phase, team, season, limit=3)` | Top-N Pats players driving the phase |

Each function ≤1 round-trip. Page budget per E3: ≤5 round-trips.

**"Top contributor" ordering per phase:**

| Phase | Contributor query |
|---|---|
| pass_offense | Top QBs by dropbacks; then by EPA/dropback |
| rush_offense | Top RBs by carries; then by EPA/carry |
| overall | Top 3 players by EPA contribution (positive side) |
| pass_defense | *unit-only* — card links to `/team/units/defense` |
| run_defense | *unit-only* — card links to `/team/units/defense` |
| redzone_offense | Top receivers by RZ targets |
| redzone_defense | *unit-only* |
| third_down_offense | Top QBs by 3rd-down dropbacks |
| third_down_defense | *unit-only* |
| explosive_offense | Top players by explosive-play count |
| explosive_defense | *unit-only* |
| special_teams | *unit-only* (coverage/return unit card) |

When phase is "unit-only," the contributors section renders a single card linking to the corresponding unit page with a short copy blurb ("Defense unit · see team-level metrics"). Avoids forcing per-defender ratings that SPEC §3.3 defers.

### 3.10 Player headshots (E4-12)

**Change after review (#6):** the v1 plan hardcoded a URL pattern that turned out to be the **club logo** endpoint, not player headshots. Every avatar would have rendered a Patriots logo.

Corrected approach: trust the `headshot_url` field returned by `nflreadpy.load_rosters()`. The roster feed already carries the correct URL per player, varying by vendor (NFL CDN, ESPN CDN, etc.). No hardcoded pattern needed.

ETL does a one-time HEAD check on `headshot_url` at ingest for ~200 most-featured players (Pats starters + top 4th-quarter roster). 5 req/sec rate limit; failures store NULL so the UI renders initials instead.

**Component:** `<PlayerAvatar gsisId={id} displayName={name} size={64} />`. Renders:
- `<Image>` (Next.js `next/image` for automatic format + sizing) if `headshot_url` is set.
- Initials bubble (first letter of first + last name) on a `--surface` disc with `--text` lettering if missing or image fails to load (use `onError` to swap state in a client component).

**Security + perf:**
- Add NFL CDN host to `next.config.ts` `images.remotePatterns` allowlist.
- Existing CSP already includes `img-src 'self' data: https://static.www.nfl.com`.
- Lazy-load (Next default). At most ~40 headshots on a heavy phase page = trivial.

### 3.11 Small-sample banner (E4-13)

Component: `<SmallSampleBanner kind="dropbacks" n={47} threshold={100} />` renders a `--callout` styled banner:

> ⓘ Small sample — 47 dropbacks, stats may swing. See Methodology.

Triggers per SPEC §3.5a: `dropbacks < 100` (QB), `routes < 100` (skill), `snaps < 100` (unit pages don't ship individual defender pages, so this is per-player only).

The DAL returns `{ plays: number, smallSample: boolean }` alongside any player rollup; UI consumes the flag.

### 3.12 Page rendering + ISR

**Change after review (#10):** swap from path-based `revalidatePath` to **tag-based `revalidateTag`**. A single weekly ETL must not flush hundreds of pages.

- `export const revalidate = 3600` on each player/unit page.
- `generateStaticParams` capped to the **current-season** Pats roster (~50 players) + 3 unit slugs. Older-season player pages ISR-on-demand.
- Server components tag their DAL fetches:
  - QB page: `tags: ['player:<gsis_id>']`
  - Unit page: `tags: ['unit:<slug>']`
  - Phase page (already E3): `tags: ['phase:<slug>']`
- `/api/revalidate` route handler gains tag dispatch:
  - Weekly ETL emits `player:<gsis_id>` for each player whose rollup changed + `unit:defense|offensive-line|defensive-line` + current-week `phase:*` tags.
  - Old "empty paths flushes all" default removed.
- `lib/revalidation/tags.ts` exports the allowlist: `['home', 'phase:*', 'player:*', 'unit:defense', 'unit:offensive-line', 'unit:defensive-line']` — wildcard matching handled in the route.

### 3.13 Performance budget

- QB page LCP < 2.2s (SPEC). LCP element is the hero H1; above-the-fold, no chart dep.
- Phase detail page now shows 3 contributor cards with 3 avatar image fetches. Budget adds ~30 KB (compressed images); still under the 250 KB phase-detail cap.
- p95 DB query < 150ms warm. All player queries are indexed on `(gsis_id, season)`.

### 3.14 Security

- Player ID route guard: `gsis_id` validated against DB allowlist (`SELECT 1 FROM players WHERE gsis_id = ?`). 404 on miss. Prevents enumeration + tapping nonexistent IDs as a slow-path DoS.
- Unit slug route: allowlist of 3 values (`defense`, `offensive-line`, `defensive-line`). 404 on miss.
- `/team/units/` extends existing CSP — no new inline scripts.
- NFL CDN added to `img-src` already (E1 set it up). No additional changes.
- Contract-test-level: assert no PII or contact info in `players` rollup (nflreadpy roster data is public league info only, but worth a post-load assertion that no `email` / `phone` field leaked).

---

## 4. E2E + contract + unit tests — written upfront

### 4.1 `tests/e2e/e4.spec.ts` — epic smoke

```typescript
import { expect, test } from '@playwright/test';

test.describe('E4 smoke', () => {
  test('QB page renders hero stats + weekly trend + toggle', async ({ page }) => {
    // Primary starter ID resolved from env or a known-stable Maye gsis_id.
    const QB_ID = process.env.E4_TEST_QB_ID ?? '00-0039166'; // placeholder
    await page.goto(`/players/qb/${QB_ID}`);
    await expect(page.getByTestId('player-header')).toBeVisible();
    await expect(page.getByTestId('qb-hero-stats')).toBeVisible();
    await expect(page.getByTestId('trend-chart')).toBeVisible();
    await expect(page.getByRole('button', { pressed: true, name: /primary starter/i })).toBeVisible();
  });

  test('QB toggle flips data shape', async ({ page }) => {
    await page.goto('/players/qb/00-0039166');
    const primaryBtn = page.getByRole('button', { name: /primary starter/i });
    const allBtn = page.getByRole('button', { name: /all games/i });
    await allBtn.click();
    await expect(primaryBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('skill page dispatches on position (WR vs RB)', async ({ page }) => {
    await page.goto('/players/skill/00-0037197'); // placeholder WR
    await expect(page.getByTestId('skill-target-share')).toBeVisible();
  });

  test('defense unit page renders with methodology callout', async ({ page }) => {
    await page.goto('/team/units/defense');
    await expect(page.getByRole('heading', { name: /defense/i })).toBeVisible();
    await expect(page.getByTestId('unit-hero')).toBeVisible();
    await expect(page.getByText(/individual defender ratings/i)).toBeVisible();
  });

  test('OL and DL unit pages render', async ({ page }) => {
    await page.goto('/team/units/offensive-line');
    await expect(page.getByTestId('unit-hero')).toBeVisible();
    await page.goto('/team/units/defensive-line');
    await expect(page.getByTestId('unit-hero')).toBeVisible();
  });

  test('unknown unit slug 404s', async ({ page }) => {
    const res = await page.goto('/team/units/nonsense');
    expect(res?.status()).toBe(404);
  });

  test('unknown player id 404s', async ({ page }) => {
    const res = await page.goto('/players/qb/not-a-real-id');
    expect(res?.status()).toBe(404);
  });

  test('phase page top-contributor cards link to player pages', async ({ page }) => {
    await page.goto('/phases/pass_offense');
    const cards = page.locator('[data-testid^="contributor-card-"]');
    await expect(cards).toHaveCount(3);
    await cards.first().click();
    await expect(page).toHaveURL(/\/players\/(qb|skill)\//);
  });
});
```

### 4.2 Contract tests (new in `etl/tests/test_contracts.py`)

- **#16** — Every QB with ≥50 dropbacks in a season has a `qb_season` row.
- **#17** — For every game in `games` with season_type=REG, `qb_weekly` has at least 1 `primary_starter=true` row (i.e., someone was the starter).
- **#18** — No `qb_weekly` row has `primary_starter=true` for two different players in the same (game_id, team) — per §3.5a exactly one primary starter per team per game.
- **#19** — `target_share` on `skill_weekly` rows never exceeds 1.0 (sanity).
- **#20** — Unit JSONB has all expected keys per unit (`defense` has pressure_rate, coverage_epa, etc.).
- **#21** — Rollup-vs-phase sanity: sum of QB EPA per week for NE matches `team_phase_weekly` `pass_offense` EPA within floating-point tolerance.

### 4.3 Unit tests

- `tests/unit/position-dispatch.test.ts` — given a player's position, the skill page URL's variant renders the right stat strip.
- `etl/tests/test_qb_primary_starter.py` — synthetic fixture with 3 QBs in one game (backup + starter + emergency). Only the >50% dropback QB gets `primary_starter=true`.
- `etl/tests/test_mid_season_trade.py` — fixture where a skill player has rows in NE and MIA. DAL-equivalent Python query returns them separately with `team` filter and combined without.
- `tests/unit/player-avatar.test.tsx` — fallback to initials when `headshotUrl` is null.
- `tests/unit/small-sample-banner.test.tsx` — renders below threshold, hides above.

---

## 5. Task sequencing — critical path

```
  ┌───────────────────────────┐
  │ E4-01 Schema + migration  │ ← blocks most downstream
  └────────────┬──────────────┘
               │
      ┌────────┼─────────────────────┐
      ▼        ▼                     ▼
  E4-02a    E4-02b               E4-02c
  QB ETL    Skill ETL            Unit ETL
      │        │                     │
      ▼        ▼                     ▼
  (rollups populated; contract tests can land)
      │
      ├── E4-03 Primary-starter flag (joins into QB ETL)
      ├── E4-04 Mid-season trade handling (orthogonal, test-heavy)
      │
      ▼
  E4-05 DAL layer (unblocks all UI)
      │
      ├── E4-06 QB page UI
      ├── E4-07 Skill page UI
      ├── E4-08 Defense unit page
      ├── E4-09 OL unit page
      ├── E4-10 DL unit page
      ├── E4-12 PlayerAvatar component
      ├── E4-13 SmallSampleBanner
      │
      ▼
  E4-11 Top contributors on phase pages (touches all 12 E3 pages)
      │
      ▼
  E4-14 Epic E2E + a11y rescan
```

**Critical path** (longest chain): E4-01 → E4-02a + E4-03 → E4-05 → E4-06 → E4-14. ~14–18h focused work.

**Parallel opportunities:**
- E4-12 PlayerAvatar is pure UI; can land day 1 with fixture data.
- E4-13 SmallSampleBanner pure UI; similar.
- Unit rollups (E4-02c) + unit pages (E4-08/09/10) can run in parallel with QB track.

**Realistic 2-week schedule:**

| Week | Focus |
|---|---|
| W1 Mon | E4-01 schema + migration; participation ingest; player metadata ETL |
| W1 Tue | E4-02a QB rollups + E4-03 primary-starter flag; contract tests |
| W1 Wed | E4-02b skill rollups + E4-02c unit rollups |
| W1 Thu | E4-04 trade handling tests; E4-05 DAL layer |
| W1 Fri | E4-12 PlayerAvatar + E4-13 SmallSampleBanner (unlocks UI track) |
| W2 Mon | E4-06 QB page UI |
| W2 Tue | E4-07 skill page UI |
| W2 Wed | E4-08/09/10 three unit pages |
| W2 Thu | E4-11 top contributors on phase pages |
| W2 Fri | E4-14 E4 E2E + axe rescan + demo |

---

## 6. Simplicity review

| Decision | Simpler alternative? | Verdict |
|---|---|---|
| Separate `qb_*` + `skill_*` + `team_unit_*` tables | Single `player_rollup` with JSONB | Keep split — typed columns are worth the 2 extra tables for QB + skill; unit table is JSONB since it's small |
| Single `skill_weekly` table w/ nullable position-specific columns | Separate `wr_weekly`, `rb_weekly`, `te_weekly` | Keep single. Columns nullable by position; rollup logic stays in one place |
| Client-side primary-starter toggle triggering re-fetch | Pre-fetch both datasets + keep in memory | Keep re-fetch. ~1 query per toggle, rarely flipped. Simpler state. |
| `next/image` for headshots | Raw `<img>` + browser-native lazy-load | Keep `next/image`. Format/size optimization worth the ceremony. |
| JSON schema for `team_unit_*` metrics | Typed columns | Keep JSONB. 3 units × ~4 metrics each = 12 columns if we went typed, but different units have semantically different metrics — schema would be awkward |
| Extend `plays` with player-ID columns | Separate `play_players` join table | Keep on `plays`. Adding 7 columns is ~40 MB on 300k rows; join would slow every player query |
| Participation join in polars before DB write | Post-load SQL join | Keep polars. Keeps `plays` as source-of-truth already denormalized |
| Unit pages as separate routes vs one `/team/units` page with tabs | Tabs | Keep separate routes — SEO + linkability |
| Phase-page top-contributor DAL per phase | One big DAL returning all | Keep per-phase. Smaller queries, better cache locality per phase |

Items deliberately NOT adopted:
- Individual defender ratings (SPEC §3.3 defers)
- Historical player comparisons (v2)
- Projections / fantasy numbers (out of scope)
- Player comparison tool (out of scope)
- Advanced NGS separation data for WRs (participation data is hit-or-miss; we'll pull if available but not fail if not)
- Caching of derived splits (clean-pocket, deep-ball) — computed on-demand from `qb_weekly` aggregates

---

## 7. Adversarial review

Codex surfaced 12 findings. Full adjudication in `docs/plans/e4-player-deep-dives-plan-adversarial-review.md`. Summary:

| # | Sev | Verdict | Topic |
|---|---|---|---|
| 1 | HIGH | ACCEPT | 80% participation-coverage gate + banner when below; hide affected modules |
| 2 | HIGH | ACCEPT | primary_starter deterministic tiebreaker: >50% OR max-dropbacks-fallback-to-earliest-passer |
| 3 | MED | ACCEPT | skill_weekly NULL = N/A, 0 = actual zero |
| 4 | MED | ACCEPT | Rollup PK on `(gsis_id, game_id)` to cover mid-week trades |
| 5 | MED | PARTIAL | Real leaderboards for defensive phases where data supports; caveat copy |
| 6 | HIGH | ACCEPT | Trust roster-provided `headshot_url`; drop the hardcoded club-logo URL pattern (!) + ingest HEAD check |
| 7 | MED | ACCEPT | Storage projection: +105 MB total, well under Neon Launch |
| 8 | MED | ACCEPT | Three typed unit tables (no JSONB blob) |
| 9 | MED | ACCEPT | Fold clean-pocket + deep-ball into `getQbDeepDive` CTE (3 round-trips not 5+) |
| 10 | HIGH | ACCEPT | Tag-based revalidation; cap pre-render to current-season roster (50 pages not 480) |
| 11 | HIGH | ACCEPT | Contract test #17 aligned with deterministic starter rule |
| 12 | MED | ACCEPT | `roster_snapshots` table for per-season identity |

**Net new work from accepts:** ~6 hours. 2 new tasks filed:
- `E4-00a` — Participation ingest + player-ID columns (already noted in §8)
- `E4-00b` — Tag-based revalidation + `roster_snapshots`

---

## 8. Task set — status vs this plan

Cross-checking `patsbythenumbers-39d` existing tasks against the plan:

| Task | Plan coverage | New info |
|---|---|---|
| E4-01 Schema | §3.2 | Includes `plays` table column additions (migration 0006) for player IDs + YAC |
| E4-02a QB rollups | §3.5 | SQL shape defined; joins primary_starter flag |
| E4-02b Skill rollups | §3.5 | Single table w/ position-aware columns |
| E4-02c Unit rollups | §3.5 | JSONB metrics blob |
| E4-03 Primary-starter flag | §3.6 | Computed in SQL from `qb_plays` CTE |
| E4-04 Mid-season trade | §3.7 | Naturally handled by team-keyed rollup rows |
| E4-05 DAL | §3.9 | 3 new modules: player, units, contributors |
| E4-06 QB page UI | §2.1 | Primary-starter toggle in React state |
| E4-07 Skill page | §2.2 | Single route, position-dispatched stat strip |
| E4-08/09/10 Unit pages | §2.3 | Shared `<UnitHero>` component |
| E4-11 Top contributors | §2.4, §3.9 | Per-phase SQL, unit-card fallback for 7 defensive phases |
| E4-12 PlayerAvatar | §3.10 | NFL CDN + `next/image` + initials fallback |
| E4-13 Small-sample banner | §3.11 | `<SmallSampleBanner>` component with thresholds |
| E4-14 E4 E2E | §4.1 | 8 scenarios covering 4 routes + 404s |

**Gaps / new tasks:** one
- **E4-00a — Participation ingest + `plays` player-ID column backfill.** Substantial ETL work that isn't in existing E4-01 scope. File new, block E4-02a/b/c on it.

**Tasks whose acceptance should be updated** (via `bd update --notes`):
- `E4-01`: add "also migrates `plays` to add passer/rusher/receiver player IDs + yards_after_catch (column additions only; no index on new cols until E4-02a lands)."
- `E4-02a`: add "depends on participation join landing in the per-season ETL; uses the per_game_starter CTE + BOOL_OR aggregation to stamp primary_starter on each row."
- `E4-02b`: add "single `skill_weekly` table; position-specific columns nullable by position."
- `E4-02c`: add "JSONB metrics blob; unit enum: defense, offensive_line, defensive_line."
- `E4-11`: add "7 of 12 phases fall back to a unit-level card (pass_defense/run_defense/etc); contributors query has a per-phase mode flag."

---

## 9. Open risks for Sprint 4

| Risk | Mitigation |
|---|---|
| nflverse participation data missing for key plays | Graceful degradation to em-dash per §3.5a. Contract test #7-alike for pressure-rate null tolerance. |
| QB position filter misses RB pass attempts (trick plays) | `passer_player_id` is whoever threw it; accept. Flag in methodology. |
| Skill-position "primary starter" concept doesn't exist | Not shipping — only QB uses primary-starter per SPEC. Skill page always shows "all games." |
| Route count for WR depends on participation | Document as "when available" and show em-dash otherwise. |
| Top contributor card shows retired players on historical phase pages | For phase page showing 2025 season, DAL filters `season=2025`; player ID is current regardless. Avatar loads current headshot. OK if the player retired — we attribute 2025 stats with their 2025 identity. |
| Unit metrics deviate from what ESPN/PFF define as the metric | Document our formula in methodology per unit; accept divergence. |
| `next/image` CLS or LCP regression | Specify `width`/`height`; use `priority` only on above-fold avatars; test with Lighthouse CI |
| Storage growth: 3k players × 6 seasons × 17 weeks | 300k rows total across rollup tables; < 50 MB. Fine. |
| `generateStaticParams` for ~80 Pats players per season = 80 × 6 = 480 pre-rendered pages | Still tractable. Build time < 15s added. |

---

## 10. Sprint 4 exit criteria

### Automated (verified by `tests/e2e/e4.spec.ts` + new contract tests in CI)

- All 8 E2E scenarios in `e4.spec.ts` green.
- Contract tests #16–#21 pass on backfilled data.
- no-bad-numbers crawler extended to cover `/players/qb/[known]`, `/players/skill/[known]`, `/team/units/*` (adds 3 routes).
- Axe: `/players/qb/[known]` + one unit page: 0 serious/critical.
- Lighthouse CI budgets unchanged; QB page LCP < 2.2s verified.

### Operator-verified (`docs/sprint-4-exit.md`)

- All 16 beads tasks closed (+ the 1 new E4-00a if filed).
- Full backfill re-run cleanly populates all new rollup tables.
- `/players/qb/<Maye's gsis_id>` on prod shows his primary-starter splits; toggle flips between "primary starter" and "all games."
- `/team/units/defense` shows the methodology callout prominently.
- Phase page `/phases/pass_offense` shows 3 contributor cards; clicking through lands on a player page.
- Visual regression diff against E3 shows no unexpected changes.

E4 is done when **both buckets green** and the first fan can open the site, click Pass Offense, see Drake Maye's name in a contributor card, click through to his page, and leave having learned something.
