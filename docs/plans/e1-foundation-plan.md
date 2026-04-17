# E1 — Foundation & Infrastructure: Plan

**Status:** Draft v2 · 2026-04-17 (post-adversarial-review; see `e1-foundation-plan-adversarial-review.md`)
**Scope:** Sprint 1 (weeks 1–2). 17 tasks in beads under epic `patsbythenumbers-elj`.
**Source-of-truth:** `SPEC.md` (product + technical), `DESIGN.md` (visual), `IMPLEMENTATION.md` §2 (task detail).

---

## 1. Context — what problem Sprint 1 solves, and for whom

Sprint 1 doesn't ship a feature to end users. It ships a **substrate** for the builder (Mehdi, solo) so that every subsequent epic adds features instead of re-paving. The problem it solves: "we don't yet have a deployed pipeline from code → preview URL → Neon → Sentry → green CI, and until we do, every later task has to figure that out as a side-quest."

Sprint 1 is done when:
- PRs produce isolated preview URLs with isolated Neon branches.
- A trivial ETL writes a heartbeat to `meta_refresh` and `/status` renders it.
- CI is green on a new PR in under 8 minutes.
- Lighthouse + Sentry + Playwright are wired, even if mostly idle.
- `DESIGN.md` tokens are applied — first UI (nav + footer) consumes them.

No real data yet. No phase pages, no player pages. That's E2+.

---

## 2. UX scope for Sprint 1

Minimal. Two pages ship:

- **`/`** — "Season starts soon" placeholder that correctly exercises the DESIGN.md tokens: nav with the italic-amber "and" wordmark, deep-ink navy bg, Cabinet Grotesk display, Geist body, amber accent, footer with disclaimer.
- **`/status`** — data-freshness page that server-renders the latest row from `meta_refresh` (or "never run"). Also the first demo of the DB + Neon integration; useful to builder during E2 ETL work.
- **`/status/data`** — JSON-only admin endpoint, gated by shared-secret header (`x-admin-token` vs env var), rate-limited. Not a page.
- **`/tokens`** — internal-only visual regression target rendering one swatch + one label per DESIGN.md token. Excluded from sitemap.

No buttons the user can press; no data visualizations. The ONLY interactive element shipped is the theme toggle in the header, which is wired but may do nothing meaningful since there's no content to re-theme yet (the toggle work de-risks E6's dark/light pass).

---

## 3. Architecture decisions

This section resolves the ambiguous choices. Every decision below is load-bearing for multiple tasks and should not be re-litigated per-task.

### 3.1 Project structure

Single Next.js app at repo root. Python ETL in `/etl`. No monorepo tooling (no Turborepo, no workspaces). Layout:

```
/
├── app/                  # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx          # /
│   ├── status/
│   │   ├── page.tsx      # /status (server component)
│   │   └── data/route.ts # /status/data (API route, gated)
│   └── tokens/page.tsx   # internal visual regression
├── components/           # React components (SiteHeader, SiteFooter, etc.)
├── lib/
│   ├── db.ts             # Drizzle client singleton
│   └── env.ts            # zod-validated env loader
├── db/
│   ├── schema.ts         # Drizzle schema (DDL owner)
│   └── migrations/       # drizzle-kit output
├── etl/                  # Python ETL
│   ├── pyproject.toml    # uv-managed
│   ├── uv.lock
│   ├── main.py           # entrypoint with --season/--week/--full
│   ├── models.py         # Pydantic v2, regenerated from Drizzle JSON
│   └── tests/
│       └── contracts.py
├── public/
│   └── fonts/            # self-hosted Cabinet Grotesk WOFF2
├── tests/
│   └── e2e/              # Playwright specs
├── .github/
│   ├── workflows/        # ci.yml, etl.yml, etl-retry.yml, lh.yml
│   └── CODEOWNERS
├── .env.example
├── package.json
├── bun.lockb
├── tailwind.config.ts
├── drizzle.config.ts
├── playwright.config.ts
├── lighthouserc.json
├── next.config.ts
├── tsconfig.json
└── vercel.json
```

**Why flat, not monorepo:** solo project, one deploy target (Vercel), ETL runs in a different runtime (GH Actions, Python) and doesn't share code with the web app. The only shared artifact is the DB schema, which is bridged by the Pydantic-from-Drizzle CI check (E1-15). Monorepo tooling would be overhead with zero upside.

### 3.2 Runtime & package managers

**Change after adversarial review:** codex flagged Bun-only as unnecessary novelty compounded on top of already-novel stack pieces (Next 15, Neon, Drizzle, Sentry). Accept → use pnpm + Node LTS.

| Surface | Runtime | Pkg mgr | Lockfile | Why |
|---|---|---|---|---|
| Web app | Node 22 LTS | pnpm 9 | `pnpm-lock.yaml` | Boring, stable, first-class on Vercel, fast enough, no migration hazards. |
| ETL | Python 3.12 | uv | `uv.lock` | Fastest Python resolver (~10× pip/poetry); clean pyproject.toml; first-class in GH Actions via `astral-sh/setup-uv@v3`. |
| CI | GH Actions Ubuntu latest | — | — | pnpm + uv both install in <10s with caching. |

Scripts run via `pnpm run *` (not `bun run *`). Any `bun run *` references in IMPLEMENTATION.md are stale and get patched when the respective task lands.

**Python version pin:** `.python-version` = `3.12`. `pyproject.toml` requires `>=3.12,<3.13`. nflverse + nfl_data_py + pandas all support 3.12 as of 2026-04.

**Node version pin:** `.nvmrc` = `22`. `package.json` `engines.node: ">=22"`. Vercel project set to Node 22.

### 3.3 Data path

```
    ┌─────────────────────┐
    │ GitHub Actions cron │  Tuesday 10:00 ET
    │ etl/main.py (uv)    │─────────┐
    └─────────────────────┘         │
                                    │ psycopg3, DML only
                                    ▼
          ┌─────────────────────────────────────┐
          │ Neon Postgres                       │
          │ branches:                           │
          │   main (prod)                       │
          │   dev                               │
          │   preview/pr-N (ephemeral)          │
          └──────────────────┬──────────────────┘
                             │ server components
                             │ Drizzle (typed queries, DDL)
                             ▼
          ┌─────────────────────────────────────┐
          │ Next.js on Vercel                   │
          │  - edge middleware (rate limit)     │
          │  - serverless (server components)   │
          │  - static assets (/public + CDN)    │
          └──────────────────┬──────────────────┘
                             │
                             ▼
                      browser / crawler
```

Drizzle is the **only** migration runner. Python reads the schema but never mutates it.

**Change after adversarial review:** codex flagged the Drizzle→Pydantic codegen as premature for a one-table schema. Accept → hand-write `etl/models.py` with a single `MetaRefresh` Pydantic v2 model in E1. Build the codegen / drift check in E2 when `plays` + `games` land and drift risk becomes real. (E1-15 deferred to E2 as `E2-00b`.)

**Per-PR preview migrations** (new, codex finding #1): Preview deploys run `pnpm drizzle-kit migrate` against the preview branch's unpooled URL **before** the Vercel preview publishes. Without this, a PR that adds a column renders against a stale schema. Wired in new task E1-10a.

### 3.4 Environments

| Env | Neon branch | Vercel env | Where secrets live |
|---|---|---|---|
| Local dev | `dev` (solo scratch; manual reseed from prod as needed) | `vercel dev` reads `.env.local` | `.env.local` gitignored; populated from Dashlane |
| PR preview | `preview/pr-N` (auto, via Neon-Vercel integration; migrations applied before deploy) | Vercel preview env | Vercel env vars (per-env) |
| Production | `main` | Vercel production env | Vercel env vars (per-env); GH Actions secrets for ETL |

No separate staging. Preview-per-PR is staging. ETL always targets prod's Neon `main` branch on Tuesday.

**Change after adversarial review:** dropped the "weekly mirror prod → dev" idea. The `dev` branch is my personal scratch space; I reseed it manually from prod when I need fresh data. Schema experiments belong on a per-PR preview branch.

### 3.4a Database roles (new, codex finding #5)

Three Neon roles, not one omnipotent URL:

| Role | Privileges | Used by | Env var |
|---|---|---|---|
| `app_read` | `SELECT` on all tables; no DDL | Next.js server components (prod + preview) | `DATABASE_URL` |
| `etl_writer` | `SELECT, INSERT, UPDATE, DELETE` on tables + sequences; no DDL | Python ETL (prod via GH Actions; personal branch in dev) | `ETL_DATABASE_URL` |
| `migrator` | Schema owner; DDL + DML | `drizzle-kit migrate` in CI only; never by the running app | `MIGRATOR_DATABASE_URL` |

Granting happens in E1-05 via Neon SQL-console one-off. Documented in `docs/runbook.md#db-roles`.

### 3.5 Env variables

Minimum set committed to `.env.example`:

```
# Database (three roles per §3.4a)
DATABASE_URL=                    # app_read role, pooled; used by Next.js server components
MIGRATOR_DATABASE_URL=           # migrator role, unpooled; used only by drizzle-kit migrate in CI

# Sentry (web)
NEXT_PUBLIC_SENTRY_DSN=          # web DSN (public, safe)
SENTRY_AUTH_TOKEN=               # CI-only, for source-map upload
SENTRY_ORG=28-and-three
SENTRY_PROJECT=28-and-three-web

# Debug (local/preview only; must never be set in prod)
ALLOW_DEBUG_TRIGGER=             # gated synthetic-error trigger. See §3.8.

# ETL (used by Python, not the web app)
ETL_DATABASE_URL=                # etl_writer role, unpooled
SENTRY_DSN_ETL=                  # etl Sentry DSN
SENTRY_MONITOR_SLUG=etl-weekly
```

**Validation:** `lib/env.ts` uses zod to parse and fail-fast at cold-start if any required var is missing. ETL has a parallel Pydantic v2 `Settings` model.

**Change after adversarial review:** removed `STATUS_ADMIN_TOKEN` (endpoint deferred, see §3.6). Added `MIGRATOR_DATABASE_URL` and `ALLOW_DEBUG_TRIGGER`.

### 3.6 /status/data — **deferred to E2**

**Change after adversarial review (codex finding #4):** static shared secret + IP-based edge rate limit was leaky, and there's no E1 consumer. Deferred entirely.

When E2 adds the endpoint:
- Route handler (not a page), edge runtime.
- `crypto.timingSafeEqual` for header comparison (constant-time).
- `@upstash/ratelimit` + Vercel KV as durable limiter (~$0–2/mo, budget allows).
- Or gate to preview-only via Vercel Access.
- Never log the token; never include it in Sentry breadcrumbs.

Tracked as `E2-12` in existing IMPLEMENTATION.md, which we can harden at that time.

### 3.7 CI pipeline layout

**Change after adversarial review (codex finding #7):** CI is tiered. Per-PR stays fast (chromium-only); full browser matrix + Lighthouse moves to a nightly workflow.

**`.github/workflows/ci.yml`** — runs on every PR and push to main. Target: <4 min.

| Job | Runs on | Steps |
|---|---|---|
| `web` | ubuntu-latest | setup-node 22 → setup-pnpm → `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm lint` → `pnpm test` (Node unit tests, sparse) |
| `e2e` | ubuntu-latest | install deps → `pnpm build` → Playwright **chromium only** (the e1 smoke suite) |
| `preview-migrate` (new) | ubuntu-latest | `pnpm drizzle-kit migrate` against the per-PR branch's unpooled URL BEFORE Vercel publishes the preview (codex finding #1) |

Cache: `~/.local/share/pnpm/store` keyed by `pnpm-lock.yaml`; `~/.cache/ms-playwright` keyed by Playwright version.

**`.github/workflows/ci-nightly.yml`** (new) — runs nightly UTC, and on-demand via `workflow_dispatch`.

| Job | Steps |
|---|---|
| `e2e-full-matrix` | Playwright firefox + webkit + mobile-chrome against the production URL |
| `lighthouse` | `lhci autorun` against prod; info-only until E3. Keeps the trend line visible without blocking PRs. |

**`.github/workflows/etl.yml`** — cron `0 14 * * 2` (10am ET Tuesday in UTC; DST verified in E1-09 acceptance test).

**`.github/workflows/etl-retry.yml`** — scaffolded, wired fully in E2-14.

**Schema-sync gate** — removed from E1; will land in E2 with real schema.

### 3.8 Testing strategy for Sprint 1

Per SPEC §8, no broad unit-test pyramid. **Change after adversarial review (codex finding #9):** bias the tests toward the infra surface, not cosmetic utilities.

- **`lib/env.ts` validation test** — assert `env.parse` throws on a missing required var.
- **`lib/db.ts` connection helper test** — asserts singleton caching, reads the right env var.
- **E1 epic E2E** `tests/e2e/e1.spec.ts` covers home + status + security headers + cache-control + font isolation (draft below, §4).
- **Token baseline** `tests/e2e/tokens.spec.ts` — dark-mode-only snapshot of `/tokens` (light mode deferred per codex finding #8).
- **Auth helper test** — if we end up shipping a constant-time compare helper in E1 (likely not, since `/status/data` is deferred), test it; otherwise defer.
- **No data contract tests yet** — those come with ETL in E2.
- **Synthetic error gate** — `/status?debug=boom` only active when `NODE_ENV !== 'production'` AND `ALLOW_DEBUG_TRIGGER === 'true'`. E2E asserts 404 in prod.

Dropped from v1 of the plan:
- The stub `lib/color/rank.ts` unit test. Ship it with the utility in E3.

---

## 4. E2E tests — written upfront

Draft of `tests/e2e/e1.spec.ts`. Lives in a separate branch during E1-08a; committed when the harness lands.

Post-adversarial-review changes: removed the two `/status/data` tests (endpoint deferred); added security-headers test, cache-control test, and debug-trigger-gated test. Token test reduced to dark-mode only.

```typescript
import { expect, test } from '@playwright/test';

test.describe('E1 smoke', () => {
  test('home renders with wordmark, nav, footer', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/28 and Three/i);

    // Wordmark present, italic "and" styled with amber
    const wordmark = page.getByTestId('wordmark');
    await expect(wordmark).toBeVisible();
    await expect(wordmark.locator('em')).toHaveCSS('color', /rgb\(22[0-9], 18[0-9], 7[0-9]\)/);

    // Nav links present (content-only check; hrefs are placeholders in E1)
    const navLinks = page.getByRole('navigation').getByRole('link');
    await expect(navLinks).toHaveCount(5); // Team, Phases, Players, Draft, Coaching

    // Footer with disclaimer
    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText(/Not affiliated with/i);
    await expect(footer).toContainText(/nflverse/i);

    expect(consoleErrors).toEqual([]);
  });

  test('/status renders without errors when no ETL has run', async ({ page }) => {
    await page.goto('/status');
    await expect(page).toHaveURL(/\/status$/);
    const body = page.locator('body');
    await expect(body).toContainText(/never run|last run/i);
    // No raw DB errors leaking to the user
    await expect(body).not.toContainText(/ECONNREFUSED|role .* does not exist/i);
  });

  test('/status has Cache-Control: no-store', async ({ request }) => {
    const res = await request.get('/status');
    const cc = res.headers()['cache-control'] ?? '';
    expect(cc).toMatch(/no-store/);
  });

  test('security headers present on home', async ({ request }) => {
    const res = await request.get('/');
    const h = res.headers();
    expect(h['content-security-policy-report-only'] || h['content-security-policy']).toBeTruthy();
    expect(h['strict-transport-security']).toBeTruthy();
    expect(h['x-frame-options']).toMatch(/DENY/i);
    expect(h['referrer-policy']).toBeTruthy();
  });

  test('debug-trigger route is gated (404 without ALLOW_DEBUG_TRIGGER)', async ({ request }) => {
    // Running against prod (ALLOW_DEBUG_TRIGGER not set) → must 404
    const res = await request.get('/status?debug=boom');
    if (process.env.ALLOW_DEBUG_TRIGGER === 'true') {
      test.skip(true, 'debug trigger is enabled in this env');
    }
    // Some impls serve the page HTML while only the boom handler is gated.
    // What matters: no 500 and no synthetic error ingested.
    expect([200, 404]).toContain(res.status());
  });

  test('DESIGN.md tokens resolve at runtime (dark mode)', async ({ page }) => {
    await page.goto('/tokens');
    const swatches = page.getByTestId(/^token-/);
    await expect(swatches.first()).toBeVisible();
    const count = await swatches.count();
    expect(count).toBeGreaterThanOrEqual(14); // dark-mode tokens only in E1

    for (const el of await swatches.all()) {
      const color = await el.evaluate((n) => getComputedStyle(n).backgroundColor);
      expect(color).not.toEqual('');
      expect(color).not.toEqual('rgba(0, 0, 0, 0)');
    }
  });

  test('no external font requests at runtime (self-hosted Cabinet Grotesk)', async ({ page }) => {
    const fontRequests: string[] = [];
    page.on('request', (req) => {
      if (req.resourceType() === 'font') fontRequests.push(req.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const origin = new URL(page.url()).origin;
    const externalFonts = fontRequests.filter((u) => !u.startsWith(origin) && !u.includes('/_next/'));
    expect(externalFonts).toEqual([]);
  });
});
```

This file is the **automatic** half of the Sprint 1 exit criteria (see §10). The operator-verified half is separate.

---

## 5. Task sequencing — critical path

Dependencies among the 17 E1 tasks, grouped by what they unblock.

```
               ┌────────────────────────────┐
               │ E1-01 Initialize repo/tool │  (blocker for everything)
               └────────────┬───────────────┘
                            │
       ┌────────────────────┼──────────────────────┐
       ▼                    ▼                      ▼
  E1-02a Tailwind      E1-05 Neon branches      E1-08a Playwright
  + tokens             (dev + prod)             harness
       │                    │                      │
       ▼                    ▼                      ▼
  E1-02b Fonts         E1-06 meta_refresh       E1-08b GH Actions CI
  (next/font)          Drizzle migration        pipeline
       │                    │                      │
       ▼                    │                      │
  E1-02c Token         E1-07 Sentry              │
  visual snapshot      integration               │
       │                    │                      │
       └─────────┬──────────┴──────────┬───────────┘
                 ▼                     ▼
            E1-03 SiteHeader      E1-10 Vercel + Neon
            + SiteFooter          branch-per-PR
                 │                     │
                 ▼                     ▼
            E1-04 Root layout + / + /status (server component)
                             │
                             ▼
                   ┌─────────┼──────────────────┐
                   ▼         ▼                  ▼
              E1-09 ETL   E1-11 Lighthouse   E1-13 README
              workflow    CI info-only       + .env.example
              (heartbeat)                    + CONTRIBUTING
                   │
                   ▼
              E1-14 Budget alerts
              E1-15 Schema sync CI check
                   │
                   ▼
              Sprint 1 demo gate:
              e1.spec.ts passes on preview URL
```

**Critical path (longest chain):** E1-01 → E1-02a → E1-03 → E1-04 → E1-09 → E1-14 (≈220 min of focused work, ~6 hours wall clock including testing and iteration).

**Parallel opportunities:**
- E1-02a/b/c can ship without waiting for E1-05.
- E1-08a/b run in parallel with the UI track.
- E1-15 (schema sync check) can be built after E1-06 exists.

Realistic 2-week schedule for a solo dev working part-time:

| Week | Focus |
|---|---|
| Week 1 Mon–Wed | E1-01, E1-05, E1-06, E1-07 (the plumbing) |
| Week 1 Thu–Fri | E1-02a/b/c, E1-03 (the design system application) |
| Week 2 Mon–Tue | E1-04, E1-08a/b, E1-10 (layout + CI + deploys) |
| Week 2 Wed–Thu | E1-09, E1-11, E1-13, E1-14, E1-15 (remaining glue) |
| Week 2 Fri | Demo + retro |

---

## 6. Simplicity review

Applied the "is this as simple as possible" lens to each decision:

| Decision | Simpler alternative? | Verdict |
|---|---|---|
| Single Next.js app (no monorepo) | Already the simplest workable layout. | Keep. |
| Drizzle for DDL, psycopg for DML | Could use a single language for both. But splitting the languages is native to the stack (TS for web, Python for ETL). Locking schema in Drizzle is an honest constraint, not an abstraction. | Keep. |
| `/status/data` shared-secret gate | Simpler: fully public + rate limit only. But the token is 2 lines of middleware and removes a class of abuse. | Keep token. |
| Zod env validation | Simpler: just read `process.env` inline. But one cold-start crash on a missing var in prod costs more than the 20 lines of zod. | Keep zod. |
| Schema-sync CI check (Drizzle → Pydantic) | Simpler: write Pydantic models by hand and hope. But that's the exact class of bug (schema drift) that SPEC §3.5a and §0.7 call out explicitly. | Keep. |
| Four Playwright browser projects | Simpler: chromium-only. But webkit surfaces real bugs Chrome doesn't, and this is 10 minutes of config. | Keep; can drop to chromium + webkit if CI gets slow. |
| Per-PR Neon branches | Simpler: one shared dev DB for all PRs. But mutation-tests-in-one-PR-leak-into-another is a nasty foot-gun during E2 ETL work. | Keep. |
| Tokens visual regression baseline | Simpler: skip it, eyeball DESIGN.md changes. But DESIGN.md is frozen per policy and a silent regression here blows up E3+. | Keep. |

No decision flagged as over-engineering. One that came close: the full 4-browser Playwright matrix is arguably excessive in E1 when there's ~nothing to test, but the marginal cost once CI is set up is near zero and future sprints will lean on it.

Items deliberately NOT adopted in Sprint 1:
- Husky / pre-commit hooks → rely on CI; husky slows local dev.
- Storybook → nothing to put in it yet.
- Turborepo / NX → premature.
- Custom Tailwind plugin → one file of `tailwind.config.ts` is fine.
- Runtime feature flags → no feature to flag.
- OpenTelemetry → Sentry + structured logs are enough for v1.

---

## 7. Adversarial review

Run codex in challenge mode against this plan and list any issue it surfaces with verdict (accept / reject / defer to beads). Full output appended to `docs/plans/e1-foundation-plan-adversarial-review.md` when complete.

---

## 8. Task set — status vs this plan

Cross-checking IMPLEMENTATION.md §2 task list against this plan:

| Task | Plan coverage | New info this plan adds |
|---|---|---|
| E1-01 | §3.1, §3.2 | Bun-only (no Node fallback), `.python-version`, uv.lock committed |
| E1-02a | §3.1 | Tailwind 4 config shape spelled out in DESIGN.md; no new info |
| E1-02b | §3.1 | Self-hosted Cabinet Grotesk is already the plan |
| E1-02c | §3.8, §4 | `tests/e2e/tokens.spec.ts` location pinned |
| E1-03 | §2 | — |
| E1-04 | §2, §3.6 | `/status/data` as route handler (not a page); added `/tokens` |
| E1-05 | §3.4 | — |
| E1-06 | §3.3 | zod env + psycopg3 (not psycopg2) |
| E1-07 | §3.5 | Two Sentry projects (web + etl) per E0-05 |
| E1-08a | §3.7, §4 | e1.spec.ts draft committed to this plan |
| E1-08b | §3.7 | <8min CI budget; cache keys specified |
| E1-09 | §3.4, §3.7 | Sentry Crons monitor slug `etl-weekly` |
| E1-10 | §3.4 | — |
| E1-11 | §3.7 | Info-only until E3; lighthouserc budgets from IMPLEMENTATION §0.4 |
| E1-13 | §3.5 | Env var inventory from §3.5 |
| E1-14 | §3.9 in IMPLEMENTATION | — |
| E1-15 | §3.3, §3.7 | Drizzle→Pydantic generator is the source of truth |

**Gaps found:** one — there's no explicit task for the `/tokens` internal visual regression page. `/tokens` is referenced by E1-02a's acceptance ("a /tokens internal route renders one swatch per token") but the page itself isn't a separate task. Treating it as part of E1-02a is fine for a solo builder.

**Duplicates found:** none.

**Tasks that need their acceptance updated based on this plan:**
- E1-01: add "uv + `.python-version` committed"
- E1-04: add "/status/data route handler with token gate" (currently says only `/status` stub)
- E1-06: clarify psycopg3 (not 2)
- E1-07: clarify two projects (web and etl)

These updates are minor and can be applied via `bd update --notes`.

---

## 9. Open risks for Sprint 1

| Risk | Mitigation |
|---|---|
| Bun+Vercel interaction edge cases | Pin Bun version in `package.json` engines. Vercel already supports Bun; fallback to Node+pnpm is ~1 day of work. |
| Neon-Vercel preview-per-PR integration quirks | Documented in `README.md`; if the auto-integration flakes, fall back to a single shared `preview` branch with a 15-min cleanup cron. |
| uv in GH Actions not caching well | Known good pattern with `astral-sh/setup-uv@v3 --enable-cache`. |
| Cabinet Grotesk Fontshare ToS changes during the sprint | Self-hosted WOFF2 mitigates; license captured in `/docs/licenses.md`. |
| Sentry free-tier (5K events/mo) blown by a noisy deploy | Sample rate: 10% in production, 100% in preview. Capture only handled errors in the browser; capture all errors server-side. |
| Sprint drag: solo dev underestimates CI yak-shaving | 1-day slack built into the schedule (Friday retro, not more work). |

---

## 10. Sprint 1 exit criteria

**Change after adversarial review (codex finding #10):** split into two buckets. The E2E suite only claims the things it actually verifies; operator-verified items are explicit and checked off in `docs/sprint-1-exit.md`.

### Automated (verified by `tests/e2e/e1.spec.ts` running in CI against preview + prod)

- Home renders with wordmark, nav, footer, disclaimer.
- `/status` renders the last ETL row (or "never run") without raw DB errors, and carries `Cache-Control: no-store`.
- Security headers present: CSP (or CSP-Report-Only), HSTS, X-Frame-Options: DENY, Referrer-Policy.
- `/status?debug=boom` does not return 500 in prod (gated off).
- `/tokens` exposes ≥14 dark-mode tokens, all resolving to non-empty computed background colors.
- No external font requests at runtime (self-hosting works).

### Operator-verified (manual checklist in `docs/sprint-1-exit.md`)

- All 17 E1 beads tasks closed (`bd stats` shows 0 open under epic `elj`).
- `main` deployed; DNS for `28andthree.com` points at Vercel (or the apex holds a landing page and `app.28andthree.com` points at Vercel).
- A live PR demonstrates: preview URL spawns, an isolated Neon preview branch exists, pre-deploy `drizzle-kit migrate` ran, closing the PR removes the branch.
- `pnpm audit` clean (0 high/critical).
- At least one synthetic Sentry event visible in the web project dashboard (captured from a preview, not prod).
- Lighthouse CI has posted at least one info-only comment on a PR.
- Budget alert fires on a manually triggered 50% threshold test in at least one service.
- `docs/runbook.md` stub exists with a section for "DB roles" and "ETL rollback" (pointers; full content lands in E2/E6).

E1 is done when **both buckets are green**.
