# E8 Sandbox plan — adversarial review

**Reviewer:** OpenAI Codex (gpt-5-codex, high reasoning)
**Target:** `docs/plans/e8-sandbox-plan.md` v1 draft
**Run:** 2026-04-22, 253k tokens
**Verdict:** 6 findings — all accepted. Plan rewritten + two task descriptions expanded.

---

## Findings + adjudication

### F1 — Bundle leak risk: tree-shake alone won't drop `lib/sandbox`

> "The optimizer can't prove `isSandbox()` is constant because `SANDBOX_MODE` is read at runtime, so the banner string and fixture payloads will survive in `.next` output. The proposed CI grep will therefore trip every build (string is still in the compiled module) or, if you drop the sentinel, the fixtures remain downloadable. You need an explicit prod alias (e.g. webpack `resolve.alias`) or build-step stripping, not faith in tree-shaking."

**Accepted.** Next 16 + Turbopack doesn't reliably inline `process.env.SANDBOX_MODE === '1'` as a compile-time constant for dead-code elimination, particularly for dynamic imports.

**Fix:** Amend `next.config.ts` with a resolve.alias that swaps `@/lib/sandbox` to an empty stub module when `SANDBOX_MODE !== '1'`:

```ts
// next.config.ts
const sandboxEnabled = process.env.SANDBOX_MODE === '1';
const nextConfig: NextConfig = {
  // ...existing config...
  webpack(config) {
    if (!sandboxEnabled) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@/lib/sandbox': path.resolve(__dirname, 'lib/sandbox/empty-stub.ts'),
      };
    }
    return config;
  },
};
```

`lib/sandbox/empty-stub.ts` exports every symbol the rest of the app imports, all as throw-on-call stubs. Any accidental call in prod crashes loudly rather than silently returning a fixture.

CI grep sentinel stays (belt + suspenders) but is no longer the primary guard.

**Task updates:**
- **E8-09** rewritten from "bundle exclusion via dead-code-elimination" to "resolve.alias stub swap + CI grep".
- **E8-01** adds the empty-stub file + unit test asserting it throws.

---

### F2 — Client gating bug: `SANDBOX_MODE` isn't visible to the browser

> "The plan relies on calling `process.env.SANDBOX_MODE` from a `'use client'` component, but browser code only sees variables prefixed `NEXT_PUBLIC_` or baked via `next.config.ts`. Nothing in `next.config.ts` exposes `SANDBOX_MODE`, so `isSandbox()` will always be false in the browser and the banner/toolbar never render, even in sandbox dev."

**Accepted. Critical.** This breaks the whole sandbox UX — the banner and Agentation toolbar are client components and would never mount.

**Fix:** Rename the env var from `SANDBOX_MODE` → `NEXT_PUBLIC_SANDBOX_MODE`. Next's webpack auto-inlines `NEXT_PUBLIC_*` variables into client bundles at build time.

Server-side code keeps reading `process.env.NEXT_PUBLIC_SANDBOX_MODE` too — one name, both environments.

**Task updates:**
- **E8-01** env gate uses `NEXT_PUBLIC_SANDBOX_MODE`.
- **E8-05** `pnpm dev:sandbox` exports `NEXT_PUBLIC_SANDBOX_MODE=1` instead.

This also addresses a subtle concern: `NEXT_PUBLIC_` variables are inlined at build time, which means the value is "frozen" per bundle. That's what we want — a bundle built with `SANDBOX_MODE=1` is permanently sandbox, and vice versa. No runtime flip risk.

---

### F3 — Three-layer safety hole: env.ts throw isn't universal

> "Layer 3 (throw in `lib/env.ts`) only fires once something touches `getServerEnv()`. Middleware, static routes, and any request that bails before a DB call will happily run with `SANDBOX_MODE=1`, so you still risk shipping the sandbox UI briefly before the first data fetch crashes the process."

**Accepted.** The env.ts import-triggered throw isn't guaranteed to run before a request serves static HTML.

**Fix:** Move the prod-safety check into Next's `instrumentation.ts` hook, which runs exactly once at process startup before any request is served. The file already exists in the repo (Sentry boots from it).

```ts
// instrumentation.ts (addition)
export async function register() {
  if (process.env.NEXT_PUBLIC_SANDBOX_MODE === '1') {
    const prod =
      process.env.VERCEL_ENV === 'production' ||
      process.env.NODE_ENV === 'production';
    if (prod) {
      throw new Error(
        'NEXT_PUBLIC_SANDBOX_MODE=1 detected in a production environment. ' +
        'This must never happen — remove the env var from the deploy target.',
      );
    }
  }
  // ...existing Sentry registration...
}
```

Fails at boot, before any route handler runs. Deploy can't even accept a connection.

**Task updates:**
- **E8-01** moves the safety check to `instrumentation.ts`.

---

### F4 — Shell injection: `JSON.stringify` isn't a shell escape

> "`JSON.stringify` doesn't neutralize shells — `$(whoami)` or backticks inside the annotation text still execute because they survive inside the double quotes. The bridge must switch to `spawn/execFile` with an argv array or at least rigorous escaping; right now the API is trivially exploitable."

**Accepted.** Pre-flagged in the plan's own "expected pushback" section, but the fix was hand-waved. Codex is right to call it.

**Fix:** Use `execFile` with argv array. Bypasses shell interpretation entirely.

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const pExecFile = promisify(execFile);

const { stdout } = await pExecFile('bd', [
  'create',
  '--type=task',
  '--priority=2',
  `--title=${title}`,
  `--description=${description}`,
]);
```

No shell means no shell injection. Even `$(whoami)` in the annotation text is just a literal string to `bd`'s argv parser.

**Task updates:**
- **E8-08** description rewritten to mandate `execFile` + argv. Explicitly forbids `exec`.

---

### F5 — `bd` ENOENT blind spot

> "The whole pitch is 'clone → pnpm install → pnpm dev:sandbox,' but the plan never handles `ENOENT` when `bd` isn't on PATH. Every annotation POST becomes a 500 with an opaque error, so the 'zero setup' goal collapses for a new collaborator."

**Accepted.** Real onboarding hazard, even if I'm the only user today.

**Fix:** API route does a presence check at module scope and returns 503 with a readable error if missing:

```ts
const bdAvailable = await pExecFile('which', ['bd']).then(() => true).catch(() => false);
// In the handler:
if (!bdAvailable) {
  return Response.json(
    { error: 'bd CLI not found on PATH. See docs/sandbox.md §setup.' },
    { status: 503 },
  );
}
```

The sandbox-banner also surfaces this state: if `bdAvailable` is false, the banner gains a secondary line: *"Annotations disabled — bd not installed."*

`docs/sandbox.md` (E8-11) gets a §setup section with the one-line install.

**Task updates:**
- **E8-08** adds the presence check + 503 contract.
- **E8-06** banner conditionally surfaces the "annotations disabled" state.
- **E8-11** adds §setup.

---

### F6 — Fixture drift time bomb

> "Stubbing `lib/data/phases.ts` and `lib/data/coaching.ts` with hand-written fixtures means any schema tweak (new phase in `PHASES`, new rollup key in `computeCoachSegments`) silently diverges. There's no regeneration pipeline (the dump script is P3 'optional'), and the proposed unit tests only check that augmenters fire, not that fixture shapes still satisfy the live DAL contracts. The sandbox will rot the first time the production queries evolve."

**Accepted.** The plan's handwave was "tsc catches schema drift via typed exports". That catches *structural* drift (column added/removed) but not *semantic* drift (phase added to PHASES enum, new rollup field introduced that reads as `undefined` for every fixture row).

**Fix two-pronged:**

1. **Promote E8-10 dump script from P3 → P2** and land it as part of the initial cut. Running `pnpm sandbox:regenerate` against prod produces fixture TS files that are guaranteed shape-correct for the current DAL + schema. The edge-case augmenter overlays its deliberate edge rows on top of the dump output.

2. **Add a new task E8-13: fixture contract test.** For each stub, assert at test time that the set of keys returned matches the set of keys the real DAL returns for the same query. Runs in CI against a golden prod-like fixture, not live Neon. When the DAL evolves, this test breaks first — forcing an explicit fixture regeneration instead of a silent semantic drift.

```ts
// tests/unit/sandbox-fixture-contract.test.ts
describe('sandbox fixtures match DAL contract', () => {
  it('getPhaseRankSnapshot stub returns same keys as prod DAL', () => {
    const stubKeys = Object.keys(stubPhaseRankSnapshot[0]).sort();
    const expected = ['phase', 'rank', 'epaPerPlay', 'plays', 'insufficientSample'].sort();
    assert.deepEqual(stubKeys, expected);
  });
  // ... one per stub
});
```

**Task updates:**
- **E8-10** priority P3 → P2; lands as part of initial sprint, not as an optional follow-up.
- **E8-13** (new) fixture contract test suite.

---

## Summary

All 6 findings accepted, 0 disputed. Plan v1 draft had one critical bug (F2 — banner would never render), one severe bug (F4 — shell injection), two "lose the main value prop" bugs (F1 bundle leak + F6 fixture rot), and two onboarding / robustness holes (F3 + F5).

Good call asking codex; I would not have caught F2 or F1 without the second opinion.

**Plan v2 delta:**

- Env var renamed `SANDBOX_MODE` → `NEXT_PUBLIC_SANDBOX_MODE` throughout.
- Bundle exclusion upgraded from tree-shake-hope → webpack resolve.alias + stub module.
- Safety-check moved from `lib/env.ts` → `instrumentation.ts` register hook.
- Annotation bridge mandates `execFile` + argv, never `exec`.
- Annotation bridge adds `bd` presence check + readable 503.
- Fixture dump script promoted from P3 to P2; new E8-13 fixture contract test.

Net scope change: +1 subtask (E8-13), 1 task priority bumped (E8-10 P3→P2), 6 task descriptions rewritten. Design-level cost: ~0; the new shape is strictly safer without adding user-facing surface.
