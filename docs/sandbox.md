# Sandbox mode

Local-only mode where the site renders against hand-curated fixtures instead of Postgres. Lets you iterate on UI/UX + Agentation annotations without hitting prod data.

## Quick start

```bash
pnpm dev:sandbox
```

That sets `NEXT_PUBLIC_SANDBOX_MODE=1` and wraps `next dev` with [portless](https://github.com/vercel-labs/portless). Portless assigns a free port in 4000–4999 (via `$PORT`) and routes **https://sandbox.localhost** to it through its HTTPS+HTTP/2 proxy. Port 3000 stays free for the non-sandbox `pnpm dev`.

The amber **Sandbox mode** banner at the top of every page confirms you're in.

### First-run setup

Portless binds port 443 and needs a trusted local CA. On the first run:

1. Portless prompts for `sudo` to bind 443 (macOS/Linux)
2. It generates a CA and adds it to your system trust store — no browser warnings after that
3. If you skipped the trust prompt, run `pnpm exec portless trust` later

If you want plain HTTP (no TLS, no sudo), start the proxy once with `pnpm exec portless proxy start --no-tls` — the dev URL becomes `http://sandbox.localhost`.

## How it works

1. `lib/sandbox/index.ts` exports `isSandbox()` — checks `process.env.NEXT_PUBLIC_SANDBOX_MODE === '1'`. The `NEXT_PUBLIC_` prefix is required so the client bundle sees the flag too.
2. Every DAL reader in `lib/data/*.ts` starts with:
   ```ts
   if (isSandbox()) {
     const stub = await import('@/lib/sandbox/stubs/<name>');
     return stub.<fn>(...args);
   }
   ```
   The prod Postgres query runs only when `isSandbox()` is false.
3. Stubs in `lib/sandbox/stubs/*.ts` re-export functions matching prod DAL signatures. They return slices of the fixtures in `lib/sandbox/fixtures/*.ts`.
4. `components/sandbox/SandboxBanner.tsx` + `AgentationToolbar.tsx` are rendered from the root layout. Both early-return `null` when `SANDBOX_ACTIVE` is false, so prod users never see them.

## Prod isolation

Three layers, belt + suspenders + CI sentinel:

1. **Runtime guard** (`lib/sandbox/env-guard.ts`) — `assertSandboxNotInProd()` runs from `instrumentation.ts` on every boot. If `NEXT_PUBLIC_SANDBOX_MODE=1` slips through on a `VERCEL_ENV=production` or `NODE_ENV=production` deploy, the process crashes before serving a single request.
2. **Build-time alias** (`next.config.ts`) — when sandbox is off, webpack rewrites every `@/lib/sandbox/fixtures/*` and `@/lib/sandbox/stubs/*` import to `lib/sandbox/empty-stub.ts`. That module's exports are either safe constants or throw-on-call stubs, so no fixture bytes enter the prod bundle and any accidental invocation crashes loud in Sentry.
3. **CI sentinel** (`.github/workflows/sandbox-isolation.yml`) — grep the built `.next/` for known fixture-only strings (`teamOverview2025`, `"TreVeyon Henderson"`, etc.). If any leak, the job fails.

## Agentation bridge

Sandbox ships with a floating **Agentation** toolbar (bottom-right). Click an element to focus it, add a note, hit **File annotation**. The client posts to `/api/sandbox-annotation`, which calls `bd create` with the selector + note and returns the new `bd-XXXX` task id.

Security on the bridge:
- Route returns 403 unless `SANDBOX_ACTIVE` is true.
- Input is zod-validated + length-clamped (selector ≤ 500, note ≤ 2000).
- `bd create` is invoked via `execFile('bd', [argv])` — no shell, no interpolation.

## Edge cases exercised by the fixtures

- `phaseSnapshot2025` ties `rush_offense` and `special_teams` at rank 14 (tiebreak display)
- `phaseDetails2025['explosive_defense']` sets `insufficientSample=true`, `totalQualified=28` (K<32 copy path)
- `sparklines2025['special_teams']` has `value: null` at week 13 (gap-render in Sparkline)
- `coachSegments2025` splits OC mid-season (McDaniels wk 1–9, Patricia wk 10–18) per §3.5a
- `draftRoi[2023]` includes a traded-out slot with `gsisId = null`
- `fourthDownDecisions2025` mixes agreed + disagreed HC calls

## Regenerating fixtures from prod

`pnpm sandbox:regenerate` re-pulls real prod rows through the live DAL readers and re-emits `lib/sandbox/fixtures/*.ts`. Run it whenever the schema or DAL signatures evolve so fixtures don't rot.

```bash
DATABASE_URL='postgres://app_read:...@host/db' pnpm sandbox:regenerate
DATABASE_URL='...' pnpm sandbox:regenerate -- --dry-run        # no writes
DATABASE_URL='...' pnpm sandbox:regenerate -- --no-augment     # raw prod, no edge-case overlays
DATABASE_URL='...' pnpm sandbox:regenerate -- --season=2024    # snapshot a specific season
```

The script is read-only — every query goes through the existing DAL readers, which run exclusively SELECTs. Use the `app_read` role as belt + suspenders. It refuses to run if `NEXT_PUBLIC_SANDBOX_MODE=1` (would dump fixtures back into themselves) or if `DATABASE_URL` is missing.

The augmenter (default on) overlays edge cases that real prod rarely contains so the sandbox UI exercises every render path:

- Tied ranks at 14 (rush_offense + special_teams) — tiebreak display
- `explosive_defense` flagged insufficient with `totalQualified < 32` — K<32 copy path
- One null sparkline point in `special_teams` — gap-render path
- Mid-season OC split (§3.5a) — two coaching segments instead of one
- Tie game in recent results — third W/L/T result code
- Synthetic traded-out draft slot + at least one HIT grade — every grade-badge path
- Non-empty fourthDownDecisions — FourthDownLedger module instead of "Model pending"

The augmenter also injects four CI sentinel strings that nothing in real prod could produce:

- `__SANDBOX_FIXTURE__tie_game` (team.ts gameId)
- `__SANDBOX_FIXTURE__draft_pick` (draft.ts gsisId)
- `__SANDBOX_FIXTURE__phase_team` (phases.ts distribution row)
- `[augmented] mid-season replacement` (coaching.ts coachName)

`.github/workflows/sandbox-isolation.yml` greps the prod build for these — if any leak into `.next/`, the alias map in `next.config.ts` failed and the workflow fails. If you change the sentinel strings in `scripts/sandbox-dump.ts`, mirror them in the workflow.

After regenerating: `pnpm typecheck && pnpm test && pnpm build` is the sanity gate. Diff the fixtures, eyeball them, then commit.

`--no-augment` is for inspection (what does raw prod look like?), not for committing — the fixture-contract test in `tests/unit/sandbox-fixture-contract.test.ts` will fail because the edge-case rows aren't injected.

## Adding a new DAL

1. Add a stub in `lib/sandbox/stubs/<name>.ts` matching the prod function signature
2. Seed any new fixture data in `lib/sandbox/fixtures/<name>.ts`
3. Wrap the prod reader with the `if (isSandbox())` guard
4. Add the new stub path to the alias map in `next.config.ts`
5. Mirror each new function name as a throw-on-call export in `lib/sandbox/empty-stub.ts`
6. If the fixture contains a unique string that nothing in prod could produce, add it to the CI sentinel list in `.github/workflows/sandbox-isolation.yml`

## Gotchas

- **Fresh env reads.** `lib/sandbox/index.ts` reads `process.env.NEXT_PUBLIC_SANDBOX_MODE` on every `isSandbox()` call rather than caching. Needed because env tests stash/restore; also keeps `NEXT_PUBLIC_*` injection honest.
- **Don't static-import from `@/lib/sandbox/stubs`.** Always `await import(...)` inside the DAL wrapper. Static imports bypass the dynamic-chunk code-split and can fight the alias.
- **`SANDBOX_ACTIVE` vs `isSandbox()`.** The constant is fine for rendering guards (`if (!SANDBOX_ACTIVE) return null`). The function is required for any path that could be called after env mutation in a test.
