# Sandbox mode

Local-only mode where the site renders against hand-curated fixtures instead of Postgres. Lets you iterate on UI/UX + Agentation annotations without hitting prod data.

## Quick start

```bash
pnpm dev:sandbox
```

That sets `NEXT_PUBLIC_SANDBOX_MODE=1` and boots `next dev`. The amber **Sandbox mode** banner at the top of every page confirms you're in.

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
