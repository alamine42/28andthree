# 28 and Three — Implementation Plan

> Source-of-truth documents: `SPEC.md` (product + technical spec), `DESIGN.md` (design system). Read both before picking up any task.

This document breaks the project into **7 epics** (E0 prerequisites + E1–E6) spanning **a prep week + 6 two-week sprints** (13 weeks total). Every task listed below is **atomic, committable, testable**. Each sprint ends with a demoable increment.

> **Revision note:** v2 after an independent plan review. Key changes: added Epic 0 prerequisites, split load-bearing tasks (E2-05, E4-02, E5-08) by domain, added buffer between feature sprints and launch, documented Drizzle vs. psycopg DDL/DML ownership, added Neon branch-per-PR strategy, dropped light mode (SPEC §11 defers it), formalized runbook and cost monitoring.

---

## 0. Cross-cutting standards

These apply to every task unless explicitly waived.

### 0.1 Definition of Done (per task)
A task is done when **all** of the following are true:
1. Code is merged to `main` via PR (no direct pushes).
2. All new code paths have a test or a documented validation (see §0.3).
3. `bun run typecheck`, `bun run lint`, `bun run test` all pass locally and in CI.
4. Any UI change has been checked against `DESIGN.md` tokens/conventions (no hard-coded hex, no off-spec spacing).
5. Any ETL / data-integrity change has updated or added a data-contract test (§0.3).
6. PR description references the task ID and the acceptance criteria it satisfies.
7. Post-merge: Sentry error rate on `main` monitored for 24h; any regression triggers a revert, not a forward-fix.

### 0.2 Branch & PR conventions
- Branch naming: `<epic>/<task-id>-<kebab-slug>` e.g., `e2/e2-04-phase-aggregation-sql`.
- PR title: `[E<epic>-<task>] <subject>` e.g., `[E2-04] Phase aggregation SQL with tiebreaks`.
- PRs must link the task and be < 400 lines of diff where possible. Larger PRs require an explicit "why this is atomic" note.

### 0.3 Test / validation requirements
For each task, exactly one of:
- **Unit test** for pure transforms.
- **Data contract test** for ETL steps (assertions that run at the end of every ETL execution; failing one fails the workflow).
- **Playwright smoke E2E** for user-facing pages.
- **Documented manual validation** only if none of the above applies (rare; require reviewer sign-off).

Per `SPEC.md` §8: unit tests are not pursued for their own sake. Data contract tests + E2E are the backbone.

### 0.4 Performance budgets
Measured on the per-sprint demo branch with Lighthouse CI on preview URLs:
- **LCP** ≤ 2.0s (mobile, 4G throttle).
- **CLS** ≤ 0.05.
- **Total JS** < 180 KB gzipped for the home page, < 250 KB for data-heavy pages.
- **DB query budget (server render)**: each page ≤ 6 SQL round-trips, no warm-path query > 150ms p95 (Neon serverless cold starts excluded; measured warm only).
- **ETL budget**: full weekly run < 10 minutes end-to-end (nflverse pull + transforms + load + contract tests).

### 0.5 Security review (per epic, sign-off before closing)
Minimum checklist, completed by the epic owner:
- All SQL goes through parameterized queries or the query builder (no string concat).
- No secrets in code, `.env.example` kept current, Vercel + GH Actions secrets audited.
- Sentry PII scrubbing rules configured (scrub emails, IPs where not needed).
- CSP header set; `Content-Security-Policy-Report-Only` exercised in preview before promoting.
- Public endpoints have basic rate limits (Vercel Edge Middleware) — this is a public site, no auth, but `/api/*` and `/status/*` endpoints must not be a free amplification vector. `/status/data` admin JSON dump is rate-limited from day one.
- Dependency audit: `bun audit` clean (0 high/critical). License audit: no GPL in the frontend bundle.
- Data source licensing: nflverse attribution present on every page footer's methodology link; ESPN/NFL public endpoint terms re-read before each epic ships.

### 0.6 E2E coverage per epic
Each epic must ship with at least one Playwright E2E test that exercises the full happy path user flow introduced by that epic (not per-task — per-epic). These accumulate into the launch E2E suite.

### 0.7 DB ownership (DDL vs. DML)
- **DDL (schema)** is owned exclusively by **Drizzle migrations** in `/db/schema.ts` + `/db/migrations/`. Python never creates or alters tables. Migrations run via `bun run db:migrate` in CI on merge to `main`.
- **DML (data)** in the ETL is owned by Python via `psycopg`. Python reads the live schema but never migrates it.
- Drizzle-kit generates TypeScript types consumed by Next.js server components; Python has a parallel Pydantic model in `etl/models.py` that MUST be regenerated from Drizzle's JSON schema on every PR that touches `/db/schema.ts` (CI check enforces this).

### 0.8 Neon branch-per-PR
- Production: Neon `main` branch.
- Dev shared: Neon `dev` branch (for local development + Sprint 1 demos).
- Per-PR previews: Neon's Vercel integration auto-creates a branch per PR, destroyed on PR close. Preview apps read/write the per-PR branch.
- ETL running in GH Actions always targets `main` (prod) on Tuesday 10am ET. `dev` gets a weekly mirror from prod each Monday.
- No two previews ever share a DB.

### 0.9 Quota / cost monitoring
Budget alerts at 50% and 80% utilization on:
- Neon storage (free tier 0.5 GB — tight; paid tier likely needed).
- Neon compute hours.
- Vercel bandwidth + function invocations.
- GitHub Actions minutes (ETL + CI combined).
- Sentry event quota (free tier 5K/month — can blow in an hour on a bad deploy).
- Fontshare / Google Fonts — monitor for ToS changes.
Tasks E0-05 (account setup) and E1-14 (budget alerts wired) cover this.

---

## 1. Sprint overview

| Sprint | Weeks | Epic(s) | Demo |
|---|---|---|---|
| S0 | 0 (prep) | E0 Prerequisites | All accounts, domain, secrets, brand checks done before Sprint 1 kickoff. |
| S1 | 1–2 | E1 Foundation & Infra | App shell renders at dev URL with DESIGN.md tokens applied; empty `/status` page deployed to Vercel preview; Neon branch-per-PR working. |
| S2 | 3–4 | E2 Data Ingest & League Aggregates | Weekly ETL runs end-to-end on 2020–2025 data; all 12 phase aggregations visible as a raw JSON admin dump at `/status/data`. |
| S3 | 5–6 | E3 Team Overview & Phase Pages | Home page + 12 phase detail pages live with real 2025 data. Click any phase from home → detail page works. |
| S4 | 7–8 | E4 Player Deep Dives | QB, skill, defense unit, OL/DL pages live. Top contributors wired into phase pages. |
| S5 | 9–10 | E5 Pats Differentiators | Draft ROI page (2021–2025). Coaching tendency dashboard (play-call + 4th down via `nfl4th` + blitz + tempo + personnel). |
| S6 | 11–12 | E6 Polish & Launch | Methodology, OG images, mobile pass, perf hunt, CSP, rate limits, runbook, 48h soft-launch, public launch at end of S6. |

Each sprint ends on a Friday with a 1-hour demo + retro. Prep week (S0) is 3–5 working days before S1 starts.

---

## 1a. Epic 0 — Prerequisites (Prep Week)

**Goal:** Every account, domain, secret, and legal check is in place **before** Sprint 1 starts. No "oh wait, we need X" blocks on a Friday afternoon in Sprint 1.

**Success criteria:**
- All accounts created, owner identified, 2FA enabled.
- Domain registered + DNS ready to point at Vercel.
- USPTO TESS search on "28 and Three" complete with no blocking marks.
- Font, headshot CDN, and nflverse licensing confirmed in writing (even if free).
- GitHub repo created, main-branch protection on, secrets inventory started.

**No E2E at this stage.** No perf. Security review: confirm all new accounts have 2FA + strong passwords in the password manager.

### Tasks

| ID | Subject | Description | Test / validation |
|---|---|---|---|
| E0-01 | Domain registration | Register `28andthree.com` (or fallback). 1-year minimum. Keep WHOIS private. Note fallbacks: `.app`, `.io`. | Domain resolves (no DNS yet). |
| E0-02 | USPTO TESS brand check | Search USPTO TESS for exact marks + similar ("28 and 3", "Twenty Eight and Three"). If any blocking mark exists, escalate to counsel before building. | Search printouts archived; decision recorded. |
| E0-03 | nflverse license review | Confirm nflverse public-domain / MIT license permits commercial-style use. Attribution confirmed as required. | Link to license in `/docs/licenses.md`. |
| E0-04 | Fontshare + Google Fonts ToS check | Confirm Cabinet Grotesk (Fontshare) + Geist (Google) both permit public-site embedding. Self-hostable WOFF2 backup downloaded. | WOFF2 files in `/public/fonts` as backup. |
| E0-05 | Account provisioning | Create orgs / accounts on: GitHub, Vercel, Neon, Sentry, Fontshare, Plausible (or Vercel Analytics). All with 2FA. | Login confirmed; recovery codes archived. |
| E0-06 | NFL CDN headshot policy check | Confirm NFL public CDN headshot usage is acceptable for non-commercial fan use; document fallback (initials avatar). If unclear, default to initials-only for v1. | Written decision in `/docs/licenses.md`. |
| E0-07 | Password manager + secrets vault setup | Choose vault (1Password / Bitwarden). Invite team. Document which secrets live where. | Vault item templates created. |
| E0-08 | GitHub repo + branch protection | Create repo. Protect `main`: PR required, 1 review (or 1 CC review), CI green, no force-push. Add CODEOWNERS stub. | Attempt direct push to main → blocked. |
| E0-09 | Basic cost budget document | Write `/docs/budget.md`: estimated monthly cost across Neon, Vercel, Sentry, GH Actions, domain. Target: < $25/mo for v1. | Doc exists; thresholds agreed. |

**Prep-week deliverable:** `/docs/preflight.md` with each E0 task linked to its evidence. Sprint 1 does not start until this is green.

---

## 2. Epic 1 — Foundation & Infrastructure

**Goal:** A deployed Next.js app wired to Neon and GitHub Actions, with the DESIGN.md system applied, so every later epic just adds features instead of re-paving.

**Success criteria:**
- Vercel preview URL live from PR #1 onward.
- Neon database created with `meta_refresh` table; app server-side queries it on `/status`.
- GitHub Actions ETL workflow exists and runs (may be a no-op that writes a heartbeat to `meta_refresh`).
- DESIGN.md tokens compiled into Tailwind config; at least one component (the top nav + footer) consumes them.
- Sentry capturing errors in preview.
- Playwright runs in CI and passes one smoke test.
- Lighthouse CI runs in CI.

**E2E test (epic-level):** `e1.spec.ts` — loads `/` in preview, verifies nav renders with wordmark, footer disclaimer present, `/status` loads and shows "no data yet" state without errors.

**Performance check:** Home shell LCP < 1.2s (mostly empty), bundle < 100 KB gzipped.

**Security review:** initial pass on §0.5 items; establish `.env.example`, Vercel secret inventory, and GitHub repo secrets.

### Tasks

| ID | Subject | Description | Test / validation | Est. (CC) |
|---|---|---|---|---|
| E1-01 | Initialize repo + tooling | `bun init`, Next.js 15 App Router + TypeScript, ESLint, Prettier, `bun.lockb` committed. `tsconfig.json` strict. Add `.gitignore`. | `bun run typecheck && bun run lint` pass on empty project. | 20m |
| E1-02a | Wire Tailwind + DESIGN.md tokens | Install Tailwind 4. Generate `tailwind.config.ts` with all 14 dark-mode tokens + 11 light-mode tokens, font families, spacing scale, radius scale from DESIGN.md. Add `app/globals.css` with CSS variables for dark/light. | Typecheck; a `/tokens` internal route renders one swatch per token; Playwright asserts every token resolves to a non-empty computed value. | 50m |
| E1-02b | Load fonts via `next/font` | Cabinet Grotesk self-hosted WOFF2 from `/public/fonts` (from E0-04). Geist + Geist Mono via `next/font/google`. No external `<link>` tags. | Playwright: computed font-family on `body` is Geist; `h1` is Cabinet Grotesk; no network request to fonts.googleapis.com at runtime. | 40m |
| E1-02c | Token visual snapshot baseline | Playwright visual snapshot of `/tokens` in dark + light. Locked into PR diffs. | Snapshot file committed; intentional DESIGN.md changes require updated baseline. | 30m |
| E1-03 | Build top nav + footer components | `components/SiteHeader.tsx` with wordmark (italic amber "and"), nav links (Team/Phases/Players/Draft/Coaching), theme toggle. `components/SiteFooter.tsx` with live dot, update timestamp (placeholder), disclaimer from DESIGN.md. | Playwright: renders on `/`, nav links have correct `href`, disclaimer text matches DESIGN.md disclaimer verbatim. | 30m |
| E1-04 | Root layout + `/` placeholder + `/status` stub | `app/layout.tsx` mounts header + footer. `app/page.tsx` is "Season starts soon" placeholder. `app/status/page.tsx` is a server component that queries `meta_refresh` and renders last-run info or "never run." | Playwright: `/` and `/status` both return 200, no client-side errors in console. | 25m |
| E1-05 | Set up Neon dev + prod branches | Create Neon project. Two branches: `main` (prod), `dev`. Document connection strings in `.env.example`. Document Vercel integration for preview-per-PR branches. | Manual: `psql` connect to both branches succeeds. Documented in `README.md`. | 20m |
| E1-06 | First Drizzle migration: `meta_refresh` | Install Drizzle ORM + drizzle-kit. `db/schema.ts` with `meta_refresh` table: `id`, `started_at`, `completed_at`, `status`, `season`, `week`, `source_version`, `row_counts jsonb`, `error text`. Migration runs on `main` + `dev`. | Unit test: schema compiles; Drizzle introspection matches expected columns. | 35m |
| E1-07 | Sentry integration | `@sentry/nextjs` installed. `sentry.client.config.ts` + `sentry.server.config.ts`. Release tagging via `SENTRY_RELEASE` in CI. PII scrubbing: drop `Cookie`, `Authorization`, emails. | Deploy to preview, trigger a handled error from `/status?debug=boom`, verify event in Sentry. | 30m |
| E1-08a | Playwright harness | `playwright.config.ts` with chromium + webkit + firefox + mobile-chrome (Pixel 5) projects, `baseURL` from env. `tests/e2e/e1.spec.ts` epic smoke test. | `bun run test:e2e` passes locally. | 35m |
| E1-08b | GitHub Actions: CI pipeline | `.github/workflows/ci.yml`: typecheck, lint, unit tests, Playwright (headless) in all 4 projects. Bun-only runtime (no node matrix). Cache `bun` + `~/.cache/ms-playwright`. | First PR runs green in <8 min. | 40m |
| E1-09 | GitHub Actions: ETL workflow scaffold | `.github/workflows/etl.yml`: runs `python etl/main.py` weekly Tue 10:00 ET with manual dispatch. Initial `main.py` writes a heartbeat row to `meta_refresh` (status `heartbeat`). Uses Neon prod via secret. On failure: built-in email + auto-create issue with `etl-failure` label. Retry workflow at 14:00 and 18:00 ET on failure (separate file, see E2-14). | Dispatch manually; row appears. `/status` renders it. Test DST-transition: job fires correctly on the Nov/Mar Tuesdays that span DST. | 55m |
| E1-10 | Vercel deploy + Neon branch-per-PR | Connect repo. Configure env vars for preview/prod. Enable preview-per-PR. Install Neon-Vercel integration so each PR gets its own Neon branch. Set `vercel.json` build command and region (iad1). | PR #1 spawns preview URL with isolated Neon branch; DB writes don't leak across PRs. | 45m |
| E1-11 | Lighthouse CI (info-only) | `.github/workflows/lh.yml` runs Lighthouse CI against the PR preview URL. Budgets from §0.4 committed to `lighthouserc.json`. **Enforcement turned on at start of Sprint 3** (once real content exists). Until then, info-only to track trend. | CI surfaces Lighthouse scores on PR. | 30m |
| E1-13 | `.env.example`, README, CONTRIBUTING | Document all env vars, how to run ETL locally against local Postgres or a personal Neon branch, how to run tests, branch model, Neon branch-per-PR behavior. | Fresh-laptop trial run by a reviewer: follow README → app runs in <10 min. | 40m |
| E1-14 | Budget alerts wired | Hook up billing alerts on Neon, Vercel, Sentry, GH Actions at 50% and 80% utilization per §0.9. Alerts route to owner email + optional Slack webhook. | Trigger a test threshold; alert fires. | 35m |
| E1-15 | Schema sync CI check | CI step generates Pydantic models from Drizzle schema JSON; fails if `etl/models.py` out of sync with `/db/schema.ts`. | Drift in a test PR fails CI. | 30m |

**Sprint 1 demo:** walk through Vercel preview URL showing nav + footer + `/status`. Dispatch the heartbeat ETL. Show Sentry, Lighthouse, Playwright all green in a PR. Show `DESIGN.md` tokens rendered.

---

## 3. Epic 2 — Data Ingest & League Aggregates

**Goal:** All 6 seasons (2020–2025) of league-wide PBP are in Neon. All 12 phases from SPEC.md §3.2 are aggregated weekly + season-to-date, with §3.5a tiebreak and sample-size rules enforced by data contract tests. The weekly ETL runs Tuesday 10am ET with retry.

**Success criteria:**
- `plays`, `games`, `team_phase_weekly`, `team_phase_season`, `meta_refresh` populated for 2020 W1 through the most recent completed 2025 week.
- Running the ETL twice in a row produces no duplicate rows (idempotent).
- All 8 data contract tests pass at end of every ETL run.
- `/status` shows the last successful run with row counts.
- Admin endpoint `/status/data?phase=pass_offense&week=10&season=2025` dumps league aggregate JSON for inspection.

**E2E test (epic-level):** `e2.spec.ts` — runs a local ETL against a small fixture (3 teams, 1 week), asserts `team_phase_weekly` has 3 rows per phase with ranks 1/2/3 or equivalent, tiebreaks applied as specified.

**Performance check:** full 2020–2025 ETL finishes < 10 min in GH Actions. Single-week refresh < 3 min.

**Security review:** SQL injection audit on any dynamic ETL SQL. Neon connection secret rotated after Epic 1 preview. `nflverse` downloaded over HTTPS only, version pinned in `requirements.txt`.

### Tasks

| ID | Subject | Description | Test / validation | Est. (CC) |
|---|---|---|---|---|
| E2-01 | Python ETL package skeleton | `/etl` with `pyproject.toml`, `nfl_data_py`, `psycopg`, `pydantic`. Entrypoint `etl/main.py` with `--season`, `--week`, `--full` flags. | `python -m etl.main --help` runs. | 30m |
| E2-02 | Schema: `plays`, `games` | Drizzle migrations for `games` (game_id PK, season, week, home_team, away_team, result, posteam_epa, defteam_epa) and `plays` (play_id PK, game_id FK, season, week, posteam, defteam, down, distance, yardline, play_type, epa, cpoe, success, wp, is_pass, is_rush, is_redzone, is_third_down, plus key nflfastR columns). Index on `(season, week, posteam, defteam)`, `(season, week, play_type)`. | Introspection test; explain plan on a sample rank query uses index. | 45m |
| E2-03 | Schema: `team_phase_weekly`, `team_phase_season` | Migrations. Columns: team, season, week (nullable for season table), phase (enum of the 12 phases), plays, epa_per_play, success_rate, rank, percentile, updated_at. Unique index on `(team, season, week, phase)`. | Introspection test. | 25m |
| E2-04 | nflverse PBP pull + load | `etl/ingest/nflverse.py`: pull PBP for a season; upsert into `plays` + `games`. Idempotent via `ON CONFLICT (play_id) DO UPDATE`. | Data contract test: running ingest twice on same season yields identical row count. | 50m |
| E2-05a | Phase definitions document | Write `/docs/phase-definitions.md`: for each of the 12 phases, exact play filter (e.g., "red zone = `yardline_100 <= 20`", "explosive pass = `yards_gained >= 20 AND pass`"). Cross-reference nflverse columns. | Doc reviewed against published references (rbsdm, Football Outsiders) before E2-05b starts. | 45m |
| E2-05b | Phase aggregation: offensive base (pass O, rush O, overall) | `etl/transform/phases_offensive.sql` for these 3 phases. Writes to `team_phase_weekly` + `team_phase_season`. | Data contract test: known values match independently computed pandas baseline for 3 phases. | 75m |
| E2-05c | Phase aggregation: defensive base (pass D, run D) | `etl/transform/phases_defensive.sql`. | Contract test for 2 phases. | 60m |
| E2-05d | Phase aggregation: situational (RZ O, RZ D, 3rd O, 3rd D) | `etl/transform/phases_situational.sql`. Depends on E2-05a filter definitions. | Contract test for 4 phases. | 75m |
| E2-05e | Phase aggregation: explosive + ST (explosive O, explosive D, ST) | `etl/transform/phases_explosive_st.sql`. ST aggregation uses punt/kickoff/FG plays only. | Contract test for 3 phases. | 70m |
| E2-06 | Rank + tiebreak computation (SPEC §3.5a) | Window-function SQL that ranks each phase per week + per season. Tiebreak: plays DESC → success_rate DESC → team ABC. | Data contract tests: `SUM(rank) over 32 teams = 528`; identical-EPA teams get distinct ranks per tiebreak rule. | 45m |
| E2-07 | Sample-size guards (SPEC §3.5a) | Aggregation query marks rows as `insufficient_sample` when `plays < 10` (weekly) or `plays < 30` (season). These rows get `rank = NULL`. | Contract test: on a contrived fixture with a team having 5 plays in a phase, rank is NULL and a flag is set. | 30m |
| E2-08 | Freshness gate | Before ingest: compare `max(game_id)` in local DB vs. nflverse schedule; if the latest completed game isn't available from nflverse, exit code 2. GH Actions retry workflow re-triggers on exit 2. | Integration test with mocked nflverse returning stale data. | 35m |
| E2-09 | Idempotent transaction boundary | Wrap the full weekly refresh (plays upsert + phase aggregation) in one Postgres transaction; on any failure, rollback and write `error` to `meta_refresh`. | Chaos test: kill ETL mid-run via Python exit; rerun succeeds from scratch. | 40m |
| E2-10 | Backfill script for 2020–2024 | One-shot `etl/main.py --full` ingests 2020–2024 and computes all aggregations. Safe to re-run. | Run in dev Neon branch end-to-end; row counts match expected values. | 45m |
| E2-11 | Data contract test suite | `etl/tests/contracts.py` with the 6 contract tests enumerated in SPEC §8 plus: ETL duration within budget, source_version matches expected, per-phase row count = 32 per week, no duplicate (team, season, week, phase) rows. | Run in ETL workflow; failing tests mark the run failed. | 55m |
| E2-12 | `/status` real data view + observability | Extend `/status` with row counts, last run duration, nflverse release, current season/week. Build `/status/data?phase&week&season` for raw league aggregates JSON (rate-limited from day one per §0.5). Write structured JSON logs (one line per phase) during ETL. All observability data stored in `meta_refresh.row_counts jsonb`. | Playwright: `/status` after ETL run shows last run within 30s. Logs visible in GH Actions run. `/status/data` returns 429 after 60 req/min. | 55m |
| E2-14 | Retry workflow | `.github/workflows/etl-retry.yml` runs at 14:00 and 18:00 ET on Tue; only triggers if the 10am run exited with the freshness-gate code (2). On 3 failures, auto-open an issue with `etl-failure-urgent` label. | Manual: force non-fresh scenario, verify retries + issue creation. | 30m |
| E2-15 | ETL rollback playbook | Document + script: if a bad ETL publish is detected, revert `plays` + aggregates to the prior snapshot. Uses Neon PITR. Written runbook in `/docs/runbook.md#etl-rollback`. | Drill: run rollback against dev branch, confirm restored. | 45m |

**Sprint 2 demo:** dispatch a full backfill in GH Actions live; watch `/status` update; show the `team_phase_weekly` table in Neon console with 32 teams × 12 phases × weeks; demonstrate a contract-test failure by introducing a bad row and seeing the workflow fail.

---

## 4. Epic 3 — Team Overview + Phase Pages

**Goal:** The home page (season-long team overview) and all 12 phase detail pages are live, styled per DESIGN.md, reading from Neon. `/` is the landing experience. Click a phase card → detail page works.

**Success criteria:**
- `/` matches the preview-page hero + phase-grid layout, uses real data.
- `/phases/[slug]` renders for all 12 phases with rank, trend, distribution, top contributors placeholder.
- Empty / insufficient-sample states render per §3.5a. **Automated assertion:** `tests/e2e/no-bad-numbers.spec.ts` crawls every public route and asserts no rendered text matches `/\bNaN\b|\bundefined\b|\bnull\b|^0\.0+$/` in numeric-class elements.
- Rolling 4-week smoothing toggle works on trend charts.
- Lighthouse CI budgets flip from info-only to enforcing at start of this sprint.

**E2E test (epic-level):** `e3.spec.ts` — load `/`, click Pass Offense card, assert URL becomes `/phases/pass-offense`, page shows 32-team distribution with Pats highlighted, trend chart has 4-week rolling by default.

**Performance check:** home LCP < 2s, phase detail LCP < 2.2s. Total JS for home < 180 KB gzip.

**Security review:** page queries go through a typed server-component data layer; no raw SQL from user input (slug is parameterized against an allowlist of 12 values). `X-Frame-Options: DENY` + CSP set.

### Tasks

| ID | Subject | Description | Test / validation | Est. (CC) |
|---|---|---|---|---|
| E3-01 | Data access layer (DAL) for team stats | `lib/data/team.ts` with `getTeamSeasonOverview()`, `getTeamPhaseWeekly(phase)`, `getLeagueDistribution(phase, week?)`. All typed, all parameterized. | Unit tests on query shape via `pg-mem` or Drizzle query compiler. | 50m |
| E3-02 | Home hero block | `app/page.tsx` hero per preview: eyebrow, H1, tagline, hero stat (team EPA + rank + delta). Real data. | Playwright: hero renders, hero-stat number is not NaN, matches DB value. | 40m |
| E3-03 | Phase grid component + rank-tier utility | `components/PhaseGrid.tsx` renders 12 phase cards: name, rank, sparkline, EPA detail. Includes `lib/color/rank.ts` utility (rank → `positive` / `neutral` / `negative`) as the single source used by grid + distribution + detail. Links to `/phases/[slug]`. | Playwright: grid has exactly 12 cards; top-tier cards use `--positive`, bottom-tier use `--negative`. Unit test for rank utility edge cases. | 60m |
| E3-04 | Sparkline primitive | `components/Sparkline.tsx` using Recharts; renders last-8-weeks trend with directional color. Accessible title. | Visual snapshot; a11y test: has `role="img"` with label. | 35m |
| E3-05 | Phase detail page skeleton | `app/phases/[slug]/page.tsx` with slug allowlist. Shows phase name, Pats rank card, weekly trend chart, league distribution, "top contributors" placeholder. 404 on invalid slug. | Playwright: `/phases/pass-offense` renders; `/phases/nonsense` 404s. | 50m |
| E3-06 | Trend chart with rolling 4w default + raw toggle | `components/TrendChart.tsx`: default shows 4w rolling, toggle button switches to raw weekly. Amber for Pats, muted for league median. Hover tooltip. | Playwright: toggle flips data shape; league median line always present. | 60m |
| E3-07 | League distribution chart | `components/DistributionChart.tsx`: dot plot of 32 teams for the selected phase, Pats highlighted. Hover shows team + value + rank. | Playwright: 32 dots rendered; Pats dot has `data-team="NE"` and is amber. | 50m |
| E3-08 | Empty / insufficient-sample states + bad-number crawler | Component behavior: when `rank === null` or plays < threshold, render "—" with tooltip "n=X, insufficient sample." Add `tests/e2e/no-bad-numbers.spec.ts` that crawls every public route and asserts no rendered text matches `/\bNaN\b|\bundefined\b|\bnull\b|^0\.0+$/` in elements with `data-numeric` attribute. | Crawler test passes against live preview. | 55m |
| E3-10 | ISR cache + deploy-hook revalidation | Pages use `export const revalidate = 3600`. ETL workflow POSTs to a Vercel deploy hook + on-demand revalidation URL after success. | Integration: change a DB value manually, hit revalidate endpoint, page updates on next request. | 40m |
| E3-11 | Week-results strip | Component showing 2025 game results (W/L, score, EPA diff), last 6 games. | Playwright: strip has 6 cells on home page. | 35m |
| E3-12 | Home rank-snapshot card | "League rank card" summary block: all 12 phases with rank + up/down arrow vs. last week. | Playwright: all 12 phase rows present with rank numbers. | 40m |
| E3-13 | Phase page: top contributors placeholder | Stub component that renders "Requires player aggregates — live in Epic 4." Keeps layout honest. | N/A (placeholder). | 15m |
| E3-14 | A11y pass | Run axe in Playwright on `/` and 1 phase page. Fix violations: color contrast, focus rings on interactive SVG, keyboard-accessible toggle. | axe scan shows 0 serious/critical violations. | 45m |

**Sprint 3 demo:** walk through `/` showing all 12 rank cards animated in with real 2025 data, click into Pass Offense detail, toggle rolling/raw, show distribution with Pats highlighted in amber.

---

## 5. Epic 4 — Player Deep Dives

**Goal:** QB, skill position, defense unit, and OL/DL unit pages live. Player rollups (weekly + season) in DB. Primary-starter filter per §3.5a. Mid-season team-change splits handled.

**Success criteria:**
- `/players/qb/[id]` shows the **current primary starter**'s deep-dive with EPA/dropback, CPOE, aDOT, pressure %, clean-pocket splits, and weekly trend.
- `/players/skill/[id]` renders for a WR/RB/TE with target share, YAC, routes run.
- `/team/units/offensive-line` and `/team/units/defensive-line` show unit metrics (pass/run block win proxy, pressures allowed/generated).
- `/team/units/defense` shows unit-level defense (per SPEC §3.3 — no individual defender ratings).
- Primary-starter filter default on QB page; games-played toggle available.
- Player-traded-mid-season rows show team-filtered splits.

**E2E test (epic-level):** `e4.spec.ts` — load QB page, assert primary-starter filter active, toggle games-played, assert row count changes. Load a unit page, assert metrics render.

**Performance check:** QB page LCP < 2.2s, p95 DB query < 150ms.

**Security review:** player id route is UUID-or-gsis-id, validated against DB allowlist; no open-ended id accepted. Pagination and response size capped on any aggregate endpoint.

### Tasks

| ID | Subject | Description | Test / validation | Est. (CC) |
|---|---|---|---|---|
| E4-01 | Schema: `players`, `player_weekly`, `player_season` | Drizzle migrations. `players` includes `gsis_id` PK, `name`, `position`, `current_team`, `display_name`, `headshot_url`. Rollup tables have `team` so mid-season trades are preserved. | Introspection + constraint tests. | 40m |
| E4-02a | ETL: QB rollups | Per-player per-week QB aggregates: dropbacks, EPA, CPOE, aDOT, pressure %, clean-pocket splits. | Contract test: current starter Week 1 2025 matches pandas baseline. | 60m |
| E4-02b | ETL: skill-position rollups | Per-player per-week WR/RB/TE aggregates: targets, routes, YAC, target share, red-zone usage, aDOT on targets. | Contract test against pandas baseline for 2 players. | 60m |
| E4-02c | ETL: unit-level defense/OL/DL rollups | Team-unit weekly: pressure rate, coverage EPA allowed, run-stop, explosive allowed; OL pass/run-block proxies, pressures allowed; DL pressures generated. | Contract test against published unit metrics for a reference team. | 75m |
| E4-03 | Primary-starter flag (§3.5a) | ETL marks each (player, game) as "primary starter" when dropbacks > 50% of team dropbacks that game. Stored as boolean. | Contract test on a game where starter changed mid-game: expected player gets the flag. | 30m |
| E4-04 | Mid-season trade handling (§3.5a) | Per-play rollups attribute stats to the team the player played for at the time. Player page queries accept an optional `team=NE` filter. | Contract test on a 2023 trade fixture. | 35m |
| E4-05 | DAL: player queries | `lib/data/player.ts`: `getQbDeepDive(id, {season, primaryStarterOnly})`, `getSkillUsage(id)`, etc. All parameterized, all typed. | Unit test query compilation. | 40m |
| E4-06 | QB page UI | `app/players/qb/[id]/page.tsx` matches preview QB deep-dive. Stat grid + EPA/dropback chart + clean-pocket splits + primary-starter toggle. | Playwright: renders, toggle flips chart data. | 70m |
| E4-07 | Skill position page | `app/players/skill/[id]/page.tsx`: target share, YAC, routes, aDOT, red-zone usage. Shared chart components. | Playwright: renders for a WR and a RB. | 60m |
| E4-08 | Defense unit page | `app/team/units/defense/page.tsx`: pressure rate, coverage EPA allowed, run-stop, explosive allowed. Honest copy: "Individual defender ratings deferred — see methodology." | Playwright: all 4 unit metrics present; methodology link works. | 50m |
| E4-09 | OL unit page | `app/team/units/offensive-line/page.tsx`: pass block win rate proxy, run block proxy, pressures allowed, EPA on dropbacks. | Playwright: renders. | 45m |
| E4-10 | DL unit page | Same shape as OL, from defensive perspective. | Playwright: renders. | 45m |
| E4-11 | Top contributors on phase pages | Wire the placeholder from E3-13: for each phase, show top 3 Pats contributors from new player rollups. | Playwright: each phase page shows 3 contributor cards. | 40m |
| E4-12 | Player headshots via NFL CDN | `components/PlayerAvatar.tsx` loads from `static.www.nfl.com/image/private/f_auto,q_auto/league/api/...`. Fallback to initials in a circle (no decorative fill). | Playwright: avatar present; missing-headshot case shows initials. | 35m |
| E4-13 | Small-sample banner | On any player page with < 100 dropbacks / routes / snaps, render a banner: "Small sample — stats may swing." | Playwright: synthetic player with 40 dropbacks → banner visible. | 25m |
| E4-14 | E4 epic E2E | Full flow test; include in CI. | `e4.spec.ts` passes. | 35m |

**Sprint 4 demo (part 1):** walk through Maye QB page, flip starter toggle, show how the chart filters; visit skill page for a WR; show defense unit page with the honest "no individual ratings" methodology callout.

---

## 6. Epic 5 — Pats Differentiators (Draft ROI + Coaching)

**Goal:** Draft Pick ROI tracker for 2021–2025 and the full coaching tendency dashboard (play-calling splits, blitz, tempo, personnel, `nfl4th`-powered 4th down analysis). Coordinator changes rendered as date-range-segmented rows.

**Success criteria:**
- `/draft-roi` shows 5 class years with hit/fair/miss grades, actual vs. expected slot value.
- `/coaching` shows current HC + OC play-calling splits, 4th down actual vs. model, blitz rate, personnel usage, tempo.
- If a coordinator changed mid-season, separate rows render with date ranges.
- `nfl4th` recommendations are cached in DB (not recomputed every page render).

**E2E test (epic-level):** `e5.spec.ts` — `/draft-roi` renders 5 class years, Maye shows HIT badge; `/coaching` renders current-season splits and a 4th down actual-vs-recommended chart.

**Performance check:** both pages LCP < 2.2s.

**Security review:** `nfl4th` wrapper (rpy2 or Python port) runs only in the ETL process, never at request time — avoids any code-exec surface on the public site.

### Tasks

| ID | Subject | Description | Test / validation | Est. (CC) |
|---|---|---|---|---|
| E5-01 | Schema: `draft_picks`, `draft_expected_value`, `draft_outcomes_historical` | Tables for Pats picks 2021–2025, league-wide slot-expected-value curves, AND historical draft outcomes 2010–2024 (all teams) needed to fit the slot curve. | Introspection test. | 45m |
| E5-02a | Ingest historical draft outcomes 2010–2024 | `nfl_data_py` `import_draft_picks()` + link to player outcomes via gsis_id. Store in `draft_outcomes_historical`. | Contract test: row count matches known draft-year totals. | 60m |
| E5-02b | Slot-expected-value model fit | Python job: from `draft_outcomes_historical`, fit per-slot expected EPA + snap-share curves. Monotonic smoothing. Store in `draft_expected_value`. | Unit: slot 1 curve > slot 100 curve; smoothing is monotonic over large-enough buckets; cross-validation R² > 0.4 on held-out 2024 class. | 120m |
| E5-03 | Pats draft data seed | Seed `draft_picks` with 2021–2025 Pats picks (hand-curated list; short). | Manual: row count = known pick count per year. | 20m |
| E5-04a | Draft ROI computation: offensive picks | EPA contribution vs. expected for offensive picks 2021–2025. | Contract test on known hit (most recent #1 QB) and known miss. | 80m |
| E5-04b | Draft ROI computation: defensive picks | Unit-level contribution + snap share vs. expected for defensive picks 2021–2025 (SPEC §3.4 defense caveat). | Contract test. | 75m |
| E5-05 | Draft ROI page | `app/draft-roi/page.tsx`: table per class year (2021–2025), hit/fair/miss badge, delta vs. expected. Per preview table. | Playwright: 5 class-year tables; Maye row has `HIT` badge. | 55m |
| E5-06 | Schema: `coaching_tendencies_weekly` | Columns: team, season, week, coach_role (HC/OC/DC), coach_name, play-call splits (pass%, rush%, shotgun%, motion%, play-action%, blitz%, tempo_sec), personnel groupings jsonb, 4th-down decisions. | Introspection. | 30m |
| E5-07 | Play-calling splits ETL | From PBP, compute per-coach splits by down/distance/score-state. | Contract test on fixture. | 60m |
| E5-08a | `nfl4th` spike (rpy2 vs. Python port) | Time-boxed 90m evaluation: attempt rpy2 install in GH Actions ubuntu-latest; evaluate Python port accuracy against published R output on 10 sample plays. Decide path, document in `/docs/nfl4th-decision.md`. | Written decision; prototype install succeeds in CI. | 90m |
| E5-08b | `nfl4th` integration | Implement chosen path from E5-08a. Run per 4th-down play in ETL only (never at request time). Store recommendation + actual decision in `coaching_tendencies_weekly` or a `fourth_down_decisions` table. | Contract test: 20 sample 4th-down decisions match published `nfl4th` output within tolerance. | 180m |
| E5-08c | `nfl4th` fallback toggle | Feature flag: if `nfl4th` fails in a given ETL run, mark `fourth_down_decisions` for that week as unavailable; coaching page hides the chart and shows "4th down model unavailable this week" rather than breaking the page. | Integration test: simulate model failure, page degrades gracefully. | 35m |
| E5-09 | Coordinator-change date-range splits (§3.5a) | When a coach changes mid-season, rollup splits into multiple rows with `start_week`/`end_week`. | Contract test on fixture with mid-season OC change. | 40m |
| E5-10a | Coaching page shell + play-call splits | Page skeleton with HC/OC/DC rows (segmented if changed). Play-call splits chart (pass/run rate by down-distance-score-state). | Playwright: page renders, play-call chart present with league baseline. | 75m |
| E5-10b | Coaching: 4th down actual-vs-model scatter | Scatter of every 4th-down decision vs. `nfl4th` recommendation. Handles unavailable-model weeks via E5-08c feature flag. | Playwright: scatter renders; unavailable-week state renders when flag off. | 75m |
| E5-10c | Coaching: blitz, personnel, tempo charts | Blitz rate trend, personnel grouping breakdown, tempo (seconds/snap). All with league baselines. | Playwright: 3 charts render with league lines. | 75m |
| E5-12 | Methodology deep-link stubs | Per metric, a "?" icon links to `/methodology#<anchor>`. Anchors defined now; content fills in E6-01. | Playwright: clicking "?" navigates to anchor path. | 20m |
| E5-13 | E5 epic E2E | `e5.spec.ts` runs in CI. | Passes. | 35m |

**Sprint 5 demo (part 1):** show `/draft-roi` scrolling through 5 classes; open `/coaching` and walk through each metric with live Pats data vs. league.

---

## 7. Epic 6 — Polish & Launch

**Goal:** Ship to the public. Methodology page, SEO, OG images, mobile pass, legal disclaimer audit, performance regression hunt, load test, runbook, launch checklist. **Light mode is out of scope for v1 per SPEC §11**; dark-only at launch.

**Success criteria:**
- Every page has a unique OG image, meta description, structured title.
- `/methodology` explains each metric, data source, refresh cadence, and limitations.
- Mobile pass: every page usable at 375px wide with no horizontal scroll and touch targets ≥ 44px.
- Lighthouse perf/a11y/seo ≥ 90 on `/`, `/phases/pass-offense`, `/players/qb/<maye>`.
- `sitemap.xml` + `robots.txt` present and correct.
- Legal disclaimer on every page; nflverse attribution on methodology; no NFL/Patriots logos anywhere.
- Launch checklist passes (§7 below).

**E2E test (epic-level):** `e6.spec.ts` — full site crawl via Playwright, asserts disclaimer present, no broken internal links, every page has unique title + description.

**Performance check:** home Lighthouse perf ≥ 95, other pages ≥ 90.

**Security review:** full §0.5 re-run. CSP tightened to no `'unsafe-inline'` in script-src. Rate limiting verified. Dependency audit clean.

### Tasks

| ID | Subject | Description | Test / validation | Est. (CC) |
|---|---|---|---|---|
| E6-01 | Methodology page | `app/methodology/page.tsx`: per-metric explainers, data sources (nflverse, ESPN, `nfl4th`), refresh cadence, limitations (no individual defense ratings, etc.). | Playwright: all metric anchors resolve; content sections present. | 70m |
| E6-02 | OG image generator | `app/og/route.tsx` via `@vercel/og`: dynamic per-page OG images using Cabinet Grotesk. | Unit: generator returns valid PNG for 3 page types. | 60m |
| E6-03 | Metadata audit | Every page exports a `generateMetadata` with unique title + description + OG image. | Playwright: for each route, title/description differ. | 45m |
| E6-04 | `sitemap.xml` + `robots.txt` | `app/sitemap.ts` includes home, all 12 phases, top player pages, draft ROI, coaching, methodology. | `curl /sitemap.xml` returns valid XML with ≥ 25 URLs. | 25m |
| E6-05a | Mobile pass: home + phases | Tighten `/` and all 12 `/phases/*` at 375 / 768. No horizontal scroll. Touch targets ≥ 44px. | Playwright mobile viewport Pixel 5 for these routes. | 120m |
| E6-05b | Mobile pass: players + units | `/players/*` and `/team/units/*` mobile polish. | Playwright mobile viewport. | 90m |
| E6-05c | Mobile pass: draft + coaching + methodology + status | Remaining routes. Nav collapses to drawer. | Playwright mobile viewport. | 90m |
| E6-07 | Error + 404 pages | `app/error.tsx`, `app/not-found.tsx` styled per DESIGN.md. Sentry reports but hides stack from user. | Playwright: hit `/does-not-exist` → styled 404. | 30m |
| E6-08 | Rate limiting | Vercel Edge Middleware on `/api/*` and `/status/*`: 60 req/min/IP. | Integration: burst test returns 429 after limit. | 40m |
| E6-09 | CSP tightening | Strict CSP with nonces for any inline. Report-Only → enforced after 48h clean report. | `curl -I /` has CSP header; no console violations. | 45m |
| E6-10 | Disclaimer + legal audit | Verify footer disclaimer on every page. Verify no NFL/Patriots logos, wordmarks, or uniform imagery anywhere. Double-check nflverse attribution on methodology. | Manual pass + Playwright assertion on disclaimer presence + automated logo-detection assertion. | 45m |
| E6-11 | Performance regression hunt | Lighthouse CI budgets tightened; fix any regression from Epic 3/4/5. | Lighthouse ≥ 90 perf/a11y/best-practices/seo on 3 representative pages. (Single metric — §0.4 LCP budget is the enforced underlying goal.) | 75m |
| E6-12 | Load test | `k6` or autocannon against preview URL: 200 RPS sustained on `/`, `/phases/pass-offense`, `/players/qb/<starter>` for 2 min. No 5xx, p95 < 500ms. | Run recorded; no regressions vs. baseline. | 60m |
| E6-13 | Runbook | `/docs/runbook.md` covers: ETL failure (E2-15 rollback), Neon outage, Sentry spike, bad-data publish, DNS issue, cert expiry, domain expiry, dependency CVE, Vercel outage. Each with first-responder steps. | Peer review by one reviewer who runs through 2 scenarios. | 90m |
| E6-14 | Neon PITR restore drill | Restore a known-good DB state to a throwaway branch; verify row counts + spot checks. Document the exact command flow in the runbook. | Drill completes cleanly; commands captured in runbook. | 45m |
| E6-15 | Launch checklist | Go through §7 checklist below; assign owners. | Checklist 100% checked. | 30m |
| E6-16 | Soft launch + monitor 48h | Deploy to prod, share link with a small group, watch Sentry + Neon + cost dashboards for 48h. | Zero sev-1 errors in 48h. No cost spike > 2x baseline. | monitoring window, no IC time |

**Sprint 5 demo (part 2) / Launch:** live public URL, walk through the whole site on desktop + mobile, show the launch checklist all green, click every page to show OG images working.

---

## 8. Launch checklist (§7)

1. [ ] All epics' success criteria met and signed off.
2. [ ] All 6 epic E2E tests passing in CI on `main`.
3. [ ] Lighthouse perf/a11y/seo ≥ 90 on at least 3 representative pages.
4. [ ] Sentry at 0 unresolved errors across last 7 days of preview.
5. [ ] ETL has run successfully 3 consecutive Tuesdays without manual intervention. (Count begins at end of Sprint 3, so this is green by the middle of Sprint 6.)
6. [ ] `/status` shows fresh data, all 8 data contract tests green.
7. [ ] CSP enforced, not report-only. No console violations on any page.
8. [ ] Rate limiting live on `/api/*` and `/status/*`.
9. [ ] No NFL or Patriots logos/wordmarks anywhere in site chrome (manual audit).
10. [ ] Disclaimer footer on every page (automated test).
11. [ ] nflverse + `nfl4th` attribution on methodology page.
12. [ ] USPTO TESS search on "28 and Three" — confirm no blocking marks (non-lawyer check; escalate to counsel if any hit).
13. [ ] `robots.txt` allows crawling; `sitemap.xml` submitted to Google Search Console.
14. [ ] Analytics (Plausible or Vercel Analytics) live.
15. [ ] Incident runbook in `/docs/runbook.md` (ETL failure, Neon outage, Sentry spike).
16. [ ] Cost review: Neon + Vercel + GH Actions + Sentry all within expected free-tier or minimal paid bands.

---

## 9. Risks & unresolved

Carry-over from SPEC and design reviews; flag before each sprint starts:

- **`nfl4th` deployment in GH Actions (E5-08).** rpy2 vs. Python port — decide day 1 of Sprint 5. Budget a fallback of disabling 4th-down-model chart if neither works; all other coaching metrics ship regardless.
- **nflverse schema changes.** Each season, the PBP columns shift slightly. Contract tests catch this. Budget 2 hours in Week 2 of each season for potential migration.
- **Defensive individual data.** Per SPEC §3.3 / §12, deferred. Don't let scope-creep re-introduce it.
- **Cabinet Grotesk Fontshare outage.** Self-host the WOFF2 files in `/public/fonts` as a backup. Low-effort mitigation.
- **History depth = 2020–2025.** If progression features feel thin after launch, backfill 2015–2019 post-launch using the same ETL.
- **Vercel ISR + on-demand revalidation race.** ETL completes, deploy hook fires, stale page served briefly. E3-10 should include a smoke test; mitigate with short `stale-while-revalidate`.
- **Free-tier limits.** Neon 0.5 GB storage, Sentry 5K events/mo, GH Actions minutes. Budget alerts in E1-14. Expect a paid Neon tier (~$19/mo) once `plays` grows past ~2 seasons with indexes.
- **Time-zone / DST bugs.** Cron is ET; GH Actions runs UTC. E1-09 explicitly tests the Nov/Mar DST transitions.
- **Single-maintainer / bus factor.** If this becomes a solo project, runbook + onboarding docs are the only protection. E6-13 runbook is non-negotiable.
- **Definitions drift.** Phase filter definitions in E2-05a are the source of truth. Changing any filter requires re-running backfill. Treat `/docs/phase-definitions.md` as a versioned contract.

---

## 10. Task-template (use when filing the actual issues)

```
Title: [E<epic>-<task>] <subject>

Epic: <epic name>
Sprint: S<n>
Estimate (CC): <minutes>
Blocks / Blocked by: <task ids>

## Description
<one paragraph on what this does and why>

## Acceptance criteria
- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

## Test / validation
<unit | data-contract | e2e | manual with reviewer sign-off>
<specific test file path if applicable>

## References
- SPEC.md §<section>
- DESIGN.md §<section>

## Definition of Done
Meets §0.1 in IMPLEMENTATION.md.
```
