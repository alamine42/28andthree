# Feature: E2 — Data Ingest & League Aggregates

**Epic ID:** `patsbythenumbers-2lp`
**Date:** 2026-04-18 → 2026-04-19 (build + prod backfill + polish)
**Author:** Mehdi El-Amine + Claude Opus 4.7

## Summary

Load every regular-season play of 2020–2025 NFL history into Neon, roll up 12
phases of play (per SPEC §3.2) into weekly and season-long team rankings with
deterministic tiebreaks, and expose an authenticated admin JSON endpoint for
debugging. Weekly cron + two retry windows + a Wednesday watcher ship the
operational story end-to-end.

## Context & Motivation

### Problem Statement

E1 gave us a deployed Next.js app with a live ETL heartbeat writing to
`meta_refresh`, but no actual data. Every later epic (E3 home page, E4 player
deep-dives, E5 coaching tendencies) needs the raw play-by-play in Postgres —
and needs a trustworthy league-wide ranking substrate that we can't fake or
approximate. E2 is that substrate.

### User Story

Not directly user-facing this sprint. The "user" of E2 is the next sprint:
E3 queries `team_phase_season` to render the home-page rank cards; E4
queries `plays` to build QB rollups; E5 queries `plays` + coaching rollups
(a later ETL extension) to render tendency charts. If E2's aggregation logic
or sample-size rules are wrong, every later epic ships wrong numbers dressed
up with charts.

### Prior Art

- Pre-existing: heartbeat-only `etl/main.py` from E1, writing one row per run
  to `meta_refresh`.
- Industry precedent for phase aggregation: rbsdm.com, FTN Fantasy, Sumer
  Sports. Our filters match theirs within the "no garbage-time filter" policy
  choice (documented in `docs/phase-definitions.md` §1.3).
- **Explicitly rejected:** `nfl_data_py` (doesn't build on Python 3.12; see
  `docs/solutions/build-errors/nfl-data-py-pandas-python-312-build-failure.md`).
  Replaced with `nflreadpy` + `polars` + `pyarrow`.

## Architecture & Design

### High-Level Design

```
 ┌────────────────────┐
 │ GH Actions cron    │  Tue 10:00 ET + 14:00 + 18:00 retries
 │  etl/main.py       │
 └──────┬─────────────┘
        │ nflreadpy.load_pbp() / load_schedules()
        ▼
 ┌────────────────────┐
 │ polars → Pydantic  │  normalize_plays / normalize_games
 │ (pure transforms)  │  + WSH→WAS, LA→LAR normalization
 └──────┬─────────────┘
        │ COPY-into-_plays_staging + INSERT ON CONFLICT
        ▼
 ┌────────────────────────────────────────────────────┐
 │  Neon Postgres (prod `main` branch)                │
 │   games              ~1,600 rows                   │
 │   plays              ~295k rows (6 seasons)        │
 │   team_phase_weekly  ~38k rows (32×18×12×6)        │
 │   team_phase_season  ~2.3k rows (32×12×6)          │
 │   meta_refresh       run log                       │
 └──────────────────────┬─────────────────────────────┘
                        │ Drizzle / typed Node server components
                        ▼
              /status, /status/data (Next.js)
```

### Key Components

| Component | Location | Purpose |
|---|---|---|
| Shared constants (TS) | `lib/constants/{phases,teams}.ts` | 12 phase slugs + 32 team abbreviations + `normalizeTeamAbbr` |
| Shared constants (Python) | `etl/constants.py` | Python mirror; the `PHASES` + `NFL_TEAMS` tuples stay in sync by the E2-00b drift check |
| Schema (DDL) | `db/schema.ts`, `drizzle/0002_*.sql`, `drizzle/0003_*.sql` | `games`, `plays` (~40 cols), `team_phase_weekly`, `team_phase_season`, `phase_enum` |
| Pydantic models | `etl/models.py` | Shape checked against Drizzle snapshot by `etl/tests/test_schema_sync.py` |
| Ingest (pure transforms) | `etl/ingest/nflverse.py` | `fetch_pbp` / `fetch_schedules` / `normalize_plays` / `normalize_games` |
| Loader | `etl/load/plays.py` | COPY-to-staging + UPSERT for plays; executemany UPSERT for games |
| Transform | `etl/transform/phases.py` | Single `_build_phase_sql(granularity)` driving both weekly + season rollups |
| Freshness gate | `etl/freshness.py` | Off-season short-circuit, nflverse-stale detection, already-loaded skip |
| Orchestrator | `etl/main.py` | Advisory lock, per-season commits, `meta_refresh` running/ok/failed lifecycle |
| Status UI | `app/status/page.tsx` | Row-counts grid with human-readable labels |
| Admin JSON API | `app/status/data/route.ts` | Edge runtime, constant-time auth, Upstash sliding-window rate limit, preview-only gate |
| Rate limiter | `lib/status-data/ratelimit.ts` | `@upstash/ratelimit` + `@upstash/redis`; permit-all fallback for local dev |
| Contract tests | `etl/tests/test_contracts.py` | 14 assertions, run after every ETL |
| Golden values | `etl/tests/golden_values.yml` | 30 anchored Pats season ranks (2020–2025 × 5 core phases) |

### Data Model Changes

New tables (migration `0002_0002_e2_plays_games_phases.sql` + indexes in `0003_*`):

- `games` (12 cols, text PK `game_id`, `REG`/`POST` CHECK).
- `plays` (~40 cols, composite PK `(game_id, play_id)`; E4/E5/nfl4th-dep
  columns pulled in up-front to avoid 3–4 backfills mid-project — see plan
  §3.3 and review finding #1).
- `team_phase_weekly` — unique `(team, season, week, phase)`.
- `team_phase_season` — unique `(team, season, phase)`.
- `phase_enum` — 12 values (Postgres enum type).
- Partial indexes on `plays` for red-zone / third-down / ST (hand-written 0003
  migration — drizzle-kit can't emit partials).

### API Changes

- New endpoint: `GET /status/data?phase=<slug>&season=<year>[&week=<n>]`
  - Auth: `x-admin-token` header, constant-time compare via `crypto.timingSafeEqual`
  - Rate limit: Upstash sliding window, 60 req/min/IP
  - Preview-only gate in prod through 2026-05-18 (fails 404 in `VERCEL_ENV=production` before that)
  - Empty-params GET returns a usage-hint JSON (added in polish pass)
- `/status` page: added row-counts grid (data-testid="row-counts") with
  human-readable labels.

## Implementation Details

### Files Changed

Net footprint: **6,951 insertions, 105 deletions across 49 files** (six commits over two days):

- `db/schema.ts` — +5 tables, +12-value enum.
- `drizzle/0002_0002_e2_plays_games_phases.sql`, `drizzle/0003_0003_e2_plays_indexes.sql` — applied to prod on 2026-04-19.
- `lib/constants/phases.ts`, `lib/constants/teams.ts` — new shared constants modules.
- `lib/status-data/{schema,ratelimit,dal}.ts` — endpoint building blocks.
- `app/status/data/route.ts` — the route handler.
- `app/status/page.tsx` — row-counts grid + label formatter.
- `etl/constants.py`, `etl/models.py` — Python mirrors.
- `etl/ingest/nflverse.py` — fetch + normalize.
- `etl/load/plays.py` — COPY+UPSERT.
- `etl/transform/phases.py` — single-builder aggregation SQL.
- `etl/freshness.py` — freshness gate.
- `etl/main.py` — full orchestration.
- `etl/tests/*` — 6 new test files (ingest, freshness, aggregation, contracts, schema sync, constants).
- `.github/workflows/etl.yml` — rewritten.
- `.github/workflows/etl-retry.yml`, `etl-summary.yml` — new workflows.
- `docs/phase-definitions.md` — versioned contract.
- `docs/runbook.md` — +etl-rollback, etl-failure, status-data-auth sections.
- `docs/plans/e2-data-ingest-plan.md` + adversarial-review — reference.

### Key Decisions

1. **`nflreadpy` + polars + pyarrow.** Replaces `nfl_data_py` (Python 3.12
   incompatible). Dropdown to direct parquet via pyarrow if `nflreadpy`
   becomes stale — the wrapper is thin.
2. **Column subset widened up front.** Plans §3.3 lists 40 columns including
   E4/E5/nfl4th-dep fields. Adding a column later costs a 10-min backfill,
   and doing that 3–4 times during the project is friction we can avoid for
   ~25 MB of extra storage.
3. **`ROW_NUMBER` with rounded tiebreak, not `RANK`.** SPEC §3.5a mandates a
   deterministic final fallback (team alphabetical). `ROUND(epa, 6)` in the
   ORDER BY prevents floating-point noise (AVG of 0.3 over 25 rows ≠ AVG
   over 15 rows) from pre-empting the plays-count tiebreak.
4. **Single `_build_phase_sql(granularity=)` for weekly + season.** The
   fullreview pass caught a divergence (season was missing the ROUND fix) —
   now one builder drives both, can't drift again.
5. **Advisory lock `pg_try_advisory_xact_lock(8675309)`** prevents concurrent
   manual-dispatch + cron interleaving.
6. **Per-season commits for `--full` backfill.** Keeps WAL bounded, lets
   partial progress survive interruption.
7. **Contract tests as the primary test surface.** 14 assertions run after
   every ETL; the rank-sum identity + team-allowlist checks caught the `LA`
   split on the very first prod run.
8. **Golden-value anchoring.** 30 Pats entries committed as baseline; any
   aggregation-logic drift (filter change, rank edit) will fail contract
   test #12. Entries can be upgraded to external (rbsdm) sources per-row.
9. **Preview-only gate on `/status/data`.** E1 rejected the static-token
   pattern because the endpoint had no consumer. E2 has a consumer (the
   builder) so it ships — but gated to preview envs for 30 days to
   demonstrate traffic patterns before promoting to prod. Cutover: 2026-05-18.

### Tradeoffs Considered

| Option | Pros | Cons | Decision |
|---|---|---|---|
| `nflreadpy` | Maintained, polars-native, no pandas pin | Newer / less battle-tested | **Chosen** |
| Direct parquet fetch | No wrapper | ~30 lines to own | Fallback path only |
| `nfl_data_py` | Familiar name | Doesn't build on py3.12 | Rejected |
| RANK (allow ties) | Simpler SQL | SPEC §3.5a requires deterministic order | Rejected |
| ROW_NUMBER + team ABC | Deterministic | Very slight alphabetical bias on true ties | **Chosen** |
| Two SQL builders (weekly, season) | More direct code | Drift risk (proven in polish pass) | Rejected |
| One parameterized builder | Shared semantics | Slightly more meta-SQL | **Chosen** |
| Incremental aggregation | Faster on weekly refresh | Bug surface for a 10× speedup we don't need | Rejected |
| Full recompute each week | Simple, guaranteed correct | ~5s per refresh | **Chosen** |

## Testing

### Test Coverage

- **Node unit:** 39 tests across `lib/env`, `lib/db`, `lib/constants/phases`,
  `lib/constants/teams`, `lib/status-data/schema`.
- **Python unit:** 61 tests across constants, ingest normalizers + fetch
  mappings, freshness gate (pure / stubbed conn), models, schema sync.
- **Python integration:** 9 tests against a local Postgres for the
  aggregation SQL (rank contiguity, tiebreak chain, sample-size guards, 
  idempotency, kneel exclusion).
- **Python contract:** 14 assertions; runs at the end of every ETL invocation
  via `.github/workflows/etl.yml`.
- **Playwright E2E:** 6 specs for `/status` + `/status/data` (gracefully
  skip when `STATUS_ADMIN_TOKEN` not set).

### Manual Testing Steps

Executed during this session:
1. ✅ Applied migrations 0002 + 0003 to prod Neon.
2. ✅ Provisioned Upstash Redis; verified SET/GET round-trip.
3. ✅ Set `UPSTASH_REDIS_REST_URL/TOKEN`, `STATUS_ADMIN_TOKEN` in Vercel
   prod + preview.
4. ✅ Ran `--full` backfill against prod (three times, due to the nflverse
   quirks). Final run clean: 295k plays, 1.6k games, 38k weekly rollups,
   2.3k season rollups.
5. ✅ 13 of 13 contract tests pass on prod data.
6. ✅ Sanity-checked Pats ranks against memory (2025 pass O rank 1, 2023
   pass O rank 31, 2020 rush O rank 4, etc. — all match).

## Security Considerations

- `/status/data` uses `crypto.timingSafeEqual` for constant-time token
  comparison — no early-exit timing oracle.
- Preview-only gate through 2026-05-18 limits exposure while we watch
  traffic patterns.
- Rate limiter (Upstash, 60 req/min/IP) caps the amplification factor of
  a leaked token.
- Access log emits `sha256(token).slice(0,8)` — enough to attribute requests
  to a source without enabling replay if logs leak.
- `etl_writer` Neon role has no DDL rights (docs/runbook.md#db-roles) —
  a compromised ETL container can't `DROP TABLE`.
- Advisory lock (`pg_try_advisory_xact_lock(8675309)`) prevents concurrent
  write storms that could bypass the `ON CONFLICT` idempotency guard.
- Every inbound query param validated with zod before it touches the DAL;
  phase slug is a hard enum, season + week are numeric-range-bounded.

## Future Improvements

- [ ] **Upgrade golden values from `source=self` to `source=rbsdm`.** The
  self-baseline catches aggregation-logic drift but not source-data drift.
  ~15 min of manual cross-checking against rbsdm.com/stats/stats would
  strengthen contract test #12.
- [ ] **Promote `/status/data` to prod when the preview window closes
  (2026-05-18).** Flip the `PREVIEW_ONLY_GATE_END_MS` constant or remove
  the gate entirely.
- [ ] **Add participation-data join to ingest** when E4 lands — the
  `was_pressure`, `pre_snap_motion`, `personnel_offense`, etc. columns
  are NULL in the current plays table because nflreadpy's base PBP load
  doesn't include them. `nflreadpy.load_participation()` is the other half.
- [ ] **Record an rbsdm / Sumer Sports ranking link per phase** in
  `docs/phase-definitions.md` so the filter-change procedure is
  "look here, verify our ranks still match."
- [ ] **E2-00b drift check promoted to blocking** at E4 kickoff when players
  + rollup tables double the drift surface.
- [ ] **ETL participation + load_players** to populate `players` table in
  preparation for E4.

## Related

- **Beads epic:** `patsbythenumbers-2lp` (22/22 closed)
- **Tasks that stayed open during build, then closed:** E2-00b Pydantic drift,
  E2-11a golden values, E2-11 contract suite, E2-12 /status/data, E2-13
  Upstash rate-limit infra
- **Related features:** E1 Foundation & Infrastructure (the substrate this
  built on); upcoming E3 Team Overview & Phase Pages (the first consumer)
- **Plans:** `docs/plans/e2-data-ingest-plan.md`,
  `docs/plans/e2-data-ingest-plan-adversarial-review.md`
- **Phase filters:** `docs/phase-definitions.md` (versioned contract)
- **KB:** `docs/solutions/gotchas/nflverse-schema-quirks.md` (three quirks
  uncovered during prod backfill)
- **Runbook:** `docs/runbook.md#etl-rollback`, `#etl-failure`,
  `#status-data-auth`
