# E2 — Data Ingest & League Aggregates: Plan

**Status:** Draft v2 · 2026-04-18 (post-self-review; canonical codex pass pending re-auth — see `e2-data-ingest-plan-adversarial-review.md`)
**Scope:** Sprint 2 (weeks 3–4). 18 open tasks in beads under epic `patsbythenumbers-2lp` (+3 new: `E2-00b`, `E2-11a`, `E2-13`).
**Source-of-truth:** `SPEC.md` §2, §3.2, §3.5a, §8 · `IMPLEMENTATION.md` §3 · `DESIGN.md` (no UI landing this sprint)

---

## 1. Context — what problem Sprint 2 solves, and for whom

E1 shipped a substrate: app shell, Neon, Sentry, heartbeat ETL, CI. No numbers. E2 turns the substrate into **a queryable history of the last six NFL seasons, ranked 1–32 across every phase SPEC §3.2 cares about, under a single Postgres transaction that's safe to re-run any Tuesday morning**.

Users this sprint: **the builder, and future sprints**. No public-facing feature ships here. E3 renders this data; E4 adds player rollups on top of the same `plays` table; E5 runs coaching-tendency SQL against it. If the aggregation logic or sample-size rules are wrong in E2, every later epic ships wrong numbers dressed up with charts.

**Done** when:
- `plays`, `games`, `team_phase_weekly`, `team_phase_season` all populated 2020 W1 → end of 2025 for all 32 teams.
- Running a full backfill twice yields identical row counts and identical per-team ranks (idempotent).
- The 12 phases in SPEC §3.2 each have 32 teams per regular-season week, ranks 1–32 with deterministic tiebreaks per §3.5a.
- Sample-size thresholds enforced in SQL: `plays<10/week` and `plays<30/season` mark the row as insufficient and exclude it from ranking.
- 9+ data contract tests run after every ETL and fail the workflow on a single bad assertion.
- `/status` shows the last refresh with per-table row counts; `/status/data?phase=<slug>&season=<yr>&week=<n>` returns JSON behind a constant-time token + Upstash-Redis rate limit.
- ETL full backfill finishes in <10 min; single-week refresh in <3 min.

**Context note.** It is 2026-04-18. The 2025 NFL season ended Feb 2026 (Super Bowl LX). All 2020–2025 data is static. Live weekly refresh won't fire in anger until Week 1 of the 2026 season (~Sept 2026); E2 validates weekly paths against mocks + a one-off manual dispatch, but the real proof point for the cron is the first Tuesday of the 2026 regular season.

---

## 2. UX scope for Sprint 2

Minimal. Nothing visual lands on the public site this sprint — E3 does that.

- **`/status` (evolved).** Already lists last-run metadata. Extend to display row counts from `meta_refresh.row_counts` (keyed by table), the nflverse release version, and the ETL duration. Still dark theme, still one server component.
- **`/status/data` (new).** JSON-only API route (NOT a page). Route handler, edge runtime, constant-time header comparison (`crypto.timingSafeEqual`), durable rate limit via `@upstash/ratelimit` + Upstash Redis. Query params: `phase` (slug, allowlisted), `season` (2020–2025), optional `week`. Returns an array of 32 team rows with rank, EPA/play, success rate, plays. Purpose: debugging the aggregation + a fixture source for later Playwright specs.

No chart components, no tables, no headers touched. If E2 drifts into UI work it's scope creep — that's E3.

---

## 3. Architecture decisions

Load-bearing choices that multiple tasks depend on. Each decision sits here, not in a task note.

### 3.1 Repo / layout additions

```
/db/schema.ts                 # add: games, plays, teamPhaseWeekly, teamPhaseSeason + phase enum
/drizzle/000X_*.sql           # generated migrations (one per logical change)
/etl/
  ingest/
    __init__.py
    nflverse.py               # pulls parquet; normalizes columns; yields rows
    schedules.py              # game schedule pull for freshness gate
  transform/
    phases.sql                # parameterized aggregation; single file, 12 phase branches
    ranks.sql                 # ROW_NUMBER() with tiebreak; sample-size guards inline
  load/
    plays.py                  # COPY-into-temp + upsert plays/games
    aggregates.py             # executes transform SQL + upserts team_phase_*
  main.py                     # --heartbeat | --season N [--week W] | --full | --freshness-gate
  models.py                   # hand-written Pydantic for each table (drift check = E2-00b)
  tests/
    contracts.py              # the data-contract suite
    fixtures/                 # tiny parquet+JSON snapshots for unit-ish tests
/docs/phase-definitions.md    # versioned contract: filter per phase, in SQL
/app/status/data/route.ts     # JSON API, edge runtime
/lib/status-data/
  schema.ts                   # zod schema for query params + response
  ratelimit.ts                # Upstash client + sliding window
```

No new top-level directories outside `/etl/ingest|transform|load` and the status-data route. No monorepo tooling.

### 3.2 Ingest library & data source

**Decision: `nflreadpy` (Python) + `polars` + `pyarrow`. Do NOT use `nfl_data_py`.**

Rationale:
- `nfl_data_py@0.3.3` does not build on Python 3.12 (pandas 1.5.3 pin + missing `pkg_resources`). Documented in `docs/solutions/build-errors/nfl-data-py-pandas-python-312-build-failure.md`.
- `nflreadpy` is the maintained successor from the same nflverse team; wraps the same public parquet releases at `github.com/nflverse/nflverse-data/releases`. Uses polars, no pandas pin, active in 2025–26.
- Fallback (if `nflreadpy` falters): fetch the parquet files directly via `pyarrow.parquet.read_table(url)`. The wrapper is thin; replacement is ~30 lines. We accept this swap risk explicitly rather than add a pure-Python abstraction layer pre-emptively.

**Load path:** `nflreadpy.load_pbp(seasons=[...])` → polars DataFrame → select column subset (§3.3) → stream into Postgres via psycopg3 `COPY` to a temp table → `INSERT … SELECT … ON CONFLICT … DO UPDATE`. The two-step COPY+UPSERT is the only way to get idempotent bulk load at 50K rows/sec. No pandas touches the hot path.

Dependencies added to `etl/pyproject.toml`:

```
"nflreadpy>=0.1.0",
"polars>=1.12",
"pyarrow>=17",
```

### 3.3 Data model

**`games`** — one row per game. `game_id` is nflverse's existing `'2025_01_NE_PIT'` format, globally unique, TEXT PK.

| column | type | notes |
|---|---|---|
| `game_id` | TEXT PK | nflverse format |
| `season` | INTEGER NOT NULL | |
| `week` | INTEGER NOT NULL | 1–22 (REG 1–18, POST 19–22) |
| `season_type` | VARCHAR(4) NOT NULL | `REG` or `POST` |
| `home_team` | VARCHAR(3) NOT NULL | standard abbreviations |
| `away_team` | VARCHAR(3) NOT NULL | |
| `home_score` | INTEGER | NULL until completed |
| `away_score` | INTEGER | |
| `game_date` | DATE NOT NULL | calendar date (for freshness gate) |
| `completed` | BOOLEAN NOT NULL DEFAULT false | |
| `posteam_epa` | DOUBLE PRECISION | raw net EPA for the home team's offense; purely descriptive; not used in aggregates |
| `defteam_epa` | DOUBLE PRECISION | mirror |

Indexes: `(season, week)`, `(season, completed)`.

**`plays`** — one row per play, league-wide, 2020–2025. Composite PK `(game_id, play_id)` because nflverse `play_id` is per-game (FLOAT internal; stored as INTEGER here since values are always whole numbers in practice; if we find a non-integer, fail the load loudly rather than quietly coerce).

| column | type | notes |
|---|---|---|
| `game_id` | TEXT REFERENCES games | composite PK |
| `play_id` | INTEGER | composite PK; per-game unique per nflverse |
| `season` | INTEGER NOT NULL | denormalized for index efficiency |
| `week` | INTEGER NOT NULL | |
| `season_type` | VARCHAR(4) NOT NULL | |
| `posteam` | VARCHAR(3) | null for kickoffs |
| `defteam` | VARCHAR(3) | |
| `down` | SMALLINT | 1–4, null for kickoffs |
| `ydstogo` | SMALLINT | |
| `yardline_100` | SMALLINT | 0–100 |
| `play_type` | VARCHAR(16) | `pass`, `run`, `punt`, `field_goal`, `kickoff`, `qb_kneel`, `qb_spike`, `no_play`, … |
| `yards_gained` | SMALLINT | |
| `epa` | DOUBLE PRECISION | nflfastR's |
| `cpoe` | DOUBLE PRECISION | pass only |
| `success` | BOOLEAN | derived from `success` column (EPA>0) |
| `wp` | DOUBLE PRECISION | win probability |
| `qb_dropback` | BOOLEAN | |
| `qb_kneel` | BOOLEAN | |
| `qb_spike` | BOOLEAN | |
| `two_point_attempt` | BOOLEAN | |
| `pass_attempt` | BOOLEAN | |
| `rush_attempt` | BOOLEAN | |
| `pass_length` | VARCHAR(8) | `short`/`deep` (nflverse) |
| `air_yards` | SMALLINT | |
| `is_redzone` | BOOLEAN GENERATED ALWAYS AS (`yardline_100` <= 20) STORED | generated; cheap; indexed |
| `is_third_down` | BOOLEAN GENERATED ALWAYS AS (`down` = 3) STORED | |
| `is_explosive_pass` | BOOLEAN | set on load: `pass_attempt AND yards_gained >= 20` |
| `is_explosive_run` | BOOLEAN | set on load: `rush_attempt AND yards_gained >= 15` |
| `special_teams_play` | BOOLEAN | nflverse raw column |
| `qb_hit` | BOOLEAN | E4-dep (QB pressure splits) |
| `sack` | BOOLEAN | E4-dep |
| `was_pressure` | BOOLEAN | E4-dep; nflverse's computed pressure flag |
| `number_of_pass_rushers` | SMALLINT | E4-dep / E5-dep (blitz rate) |
| `shotgun` | BOOLEAN | E5-dep (coaching tendencies) |
| `no_huddle` | BOOLEAN | E5-dep (tempo) |
| `pre_snap_motion` | BOOLEAN | E5-dep (motion rate; nflverse column may be named slightly differently in some releases — verify at E2-04) |
| `play_action` | BOOLEAN | E5-dep |
| `personnel_offense` | VARCHAR(16) | E5-dep (e.g., `11`, `12`, `21`) |
| `personnel_defense` | VARCHAR(16) | E5-dep |
| `defenders_in_box` | SMALLINT | E5-dep |
| `score_differential` | SMALLINT | E5-nfl4th-dep |
| `game_seconds_remaining` | SMALLINT | E5-nfl4th-dep |
| `posteam_timeouts_remaining` | SMALLINT | E5-nfl4th-dep |
| `defteam_timeouts_remaining` | SMALLINT | E5-nfl4th-dep |
| `roof` | VARCHAR(12) | E5-nfl4th-dep (venue context; `outdoors`/`dome`/`closed`) |
| `surface` | VARCHAR(16) | E5-nfl4th-dep |

**Why store generated columns rather than compute at query time:** aggregation queries run 12 times per refresh over 300k rows. A stored generated column + partial index is orders of magnitude cheaper than a query-time filter. The trade-off is ~5% extra rows in storage — acceptable.

**Column selection discipline.** nflverse has ~370 columns in PBP. We cherry-pick ~40 — the E3/E4/E5 critical path + the nfl4th inputs. Deliberately widened post-adversarial-review (finding #1) to avoid 3–4 round-trips of "add a column + re-backfill 300k rows" across the project. Storage cost: ~25 MB extra, rounding error against Neon's cap. If E5 discovers more columns are needed, we add them — but the `E4-dep` / `E5-dep` / `E5-nfl4th-dep` columns above are the known floor.

Indexes on `plays`:
- `(season, week, posteam)` — offense rollups
- `(season, week, defteam)` — defense rollups
- `(season, week, special_teams_play)` — ST rollups; partial `WHERE special_teams_play`
- `(season, week, is_redzone)` partial — RZ rollups
- `(season, week, is_third_down)` partial — 3rd-down rollups

**`team_phase_weekly`** — one row per (team, season, week, phase).

| column | type | notes |
|---|---|---|
| `team` | VARCHAR(3) NOT NULL | |
| `season` | INTEGER NOT NULL | |
| `week` | INTEGER NOT NULL | |
| `phase` | phase_enum NOT NULL | 12 values |
| `plays` | INTEGER NOT NULL | plays in the phase |
| `epa_per_play` | DOUBLE PRECISION | null iff `insufficient_sample` |
| `success_rate` | DOUBLE PRECISION | |
| `rank` | SMALLINT | 1..K where K = teams meeting threshold that week; null if insufficient |
| `percentile` | DOUBLE PRECISION | (K - rank + 1) / K; null if insufficient |
| `insufficient_sample` | BOOLEAN NOT NULL DEFAULT false | set when `plays < 10` |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

Unique index: `(team, season, week, phase)`. Query index: `(season, week, phase)` for league-distribution fetches.

**`team_phase_season`** — one row per (team, season, phase). Same columns minus `week`; threshold is `plays < 30`.

**Phase enum** — 12 values:
```
pass_offense, rush_offense, overall_offense,
pass_defense, run_defense,
redzone_offense, redzone_defense,
third_down_offense, third_down_defense,
explosive_offense, explosive_defense,
special_teams
```

Using `pgEnum` rather than `VARCHAR`+CHECK — cheaper storage (4 bytes), native type safety on the Drizzle side, matches the closed-world nature of phases.

### 3.4 Phase definitions policy (SPEC §3.2)

Every phase is defined as a SQL `WHERE` clause on `plays`, versioned in `/docs/phase-definitions.md`. Changing a filter requires re-running backfill — treat this doc as a contract.

Two load-bearing policy decisions this sprint nails down:

**1. REG only for rankings.** Playoff samples are tiny and opponent-skewed; rbsdm and FTN Fantasy both restrict league phase ranks to regular season. All `team_phase_*` queries filter `season_type = 'REG'`. POST plays still load to `plays` — E4 player pages may want them — they just don't contribute to phase ranks.

**2. Exclude garbage plays from EPA averages.** Filter out `qb_kneel`, `qb_spike`, `two_point_attempt`, and `play_type = 'no_play'` in every offensive/defensive phase. This matches nflfastR convention (their `epa` column is already computed on the play whether it's a kneel or not — we exclude them from averages, not from storage). ST filter keeps only `special_teams_play = TRUE`.

**3. No garbage-time filter.** (Added post-adversarial-review, finding #6.) We do not filter out plays where one team leads by >14 points in the 4th quarter. Rationale: aligns with rbsdm / FTN / Sumer Sports; excluding garbage time biases a team's EPA toward middle-game performance and obscures 4th-quarter collapse patterns, which are legitimate signal for a fan site. If garbage-time analysis becomes interesting later, add it as a secondary view, not a primary rank filter.

Draft filters per phase (finalized in E2-05a):

| Phase | Filter (pseudocode on `plays`) |
|---|---|
| `pass_offense` | `qb_dropback AND NOT qb_kneel AND NOT qb_spike AND NOT two_point_attempt`; group by `posteam` |
| `rush_offense` | `rush_attempt AND NOT qb_kneel AND NOT two_point_attempt`; group by `posteam` |
| `overall_offense` | `(qb_dropback OR rush_attempt) AND NOT qb_kneel AND NOT qb_spike AND NOT two_point_attempt`; group by `posteam` |
| `pass_defense` | same dropback filter; group by `defteam` |
| `run_defense` | same rush filter; group by `defteam` |
| `redzone_offense` | offense filter AND `is_redzone` |
| `redzone_defense` | defense filter AND `is_redzone` |
| `third_down_offense` | offense filter AND `is_third_down` |
| `third_down_defense` | defense filter AND `is_third_down` |
| `explosive_offense` | `is_explosive_pass OR is_explosive_run`; group by `posteam`; metric = rate not EPA |
| `explosive_defense` | same; group by `defteam` |
| `special_teams` | `special_teams_play`; group by `posteam` (possession team before play) |

Explosive phases are **rate phases** (% of offensive plays that are explosive), not EPA-per-play phases. The schema accommodates this: `epa_per_play` holds the rate for these two phases, with a phase-level note in the definitions doc. Alternative rejected: a separate `metric_value` column. Rate-vs-EPA is the only axis of variation and docs are cheaper than a column.

### 3.5 Aggregation & ranking SQL (SPEC §3.5a tiebreaks)

One parameterized SQL file `etl/transform/phases.sql` executed 12 times per (season, week-or-null, phase), or a single CTE pipeline per phase. Pattern per phase:

```sql
WITH base AS (
  SELECT <team_col> AS team, season, week, season_type,
         epa, success, yards_gained, <other metric cols>
  FROM plays
  WHERE season_type = 'REG' AND <phase_filter>
),
rollups AS (
  SELECT team, season, week,
         COUNT(*)::int AS plays,
         AVG(epa)::float8 AS epa_per_play,
         AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END)::float8 AS success_rate
  FROM base
  GROUP BY team, season, week
),
flagged AS (
  SELECT *,
         (plays < 10) AS insufficient_sample
  FROM rollups
),
ranked AS (
  SELECT *,
         CASE WHEN insufficient_sample THEN NULL
              ELSE ROW_NUMBER() OVER (
                PARTITION BY season, week
                ORDER BY
                  CASE WHEN insufficient_sample THEN 1 ELSE 0 END,  -- insufficient sorts last; all NULL anyway
                  epa_per_play DESC,
                  plays DESC,
                  success_rate DESC,
                  team ASC
              )
         END::smallint AS rank
  FROM flagged
)
INSERT INTO team_phase_weekly (team, season, week, phase, plays, epa_per_play, success_rate, rank, percentile, insufficient_sample, updated_at)
SELECT team, season, week, :phase::phase_enum, plays,
       CASE WHEN insufficient_sample THEN NULL ELSE epa_per_play END,
       CASE WHEN insufficient_sample THEN NULL ELSE success_rate END,
       rank,
       CASE WHEN rank IS NULL THEN NULL
            ELSE ((MAX(rank) OVER (PARTITION BY season, week) - rank + 1)::float8
                  / MAX(rank) OVER (PARTITION BY season, week)::float8)
       END,
       insufficient_sample,
       now()
FROM ranked
ON CONFLICT (team, season, week, phase) DO UPDATE SET
  plays = EXCLUDED.plays,
  epa_per_play = EXCLUDED.epa_per_play,
  success_rate = EXCLUDED.success_rate,
  rank = EXCLUDED.rank,
  percentile = EXCLUDED.percentile,
  insufficient_sample = EXCLUDED.insufficient_sample,
  updated_at = now();
```

**Key choices:**

- **`ROW_NUMBER()` not `RANK()`.** SPEC §3.5a specifies a **deterministic final fallback** (team abbrev alphabetical). A `RANK()` with tied EPAs would still produce ties at the RANK-function level — the whole point of the tiebreak chain is that two teams can't share a rank. `ROW_NUMBER()` with the full ordering enforces uniqueness.
- **Sample-size guards live in the same query.** No multi-pass aggregation. `insufficient_sample` flag set in SQL, rank `NULL` when flagged, K = count of teams meeting threshold (could be <32, almost always is for ST in blowout weeks).
- **Percentile uses the dynamic K.** `(K - rank + 1) / K` so rank 1 = 1.0 percentile, rank K = 1/K. Teams below threshold get NULL percentile — they don't belong on the curve.
- **One transaction per refresh.** The 12 phases × N weeks are written in one `BEGIN`…`COMMIT`. Failure = clean rollback.
- **Percentile denominator note** (post-adversarial-review, finding #10): `(K - rank + 1) / K` uses K = teams meeting threshold *that week*. When a team is rank 1 of K=28 (4 teams insufficient-sample), its percentile is 1.0 — same as rank 1 of K=32. Deliberate; the denominator reflects the population being ranked, not an abstract league. E3 must surface K alongside rank when rendering percentile chips.

### 3.6 Sample-size guards (SPEC §3.5a)

Weekly threshold: `plays < 10` → `insufficient_sample = true`, `rank = NULL`, EPA/success rendered as NULL.
Season threshold: `plays < 30` → same behavior in `team_phase_season`.

**Consequence for contract tests.** The classic "SUM(rank) = 528 for each phase per week" only holds when all 32 teams meet the threshold. The actual contract test is:

```
For each (season, week, phase):
  SUM(rank) == K * (K + 1) / 2  where K = 32 - COUNT(insufficient_sample)
AND COUNT(rank) = K.
```

This is equivalent to 528 for offensive phases (always plenty of plays) and for defensive phases. ST is the phase where K<32 will occur — the test accepts that dynamically.

### 3.7 Transaction boundary & idempotency

**One run = one transaction, guarded by an advisory lock.**

```python
CONCURRENT_ETL_LOCK_ID = 8675309  # documented; see etl/load/__init__.py

with psycopg.connect(settings.etl_database_url, autocommit=False) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT pg_try_advisory_xact_lock(%s)", (CONCURRENT_ETL_LOCK_ID,))
        if not cur.fetchone()[0]:
            logger.info("concurrent_run_skipped lock=%s", CONCURRENT_ETL_LOCK_ID)
            return 0
    try:
        upsert_games(conn, games_df)                       # ON CONFLICT (game_id) DO UPDATE
        upsert_plays(conn, plays_df)                       # COPY to temp, INSERT ... ON CONFLICT (game_id, play_id) DO UPDATE
        recompute_weekly_phases(conn, season, weeks)       # 12 phases × N weeks
        recompute_season_phases(conn, season)              # 12 phases × 1
        write_meta_refresh_ok(conn, row_counts)
        conn.commit()
    except Exception as exc:
        conn.rollback()
        write_meta_refresh_failed(settings, exc)           # separate connection, committed independently
        raise
```

The advisory lock (post-adversarial-review, finding #7) prevents a concurrent manual dispatch + cron run from interleaving writes. Lock auto-releases at transaction end.

**Backfill exception.** For `--full` (all 6 seasons), commit **per season** not per run — long transactions on 300k rows blow WAL and block other connections. Each season is independently idempotent.

**Weekly exception.** For `--season 2026 --week 3`, re-aggregate every completed week of the current season, not just week 3 — deals with in-season stat corrections. Cheap: 12 phases × ~18 weeks × few hundred rows each = <5s.

### 3.8 Freshness gate & retry

**Rewritten post-adversarial-review (finding #4): stateless primary + retry, shared freshness check, no cross-run GH API queries.**

**Gate logic** (invoked at the top of every ETL run, primary or retry):

1. **Off-season short-circuit.** If the current calendar date is between the day after the previous Super Bowl and the scheduled Week 1 kickoff of the next season (pulled via `load_schedules(next_season)`), write a `heartbeat` row and exit 0. No retry. (post-adversarial-review, finding #8.)
2. Fetch the current-season schedule from nflverse (`load_schedules`).
3. Identify "latest completed game" = max `game_date` where `game_date < today - interval '10 hours'` (Monday Night typically kicks off ~8:15 PM ET Monday; we want Tuesday 10 AM ET to find the Tuesday schedule stable).
4. Check our DB: `SELECT MAX(week) FROM games WHERE season = :current AND completed = true`.
5. If nflverse's latest-completed week > our DB's latest-completed week → fresh, **run the full ETL**.
6. Else → write a `heartbeat` row with `source_version` tagged `pending` and exit 0. No "retry me" signal to the workflow layer.

**Primary workflow** (`.github/workflows/etl.yml`): cron `0 14 * * 2` (10:00 ET Tue). Runs the ETL with the gate at the front.

**Retry workflow** (`.github/workflows/etl-retry.yml`): cron `0 18 * * 2` and `0 22 * * 2`. **Same script, same gate**. If the primary already ran fresh, the retry's gate exits at step 4 (DB max week already matches nflverse). No state sharing between runs required.

**Missed-week watcher** (`.github/workflows/etl-summary.yml`): cron `0 6 * * 3` (Wed 06:00 UTC ≈ late-Tuesday-night ET). Queries `meta_refresh`: if no `status='ok'` row exists for the current Tuesday (`started_at >= date_trunc('week', now())`), opens a GH issue with label `etl-failure-urgent`. Idempotent via issue title.

**DST handling.** Cron is UTC. 14:00 UTC ≈ 10:00 EDT / 09:00 EST. We accept a 1-hour drift in winter rather than run two cron entries. nflverse releases aren't on a sharp cutoff anyway.

### 3.9 `/status/data` endpoint + rate limiting

**Route handler**, edge runtime (smaller cold start, Vercel's preferred for auth/rate-limit middleware):

```typescript
// app/status/data/route.ts
export const runtime = 'edge';

export async function GET(req: Request) {
  const { success, reset } = await ratelimit.limit(ipOf(req));
  if (!success) return new Response('rate limited', { status: 429, headers: { 'Retry-After': reset.toString() } });

  const header = req.headers.get('x-admin-token') ?? '';
  const expected = process.env.STATUS_ADMIN_TOKEN ?? '';
  if (!expected || !constantTimeEqual(header, expected)) {
    return new Response('unauthorized', { status: 401 });
  }

  const params = queryParamSchema.parse(new URL(req.url).searchParams);
  const rows = await dal.getPhaseDistribution(params);
  return Response.json(rows, { headers: { 'Cache-Control': 'no-store' } });
}
```

**Auth:** static shared secret in `STATUS_ADMIN_TOKEN` (env var, Vercel prod only). Compared with `crypto.timingSafeEqual`. Token rotation = `vercel env add STATUS_ADMIN_TOKEN production` + redeploy; ~30s. Documented in `docs/runbook.md#status-data-auth` (new section).

**Rate limit:** `@upstash/ratelimit` + Upstash Redis (free tier: 10k req/day; we'll use ~50). Sliding-window, 60 req/min/IP. **Per-IP even when auth'd** — the token is shared, so a leaked token can't be used to amplify traffic.

**Gate to preview-only for 30 days** (post-adversarial-review, finding #3). For the first month after E2 ships, `/status/data` in the prod environment returns 404 unless the request comes from a Vercel preview deployment (detected via `VERCEL_ENV !== 'production'`). Prod consumers can hit the endpoint against a named preview URL. After the 30-day cooldown, flip the flag to enable prod responses behind the token + rate limit. Revisit the prod-gating decision after E3 ships real data pages.

**Access logging:** every `/status/data` hit emits a structured log line with `ip`, `ua`, `token_hash` (first 8 chars of a SHA-256 of the token — enough to attribute, not enough to replay), and `response_status`. A week of `vercel logs prod --since=7d | grep status/data` should show ≤ 10 req/day. Any spike → rotate the token. Rotation script + calendar reminder live in `docs/runbook.md#status-data-auth`.

Add to env:
```
STATUS_ADMIN_TOKEN=                 # 32-byte hex, rotate on leak
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

**Why Upstash Redis vs. Vercel KV:** Vercel KV is just rebranded Upstash Redis since 2024; the SDK accepts both URLs interchangeably. Pick Upstash direct to avoid the Vercel marketplace hop.

### 3.10 Pydantic drift check (Drizzle → Pydantic) — **E2-00b, new**

E1 deferred this. Now that we have 5 tables and 12-phase enum, drift risk is real.

**Implementation:**
1. Add `pnpm db:export-json` script: `drizzle-kit introspect` + write `db/schema.json` (summary: table names, column names, types).
2. Add `etl/tests/test_models_schema_sync.py`: reads `db/schema.json`, asserts every table has a matching Pydantic model in `etl/models.py`, every column name appears as a field, type categories match (text→str, int→int, timestamp→datetime, etc.). Runs in both `pytest` and a GitHub Actions step.
3. CI gate: a PR that edits `db/schema.ts` without updating `etl/models.py` **warns** in CI (non-blocking) through E2. Promote to blocking at the start of E4, when `players` + 2 rollup tables double the drift surface. (post-adversarial-review, finding #12.)

Cost: ~1.5 hours including tests. Pays for itself the first time Python silently writes a string where the DB wants an integer.

### 3.11 Observability during ETL

**Structured JSON logs** (already scaffolded in E1's `etl/main.py`). One line per phase computed:

```json
{"ts":"…","event":"phase_aggregated","phase":"pass_offense","season":2025,"week":14,"teams":32,"insufficient":0,"elapsed_ms":47}
```

One line per table loaded:
```json
{"ts":"…","event":"table_loaded","table":"plays","season":2025,"rows":51284,"elapsed_ms":9120}
```

One summary at end:
```json
{"ts":"…","event":"run_complete","status":"ok","total_ms":142830,"contract_tests":{"passed":9,"failed":0}}
```

**Sentry Crons** monitor slug `etl-weekly`; every run pings `sentry_sdk.crons.capture_checkin`. Failure beyond the SLA triggers a Sentry alert (already wired in E1-07/09).

**`/status` upgrade** in E2-12 reads `meta_refresh.row_counts` (JSONB) and renders a per-table grid: `plays: 51,284`, `games: 272`, `team_phase_weekly: 6,144`, etc.

---

## 4. E2E & contract tests — written upfront

Three harnesses:

### 4.1 Node unit — `tests/unit/status-data.test.ts`

```typescript
import test from 'node:test';
import assert from 'node:assert';
import { queryParamSchema, MAX_SEASON } from '@/lib/status-data/schema';

test('phase param must be in allowlist', () => {
  assert.throws(() => queryParamSchema.parse({ phase: 'nonsense', season: '2025' }));
});
test('season lower bound is 2020', () => {
  assert.throws(() => queryParamSchema.parse({ phase: 'pass_offense', season: '2019' }));
});
test('season upper bound is derived from today, not hardcoded', () => {
  // Upper bound = current year + 1 (accommodates Aug–Dec when the new season has started
  // but the calendar year isn't the "season year" per NFL convention).
  assert.ok(MAX_SEASON >= new Date().getFullYear());
  assert.throws(() => queryParamSchema.parse({ phase: 'pass_offense', season: String(MAX_SEASON + 10) }));
});
test('week optional; parses int if present', () => {
  const r = queryParamSchema.parse({ phase: 'pass_offense', season: '2025', week: '14' });
  assert.strictEqual(r.week, 14);
});
```

Dynamic upper bound (post-adversarial-review, finding #11) means we don't have to remember to bump this in 2027.

### 4.2 Data contracts — `etl/tests/contracts.py`

Runs as the final step of every ETL invocation. Any failure marks the run failed + records the failure in `meta_refresh.error_text`. Nine contract tests minimum (more may land when SQL is concrete):

| # | Assertion |
|---|---|
| 1 | Every completed REG game in `games` has ≥ 100 rows in `plays` (smoke check for a truncated load). |
| 2 | For each (season, week, phase) with ≥ 1 qualifying team: `COUNT(rank) = 32 - COUNT(insufficient_sample)` AND `SUM(rank) = K*(K+1)/2` where K is the same count. |
| 3 | No duplicates: `SELECT team, season, week, phase, COUNT(*) FROM team_phase_weekly GROUP BY 1..4 HAVING COUNT(*) > 1` returns 0 rows. |
| 4 | `team_phase_season[team=NE, phase=pass_offense, season=2025].epa_per_play` equals the recomputed value from pandas-on-polars baseline on the same plays within 1e-9 tolerance. |
| 5 | The full 2020–2024 backfill reruns produces 0 row-count delta across all four tables. |
| 6 | `meta_refresh.source_version` is non-null and matches the nflverse release tag pulled by `nflreadpy`. |
| 7 | No NULL EPA on completed REG games for `qb_dropback` or `rush_attempt` plays (nflverse has had schema wobbles; this guards). |
| 8 | Synthetic tiebreak fixture: two teams with identical EPA/play, plays, success rate → ordered by team ABC. |
| 9 | Synthetic insufficient-sample fixture: team with 5 plays in a phase → `rank=NULL`, `insufficient_sample=true`, and excluded from other teams' percentile denominator. |
| 10 | `meta_refresh.row_counts` contains expected keys `plays`, `games`, `team_phase_weekly`, `team_phase_season` and all non-zero. |
| 11 | ETL wall-clock duration < 10 min for `--full`, < 3 min for weekly. |
| 12 | **Golden-value anchor** (E2-11a): Pats season-end ranks across 2020–2025 for `pass_offense`, `rush_offense`, `overall_offense`, `pass_defense`, `run_defense` match hand-recorded values in `etl/tests/golden_values.yml` sourced from rbsdm.com / Sumer Sports. Catches the class of bugs contract #4 can't (source-data drift). |
| 13 | Team-abbrev normalization: `SELECT DISTINCT posteam FROM plays WHERE posteam IS NOT NULL` returns exactly 32 values, all in the canonical NFL-team allowlist. |
| 14 | Same as #13 for `defteam`. |

### 4.3 Playwright — `tests/e2e/e2.spec.ts`

```typescript
import { expect, test } from '@playwright/test';

test.describe('E2 smoke', () => {
  test('/status shows row counts after ETL heartbeat + full-load', async ({ page }) => {
    await page.goto('/status');
    // Heartbeat is always present post-E1; E2 adds row_counts grid once the
    // real ETL has run at least once in this env.
    const rowCountsSection = page.locator('dl[data-testid="row-counts"]');
    if (await rowCountsSection.isVisible()) {
      await expect(rowCountsSection).toContainText(/plays/);
      await expect(rowCountsSection).toContainText(/team_phase_weekly/);
    }
  });

  test('/status/data unauthenticated returns 401', async ({ request }) => {
    const res = await request.get('/status/data?phase=pass_offense&season=2025&week=1');
    expect(res.status()).toBe(401);
  });

  test('/status/data with bad params returns 400', async ({ request }) => {
    const res = await request.get('/status/data?phase=nonsense&season=2025', {
      headers: { 'x-admin-token': process.env.STATUS_ADMIN_TOKEN ?? 'not-set' },
    });
    expect(res.status()).toBe(400);
  });

  test('/status/data rate-limits after N requests/minute', async ({ request }) => {
    const token = process.env.STATUS_ADMIN_TOKEN;
    test.skip(!token, 'STATUS_ADMIN_TOKEN not set in this env');
    const url = '/status/data?phase=pass_offense&season=2025&week=1';
    const headers = { 'x-admin-token': token! };
    // Burst 65 to cross the 60/min bucket
    const codes: number[] = [];
    for (let i = 0; i < 65; i++) codes.push((await request.get(url, { headers })).status());
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
  });

  test('/status/data happy path returns 32 rows with ranks 1..K', async ({ request }) => {
    const token = process.env.STATUS_ADMIN_TOKEN;
    test.skip(!token, 'STATUS_ADMIN_TOKEN not set in this env');
    const res = await request.get('/status/data?phase=pass_offense&season=2025&week=1', {
      headers: { 'x-admin-token': token! },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as Array<{ team: string; rank: number | null }>;
    expect(body.length).toBe(32);
    const ranks = body.map((r) => r.rank).filter((r): r is number => r !== null).sort((a, b) => a - b);
    expect(ranks[0]).toBe(1);
    expect(ranks[ranks.length - 1]).toBe(ranks.length);
  });
});
```

The rate-limit test is skipped in CI unless `STATUS_ADMIN_TOKEN` is set; exercises against a local dev run and against prod on demand.

---

## 5. Task sequencing — critical path

18 open E2 tasks + 1 new (`E2-00b`). Dependencies as filed in beads match this plan with three adjustments noted in §8.

```
       ┌─────────────────────────────┐
       │ E2-01 ETL package skeleton  │  (already mostly landed in E1; verify + add nflreadpy deps)
       └────────────┬────────────────┘
                    │
    ┌───────────────┼─────────────────────────────┐
    ▼               ▼                             ▼
 E2-02 plays/   E2-03 team_phase_*            E2-00b Pydantic drift
 games schema  weekly/season schema           check (parallel)
    │               │                             │
    └──────┬────────┘                             │
           ▼                                      │
   E2-04 nflverse PBP pull + load                 │
           │                                      │
           ▼                                      │
   E2-05a Phase definitions doc                   │
           │                                      │
   ┌───────┼───────┬────────────┬─────────┐       │
   ▼       ▼       ▼            ▼         ▼       │
 E2-05b  E2-05c  E2-05d       E2-05e    (parallel)│
 off.    def.    situational  expl.+ST           │
   │       │       │            │                 │
   └───┬───┴───┬───┴────────────┘                 │
       ▼       ▼                                  │
   E2-06 Ranks + tiebreaks                        │
       │                                          │
       ▼                                          │
   E2-07 Sample-size guards                       │
       │                                          │
   ┌───┴───────┬────────┬─────────┐               │
   ▼           ▼        ▼         ▼               │
 E2-08      E2-09     E2-10    E2-11              │
 Freshness  Single   Backfill  Contract           │
 gate       txn      2020–24   tests              │
   │           │        │         │               │
   └────┬──────┴────────┴─────────┘               │
        ▼                                         │
   E2-12 /status upgrade + /status/data           │
   (depends on E2-13 Upstash Redis setup)         │
        │                                         │
        ├─ E2-13 rate-limit infra (new)           │
        │                                         │
        ├─ E2-14 Retry workflow                   │
        │                                         │
        └─ E2-15 Rollback playbook                │
                                                  │
        Sprint 2 demo gate: e2.spec.ts + contracts green on a full backfill.
```

**Critical path:** E2-01 → E2-02 → E2-04 → E2-05a → E2-05b/c/d/e (serial if sole dev) → E2-06 → E2-07 → E2-11 → E2-12. ≈16–20 hours wall clock.

**Parallel opportunities:**
- E2-00b Pydantic drift can be done any time after E2-02 lands.
- E2-13 rate-limit infra is pure TS, decouples from ETL; can be done Day 1.
- E2-14 Retry workflow is YAML-only, no DB dep.
- E2-15 Rollback doc writes up Neon PITR commands; independent.

**Realistic 2-week schedule:**

| Week | Focus |
|---|---|
| Week 1 Mon | E2-01 (verify), E2-02, E2-03 schemas + migrations; seed `phase_enum` |
| Week 1 Tue | E2-04 PBP pull; first successful load of 2025 into `dev` branch |
| Week 1 Wed | E2-05a phase definitions doc; E2-05b offensive base aggregation |
| Week 1 Thu | E2-05c/d/e remaining phase aggregations |
| Week 1 Fri | E2-06 ranks + tiebreaks; initial contract tests |
| Week 2 Mon | E2-07 sample guards; E2-10 full backfill 2020–24 |
| Week 2 Tue | E2-11 full contract test suite |
| Week 2 Wed | E2-08 freshness gate; E2-09 txn boundary audit; E2-00b Pydantic drift |
| Week 2 Thu | E2-13 Upstash rate-limit; E2-12 /status upgrade + /status/data |
| Week 2 Fri | E2-14 retry workflow; E2-15 rollback playbook; demo + retro |

---

## 6. Simplicity review

Applied "is this as simple as possible" to every decision:

| Decision | Simpler alternative? | Verdict |
|---|---|---|
| `nflreadpy` + polars | Direct `pyarrow.parquet.read_table(url)` — no wrapper. | Keep wrapper. ~30 lines vs owning schedule normalization, release tag lookup, roster joining. |
| Store 25 columns of plays, not 370 | Store everything; filter at query. | Keep subset. 300 MB vs 600 MB, and every added column = potential drift. |
| Composite PK `(game_id, play_id)` | Synthetic BIGINT surrogate + UNIQUE. | Keep composite. nflverse `play_id` is per-game unique; adding a surrogate = extra index for zero win. |
| Generated `is_redzone`, `is_third_down` | Compute at query time. | Keep generated. 12 aggregations × 300k rows = real win; storage cost negligible. |
| `pgEnum` for phase | VARCHAR + CHECK. | Keep enum. 4 bytes vs 8–20, and changing enum values is an explicit migration = honest constraint. |
| `ROW_NUMBER` not `RANK` | `RANK()` and tolerate ties. | Keep ROW_NUMBER. SPEC §3.5a explicitly requires deterministic final fallback. |
| Single Postgres txn (weekly) | Per-table txn chain. | Keep single. Weekly load is small; partial-commit debugging is the worst possible state. |
| Per-season commits (backfill) | One giant txn. | Keep per-season. WAL + connection-holding cost dominates. |
| Upstash Redis for rate limit | In-memory per-instance. | Keep Redis. Edge functions are stateless; memory limits don't exist. |
| `/status/data` as route handler, edge | As a server component page returning JSON. | Keep route handler. Pages get Next's RSC machinery we don't need. |
| Hand-written Pydantic models + drift check | Autogenerated Pydantic. | Keep hand-written + assert drift. Autogen tooling (`datamodel-code-generator`) gets us 80% but the remaining 20% (custom validators, literal types) we'd write anyway. |
| Freshness gate as separate CLI flag | Integrated into main flow. | Keep separate flag. Retry workflow calls it without running anything else. |

Items deliberately **NOT** adopted this sprint:
- **Materialized views for aggregates.** SQL-in-python executes fine; `REFRESH MATERIALIZED VIEW CONCURRENTLY` has its own pitfalls.
- **Incremental aggregation** (only recompute changed weeks). Full-current-season recompute is <5s; incremental adds bug surface for a 10x speedup we don't need.
- **dbt or SQLMesh.** 12 phase queries don't justify a transformation framework.
- **A separate `league_ranks` table.** Ranks live on `team_phase_*` directly; joining a second table per query would dominate the cost.
- **JSON Schema → Pydantic auto-codegen.** Drift check + hand-written is simpler and catches the same bugs.
- **Read replica for /status/data.** Neon's free tier has one compute; splitting reads is premature. Revisit when public traffic lands in E6.

---

## 7. Adversarial review

Run codex in challenge mode against this plan. Findings + verdict (accept / reject / defer) will be appended to `docs/plans/e2-data-ingest-plan-adversarial-review.md`. Expected topics to push on:

- Column subset on `plays` — will E4 find itself backfilling columns?
- `ROW_NUMBER` with team-ABC tiebreak — does this silently bias alphabetical-early teams in ties? (Answer: yes, but the tiebreak chain before it makes real ties vanishingly rare, and alphabetical is deterministic + interpretable.)
- Neon free-tier storage (500 MB) vs. 300 MB plays + indexes + aggregates.
- Upstash Redis adds a 3rd-party dep + secret surface before we have traffic.
- `/status/data` auth via static secret — still a leaky boundary, same critique codex made in E1. Counter: this is an admin endpoint with rate limit; risk is bounded at 60 req/min × whoever has the token.
- Full backfill being per-season: Neon idle-compute suspension might cause connection churn mid-transaction.
- Schedule freshness check relying on nflverse `load_schedules` — any chance it lags PBP?

---

## 8. Task set — status vs this plan

Cross-checking IMPLEMENTATION.md §3 + beads epic `patsbythenumbers-2lp` against this plan:

| Task | In beads? | Plan coverage | New info this plan adds |
|---|---|---|---|
| E2-00a (MetaRefresh Pydantic) | ✓ closed | §3.10 | already done in E1 |
| **E2-00b (Drizzle→Pydantic drift)** | ✗ **file new** | §3.10 | parallel to E2-02/03; CI check |
| E2-01 (ETL package skeleton) | ✓ | §3.1, §3.2 | add `nflreadpy`, `polars`, `pyarrow` to deps |
| E2-02 (plays/games schema) | ✓ | §3.3 | add `season_type`, generated `is_redzone`/`is_third_down`, `is_explosive_*` set on load |
| E2-03 (team_phase_* schema) | ✓ | §3.3 | add `insufficient_sample` column + `phase_enum` |
| E2-04 (PBP pull + load) | ✓ | §3.2 | confirm `nflreadpy` (not `nfl_data_py`); COPY-to-temp + UPSERT pattern |
| E2-05a (phase definitions doc) | ✓ | §3.4 | REG-only rule; kneel/spike/2PT exclusions; explosive-as-rate |
| E2-05b/c/d/e (phase aggregations) | ✓ | §3.5 | single `phases.sql` with parameterized phase + filter; ROW_NUMBER for determinism |
| E2-06 (ranks + tiebreak) | ✓ | §3.5 | ROW_NUMBER chain + percentile uses K not 32 |
| E2-07 (sample guards) | ✓ | §3.6 | rank NULL + excluded from percentile denominator |
| E2-08 (freshness gate) | ✓ | §3.8 | separate `--freshness-gate` CLI flag; exit code 2 |
| E2-09 (idempotent txn boundary) | ✓ | §3.7 | per-season commits for `--full`, single txn for weekly |
| E2-10 (backfill 2020–24) | ✓ | §3.7 | add 2025 to the same one-shot (history is static) |
| E2-11 (contract test suite) | ✓ | §4.2 | 11 assertions, not 8; dynamic K for rank sum |
| E2-12 (/status + /status/data) | ✓ | §3.9, §3.11 | Upstash rate-limit; constant-time auth; route handler edge runtime |
| **E2-13 (rate-limit infra)** | ✗ **file new** | §3.9 | Upstash Redis setup + `@upstash/ratelimit`; decouple from E2-12 |
| E2-14 (retry workflow) | ✓ | §3.8 | exit code 2 semantics + 3-strike issue creation |
| E2-15 (rollback playbook) | ✓ | — | runbook update; Neon PITR drill against dev branch |

**Tasks to add:**
- `E2-00b: Drizzle→Pydantic schema drift check` — parent `patsbythenumbers-2lp`, blocks E2-02 closure, parallel-safe after E2-02 lands. **Non-blocking in CI through E2; promoted to blocking at E4 kickoff.**
- `E2-11a: Golden-value anchor fixture` — parent `patsbythenumbers-2lp`, blocks `E2-11` closure. Hand-record Pats season-end ranks 2020–2025 from rbsdm / Sumer into `etl/tests/golden_values.yml`; contract test #12 asserts.
- `E2-13: /status/data rate-limit infra (Upstash)` — parent `patsbythenumbers-2lp`, blocks E2-12.

**Tasks whose acceptance/notes need updating** (via `bd update --notes`):
- `E2-02`: add "include `season_type` + `game_date`; generated `is_redzone`/`is_third_down`; set `is_explosive_*` on load; **include the full E4/E5/nfl4th-dep column set per plan §3.3**."
- `E2-03`: add "include `insufficient_sample` boolean; use `phase_enum`."
- `E2-04`: add "use `nflreadpy`, not `nfl_data_py`; COPY-into-temp + INSERT … ON CONFLICT DO UPDATE; **apply `TEAM_ABBREVIATION_ALIAS` normalization before load**."
- `E2-05a`: add "REG only; exclude kneels/spikes/2PT; **no garbage-time filter — document the choice**; explosive phase stores rate in `epa_per_play` slot per docs."
- `E2-06`: add "ROW_NUMBER, not RANK; `percentile = (K - rank + 1)/K` where K is teams meeting threshold."
- `E2-08`: add "**off-season short-circuit: exit 0 (heartbeat) when calendar date is between post-Super Bowl and next Week 1 kickoff**."
- `E2-09`: add "**acquire `pg_try_advisory_xact_lock(8675309)` at run start; exit 0 if not acquired**."
- `E2-12`: add "route handler (not a page), edge runtime, Upstash rate-limit, constant-time auth, **gated to preview-only for first 30 days per plan §3.9**. Depends on E2-13."
- `E2-14`: add "**stateless primary+retry, both run same freshness-gate; kill cross-run GH API queries; `etl-summary.yml` Wed 06 UTC opens issue if no ok-row since last Tuesday**."

---

## 9. Open risks for Sprint 2

| Risk | Mitigation |
|---|---|
| `nflreadpy` has an unknown-to-us bug on a corner season | Fall back to direct `pyarrow.parquet.read_table(url)`; both paths go through the same COPY loader. Decision branch is 20 lines. |
| Neon free tier (500 MB) overflows with 300 MB of plays + 150 MB of indexes | Budget for the $19/mo Launch tier from day 1; alert fires at 80%. Document in `docs/budget.md`. |
| nflverse PBP schema shifts mid-backfill | Contract test #7 catches NULL-EPA regressions; source_version pin in `meta_refresh` lets us bisect. |
| `ROW_NUMBER` tiebreaks alphabetical bias (ARI < SEA) | Accept. The EPA/plays/success chain reduces real-tie frequency to a rounding-error percentage; alphabetical is interpretable and stable. |
| Upstash Redis outage takes down `/status/data` | Route handler fails closed (returns 503); `/status` itself doesn't depend on Redis. |
| Full backfill trips Neon idle-compute suspension mid-transaction | Per-season commits keep each txn <1 min; if suspension still bites, schedule backfill during on-compute window. |
| Weekly refresh dark-launches through summer 2026 | Acceptable. First real proof is the 2026 W1 Tuesday; book a 1-hour slot that morning. |
| `pg_enum` add-value requires ALTER TYPE which can't run inside a transaction in some Postgres versions | Fix phases enum at creation time with all 12 values. Adding a 13th later requires a separate migration — accepted. |
| `nfl4th` needed in E5 may force a pandas resurrection | Out of scope for E2. E5 evaluates rpy2 vs Python port. |
| Per-PR preview DB still absent (E1 decision) | Schema changes this sprint get tested on `dev` branch before prod migrate per `docs/runbook.md#schema-changes`. |

---

## 10. Sprint 2 exit criteria

Split again into automated and operator-verified.

### Automated (verified by `contracts.py` + `tests/e2e/e2.spec.ts` running in CI on push to main)

- All 11 data contract tests green on a full-backfill execution against `dev` Neon branch.
- Full-backfill wall-clock < 10 min.
- Weekly-refresh wall-clock < 3 min (tested by running `--season 2025 --week 18` twice back-to-back and comparing).
- `tests/e2e/e2.spec.ts`: `/status/data` unauth → 401, bad params → 400, burst → 429 returns present, happy path returns 32 rows with ranks 1..K.
- `tests/unit/status-data.test.ts`: zod schema rejects out-of-allowlist phase and out-of-range season.
- Drift check CI gate (E2-00b) green on a synthetic drift PR (add a column to `db/schema.ts` without touching `etl/models.py`) → CI fails.

### Operator-verified (checklist in `docs/sprint-2-exit.md`)

- 18 open E2 beads closed + the 2 new (E2-00b, E2-13) closed (`bd stats` shows 0 open under epic `2lp`).
- `/status` on prod shows real row counts (plays ≈ 300k, games ≈ 1.6k, team_phase_weekly ≈ 6.1k, team_phase_season ≈ 2.3k).
- A manual `workflow_dispatch` of `etl.yml` with `--freshness-gate` on an out-of-season Tuesday correctly exits with code 2.
- A manual `workflow_dispatch` of `etl-retry.yml` after three consecutive exit-2s opens a GitHub issue labeled `etl-failure-urgent`.
- Neon PITR restore drill on the `dev` branch from a known-good snapshot completes and row counts match pre-drill state.
- `docs/runbook.md#etl-rollback` has a concrete command sequence verified by the drill.
- `docs/runbook.md#status-data-auth` documents token rotation commands.
- Upstash Redis free-tier metrics show < 1000 req/day with no rate-limit false positives.

E2 is done when **both buckets are green** and a full backfill has run end-to-end on prod once, populating all four tables.
