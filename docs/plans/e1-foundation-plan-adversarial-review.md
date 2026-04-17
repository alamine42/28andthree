# E1 Plan — Adversarial Review Adjudication

**Date:** 2026-04-17
**Reviewer:** Codex CLI (gpt-5.4, reasoning=high), challenge mode.
**Plan under review:** `docs/plans/e1-foundation-plan.md` v1.

Codex raised 11 findings. Each is adjudicated below: **ACCEPT** (apply to plan + tasks), **PARTIAL** (adopt some mitigation, not all), **REJECT** (keep plan as-is, with reason), or **DEFER** (valid but out of scope for E1).

---

## Findings

### 1. Preview DB migrations undefined

**Codex:** Blocker. Per-PR Neon branches + Drizzle migrations only on merge-to-main leaves PR previews with stale schemas. Will bite in E2 when schema evolves.

**Verdict: ACCEPT.** This is a real hole.

**Fix applied:**
- Add a preview-deploy step to `ci.yml`: run `drizzle-kit migrate` against the per-PR branch's unpooled URL **before** Vercel publishes the preview.
- File a new beads task `E1-10a: Preview branch migration step` as a sub-step of E1-10.
- Add an e2e assertion: a PR that introduces a schema change must show the new column queryable on the preview URL.

### 2. Bun-only is unnecessary infra risk

**Codex:** High. Stacking Bun + Next 15 + Drizzle + Vercel + Playwright + Sentry during an infra sprint compounds novelty. "1 day to pnpm" is optimistic once everything assumes Bun.

**Verdict: ACCEPT.** Right call. Switch to **pnpm + Node LTS (22)** for CI/prod; keep Bun as an optional local tool only if I like it.

**Fix applied:**
- `package.json` `packageManager: "pnpm@9.x"`, `engines.node: ">=22"`.
- `pnpm-lock.yaml` committed instead of `bun.lockb`.
- All IMPLEMENTATION.md `bun run *` references are stale; patch IMPLEMENTATION and update affected task notes.
- Vercel build uses Node 22 + pnpm.

### 3. Shared `dev` Neon branch is a future foot-gun

**Codex:** High. One mutable dev DB + weekly prod mirror = schema experiment collisions.

**Verdict: PARTIAL.** Accept the core critique. For a solo project, "shared dev" = "my working dev branch." Simplify the model:

**Fix applied:**
- Drop the "weekly mirror from prod" idea. Not needed for a solo builder.
- `dev` branch becomes my personal scratch; can be wiped and re-seeded from prod on demand (manual command, documented).
- Each significant schema experiment goes on a per-PR preview branch, not `dev`.

### 4. `/status/data` auth is weak; rate limit underspecified

**Codex:** High. Static secret + IP-based edge rate limit is leaky. The endpoint is a liability before there's data to serve.

**Verdict: ACCEPT in full.** Defer the endpoint out of E1 entirely.

**Fix applied:**
- Remove `/status/data` from E1 scope.
- Keep the page-level `/status` (public, read-only, no auth needed — it only shows "last ETL heartbeat at X").
- Re-scope `/status/data` into E2 (where it's actually needed for ETL debugging). When built:
  - `crypto.timingSafeEqual` for header comparison.
  - Route handler only — NOT a page. Edge runtime with CSP.
  - `@upstash/ratelimit` + Vercel KV as durable limiter (a few $/mo; fits budget).
  - OR gate to preview-only via Vercel Access/preview-mode auth.
- Strike §3.6 of the plan and adjust E1-04 acceptance to drop the endpoint.

### 5. No least-privilege DB roles planned

**Codex:** High. One omnipotent URL for everything is painful to untangle later.

**Verdict: ACCEPT.** Neon supports roles cheaply; establishing them now beats refactoring in E3.

**Fix applied:**
- Create three Neon roles in E1-05:
  - `app_read` — `SELECT` on all tables; used by the Next.js server components via `DATABASE_URL`.
  - `etl_writer` — `INSERT, UPDATE, DELETE, SELECT` on tables + sequences; used by Python ETL via `ETL_DATABASE_URL`.
  - `migrator` — owner of schema + DDL privileges; used only by `drizzle-kit migrate` in CI, via `MIGRATOR_DATABASE_URL`.
- Update `.env.example` + IMPLEMENTATION task notes accordingly.

### 6. Sentry plan is noisy and risks quota burn + PII leakage

**Codex:** High. 100% preview sampling on free tier = quota fire risk. `debug=boom` query-param trigger is prod-exploitable. Scrubbing config is vague.

**Verdict: ACCEPT.**

**Fix applied:**
- `traces_sample_rate`: 0.1 prod, 0.05 preview (not 1.0). Error events stay at 1.0 but with strong `beforeSend` filtering.
- `sendDefaultPii: false`.
- `beforeSend`: drop `request.cookies`, `request.headers.authorization`, `request.query_string`, `user.ip_address`, `user.email`. Normalize URLs (strip query string).
- `debug=boom` trigger: only active when `process.env.NODE_ENV !== 'production'` AND `process.env.ALLOW_DEBUG_TRIGGER === 'true'`. Never in prod.
- Disable preview ingestion on the client (only server-side in preview, to bound volume).

### 7. CI scope is underestimated

**Codex:** High. <8-min CI with 4-browser Playwright + schema-sync + Lighthouse on GH runners is fantasy.

**Verdict: ACCEPT.** Tier the CI matrix.

**Fix applied:**
- **Per-PR CI:** `typecheck`, `lint`, **Chromium-only** smoke (the e1.spec.ts suite). Target: <4 min.
- **Nightly CI (`.github/workflows/ci-nightly.yml`):** Firefox + WebKit + mobile-chrome. Lighthouse against prod.
- Update task E1-08b's acceptance: "first PR runs green in <4 min".
- Update task E1-08a (Playwright harness): configure all 4 projects but default to chromium in the per-PR workflow.

### 8. Light mode is scope creep

**Codex:** Medium. SPEC §11 + IMPLEMENTATION §0 header both defer light mode, yet E1-02a/c + E1-03 toggle still assume dual-mode tokens.

**Verdict: ACCEPT.** Ship dark-only in E1.

**Fix applied:**
- E1-02a: tokens include CSS variable **naming** that supports dark + light, but only dark values defined in `:root`. Light values come later.
- E1-02c: drop the dual-mode visual snapshot. Only dark mode baseline.
- E1-03: drop the theme toggle from the header (was always a placeholder with nothing to theme).
- Document in the plan that light mode is an E6-prep item, not E1.

### 9. Test plan covers cosmetics better than infrastructure

**Codex:** Medium. Fake `rank.ts` test + UI smokes miss the real infra-risk surface.

**Verdict: ACCEPT.** Drop the stub, add infra tests.

**Fix applied:**
- Remove the stub `lib/color/rank.ts` test. (It's genuinely premature — utility lands in E3.)
- Add these tests to `tests/e2e/e1.spec.ts`:
  - `env.ts` validation fails fast on a missing required var (run in a separate process / test fixture).
  - Security headers present: `Content-Security-Policy` (Report-Only is fine for E1), `Strict-Transport-Security`, `X-Frame-Options: DENY`, `Referrer-Policy`.
  - `/status` has `Cache-Control: no-store` (it's a live data view; we must not cache it at the edge).
- Also: one Node-level unit test for the Drizzle client `lib/db.ts` that confirms it reads the right env var and caches the connection.

### 10. Exit criteria internally false

**Codex:** Medium. Several exit criteria can't be automatically proven by the E2E suite they claim to "bubble through."

**Verdict: ACCEPT.** Rewrite exit criteria into two buckets.

**Fix applied:**
- `e1.spec.ts` bucket: home renders, status renders, env validates, headers present, cache-control correct.
- Operator-verified bucket (checklist in `docs/preflight.md` or a new `docs/sprint-1-exit.md`):
  - PR preview URL spawned with isolated Neon branch.
  - Sentry received at least one synthetic event.
  - Lighthouse posted a comment on a PR.
  - `pnpm audit` clean.
  - Budget alert fired on a 50% threshold test.
  - Sprint 1 demo walkthrough completed.
- Rewrite §10 of the plan to reflect the split.

### 11. Drizzle→Pydantic codegen is premature custom tooling

**Codex:** Medium. One-table `meta_refresh` doesn't earn a codegen pipeline.

**Verdict: PARTIAL.** Defer the codegen, but keep the **intent** alive.

**Fix applied:**
- E1-15 (Schema sync CI check): **defer to E2**. Rename the task to `E2-00a: Schema sync CI check (introduce when models.py exists)` or keep the ID and leave a one-line placeholder script that exits 0 if only `meta_refresh` exists.
- For Sprint 1: hand-write `etl/models.py` with a single `MetaRefresh` Pydantic class. Commit it as-is.
- Document the codegen as an E2 task to land before E2-02 (plays/games schema), when the drift risk becomes real.

---

## Summary by severity and action

| # | Codex severity | Adjudication | Net action |
|---|---|---|---|
| 1 | Blocker | ACCEPT | Add preview-migration step |
| 2 | High | ACCEPT | Switch to pnpm + Node 22 |
| 3 | High | PARTIAL | Drop weekly mirror; `dev` = solo scratch |
| 4 | High | ACCEPT | Defer `/status/data` to E2 |
| 5 | High | ACCEPT | Three Neon roles in E1-05 |
| 6 | High | ACCEPT | Sample rates down, scrubbing specific, debug-boom gated |
| 7 | High | ACCEPT | Tier CI: chromium-only per-PR, full matrix nightly |
| 8 | Medium | ACCEPT | Dark-only E1; no toggle |
| 9 | Medium | ACCEPT | Replace stub with infra tests |
| 10 | Medium | ACCEPT | Split exit criteria by automation |
| 11 | Medium | PARTIAL | Defer codegen to E2; hand-write in E1 |

**Net outcome:** plan gets simpler (less scope in E1), more robust (migration step, DB roles, tighter Sentry), and more honestly testable (infra tests, two-bucket exit criteria). Zero findings rejected.

## Follow-up actions in beads

1. **New task:** `E1-10a: Preview branch migration step` (under E1 epic). Depends on E1-06 and E1-10.
2. **Modify:** E1-01 — switch to pnpm + Node 22.
3. **Modify:** E1-04 — drop `/status/data` from scope.
4. **Modify:** E1-05 — add three-role setup.
5. **Modify:** E1-07 — explicit sampling rates + PII scrubbing list.
6. **Modify:** E1-08a — configure 4 browsers but default to chromium in per-PR workflow.
7. **Modify:** E1-08b — target <4 min per-PR CI; chromium-only.
8. **Add:** `E1-08c: Nightly CI workflow` (firefox/webkit/mobile-chrome).
9. **Modify:** E1-02c — dark-only snapshot.
10. **Modify:** E1-03 — drop theme toggle.
11. **Defer:** E1-15 Schema sync CI check → E2.
12. **New task:** `E2-00a: Hand-write etl/models.py MetaRefresh` (under E2 epic). Depends on E1-06.
