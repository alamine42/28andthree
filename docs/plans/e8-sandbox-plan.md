# E8: UI/UX Sandbox — Technical Plan

**Status:** v2 (post-codex adversarial review — 6 findings adjudicated)
**Beads epic:** `patsbythenumbers-l6u`
**Sprint:** post-launch polish (2026-05, after M6 soft launch)
**Review doc:** `e8-sandbox-plan-adversarial-review.md`

> **v2 delta vs v1 draft:**
> - Env var renamed `NEXT_PUBLIC_SANDBOX_MODE` → `NEXT_PUBLIC_NEXT_PUBLIC_SANDBOX_MODE` (client-side visibility).
> - Bundle exclusion swapped from tree-shake-hope to webpack `resolve.alias` + empty-stub module.
> - Safety check moved from `lib/env.ts` import-time → `instrumentation.ts` register hook (fires at process start, before any request).
> - Annotation bridge mandates `execFile` + argv array, never `exec` with shell quoting.
> - Annotation bridge adds `bd` presence check + readable 503.
> - E8-10 fixture dump script promoted P3 → P2 (landed initially, not optional).
> - New E8-13 fixture contract test suite.

---

## 1. Context

### Problem
Today every UI component that renders conditionally on data falls through to an empty-state branch in local dev, because:

1. Prod Neon can be accessed locally (`DATABASE_URL` in `.env.local`), but seeding new fixture paths or exercising deliberate edge cases (coordinator splits, tied ranks, insufficient samples) is either hard (write SQL) or impossible (no prod row triggers it).
2. The §3.5a mid-season coordinator-change segmentation logic has zero real-data coverage in 2025 — no Pats OC change has happened yet, so the "two rows" code path only runs in unit tests, never in a browser.
3. Iterating on visual details requires either waiting on the ETL, hand-crafting a row, or developing against empty state. All three are slow.

### Audience
Solo designer-engineer (Mehdi). Post-launch, the loop is: "I don't like this card" → annotate on the live sandbox → task appears in beads → implement + reload → verify. Remove the seam between "I see a UI problem" and "there's a task queued to fix it."

### Why now
Launch-ready; post-launch the rate of UI change accelerates. The fixture layer also enables future design reviews ("here's the coaching page with every possible state at once") that prod data can't render.

### Success (qualitative)
- Onboarding a hypothetical collaborator requires `git clone && pnpm install && pnpm dev:sandbox` → immediately see every page populated. Zero DB setup.
- Any UI bug involving a weird data shape can be reproduced in sandbox by editing a fixture file, never by writing SQL.
- Design annotations become backlog tasks with zero copy-paste overhead.

### Success (quantitative acceptance)
See §1.3 in the beads epic description; mirrored in the task list at §8 below.

---

## 2. UX

### Entry flow

```
$ pnpm dev:sandbox
  ▸ starts Next dev with NEXT_PUBLIC_SANDBOX_MODE=1
  ▸ opens localhost:3000 — every page populated
  ▸ amber "SANDBOX DATA — NOT LIVE" strip under the nav
  ▸ Agentation toolbar appears in bottom-right (sandbox-only load)
```

### Banner

Amber `--positive-dim` background, 2px `--positive` top-border, mono 2xs uppercase. Role `alert`, `aria-live=polite`. One copy variant:

> **SANDBOX DATA — NOT LIVE.** Annotations post to beads. Dismiss for this session.

Dismiss button on the right, 44×44 hit target. Session-local (`sessionStorage`), so it reappears on every new tab but not on F5 within the same tab.

### Annotation flow

1. User clicks any element on the page (Agentation toolbar captures the target).
2. Draws an optional highlight / writes a note.
3. Submits.
4. Toolbar POSTs `{page, selector, screenshot, text}` to `/api/sandbox-annotation`.
5. API route shells out to `bd create --type=task --title=… --description=…`.
6. Returns the task ID; toolbar shows a toast: *"Created task patsbythenumbers-xyz — open in beads"*.
7. User continues iterating or opens the task.

### Failure modes the UX handles

- Agentation backend unreachable: toolbar surfaces inline error, no ghost tasks.
- `bd create` fails: API route returns 500 with the `bd` stderr; toolbar shows it.
- Sandbox mode off (someone hit `/api/sandbox-annotation` on a real dev instance): route returns 404, no backend contact.

---

## 3. Technical design

### Module layout

```
lib/
  sandbox/
    index.ts             # isSandbox() + NEXT_PUBLIC_SANDBOX_MODE constant
    load.ts              # fixture loader w/ module-level memoization
    fixtures/
      team-overview.ts
      phase-snapshot.ts
      phase-weekly.ts
      qb.ts
      skill.ts
      draft.ts
      coaching.ts
      roster.ts
      meta-refresh.ts
      _edge-cases.ts     # helpers that augment base fixtures with tricky rows
    stubs/
      draft.ts           # returns types from lib/data/draft.ts
      coaching.ts        # "  "  " lib/data/coaching.ts
      phases.ts          # …
      (one stub per lib/data/*.ts)
  env.ts                 # +NEXT_PUBLIC_SANDBOX_MODE + prod-safety check

app/
  api/
    sandbox-annotation/
      route.ts           # POST, sandbox-guarded, localhost-guarded
  layout.tsx             # +<SandboxChrome> conditional render

components/
  SandboxBanner.tsx      # amber strip
  SandboxChrome.tsx      # banner + Agentation toolbar wrapper (client)

scripts/
  sandbox-dump.ts        # read-only prod → fixture regenerator (P3)

tests/
  unit/
    sandbox-gate.test.ts
    sandbox-fixtures.test.ts
    sandbox-env-guard.test.ts
  e2e/
    sandbox.spec.ts

docs/
  sandbox.md             # workflow doc
  plans/
    e8-sandbox-plan.md   # this file
```

### The gate: `isSandbox()`

```ts
// lib/sandbox/index.ts
export const SANDBOX_ACTIVE = process.env.NEXT_PUBLIC_SANDBOX_MODE === '1';
export function isSandbox(): boolean { return SANDBOX_ACTIVE; }
```

**Why `NEXT_PUBLIC_` prefix?** Next's webpack auto-inlines `NEXT_PUBLIC_*` variables into the client bundle at build time. Without the prefix, `process.env.NEXT_PUBLIC_SANDBOX_MODE` evaluates to `undefined` in the browser — the banner and Agentation toolbar would never mount. (This was codex F2 — plan v1 missed it.)

**Build-time baking:** `NEXT_PUBLIC_*` is frozen per bundle. A bundle built with `NEXT_PUBLIC_SANDBOX_MODE=1` is permanently sandbox; the regular `pnpm dev` bundle cannot runtime-flip into sandbox and vice versa. That matches our safety model — one deployment, one mode, no ambiguity.

### DAL wrapper pattern

Every `lib/data/*.ts` reader gets a 3-line sandbox branch at the top:

```ts
// lib/data/phases.ts
import { isSandbox } from '@/lib/sandbox';

export async function getPhaseRankSnapshot(
  team: string,
  season: number,
): Promise<PhaseSnapshot[]> {
  if (isSandbox()) {
    const { getPhaseRankSnapshot: stub } = await import('@/lib/sandbox/stubs/phases');
    return stub(team, season);
  }
  // …existing DB code unchanged…
}
```

Three properties this buys:
1. **Tree-shakeable:** `if (isSandbox())` is a static false when `NEXT_PUBLIC_SANDBOX_MODE !== '1'` at build time. Webpack DefinePlugin inlines the value and dead-code-eliminates the whole branch. No fixtures ship in the production bundle.
2. **No refactor risk:** the production DAL code path is byte-identical to today. Sandbox is additive.
3. **Runtime-switchable in dev:** if you set `NEXT_PUBLIC_SANDBOX_MODE=1 pnpm dev` vs `pnpm dev`, the same bundle serves both (dynamic import resolves the stub on first call).

### Fixture format: TS, not JSON

The epic survey answered "JSON fixtures". After sketching both, TS files win:

| Property | JSON | TS |
|---|---|---|
| Schema-drift detection at edit time | No (parse-time only) | Yes (tsc catches it) |
| Ergonomics | Quotes everywhere | Imports, reuse, computed values |
| IDE autocomplete | Weak | Full |
| Version control diff | Readable | Readable |
| Runtime load cost | Equivalent | Equivalent |

Fixture files look like:

```ts
// lib/sandbox/fixtures/phase-snapshot.ts
import type { PhaseSnapshot } from '@/lib/data/phases';

export const baseSnapshot: PhaseSnapshot[] = [
  { phase: 'pass_offense', rank: 1, epaPerPlay: 0.32, plays: 612, insufficientSample: false },
  { phase: 'rush_offense', rank: 14, epaPerPlay: 0.02, plays: 480, insufficientSample: false },
  // ... 11 phases
];

export const tiedSnapshot: PhaseSnapshot[] = [/* two phases at same EPA */];
```

The stub (`lib/sandbox/stubs/phases.ts`) composes `baseSnapshot` with edge-case augmenters from `_edge-cases.ts`.

**Tradeoff noted:** if you prefer true JSON (stricter separation of data vs code), swap to `*.json` files with a zod parser in `load.ts` for validation. The cost is losing compile-time schema checks. Staying with TS unless you push back.

### Season coverage: 2024 + 2025

- 2025 is "this season" — populates hero, phase grid, coaching, draft, etc.
- 2024 is required for: YoY rank delta (hero overall card), sparkline history that crosses the season boundary, prior-season snapshot in methodology copy.

No earlier seasons in sandbox; sparklines use only last-8-weeks within 2025, and the YoY comparison only needs 1 prior year. Keeps fixture size small (~1,500 rows total across all tables).

### Edge-case augmenters

Invisible to callers; applied automatically by stubs. Live in `_edge-cases.ts`:

| Augmenter | Affects | Target UI path |
|---|---|---|
| `injectInsufficientSampleWeek()` | `phase-weekly` fixture: one week with plays=8 for `special_teams` | `n < 30` caveat, `—` instead of rank |
| `injectCoordinatorChange()` | `coaching-weekly` fixture: two OC tenures (McDaniels weeks 1-9, Patricia weeks 10-18) | §3.5a segment rendering on /coaching |
| `injectBadRawNumbers()` | Source fields only (epa, ydstogo) on 1% of plays | Formatters collapse to em-dash at render |
| `injectTiedRanks()` | Two teams at identical EPA in `phase-season` | Tiebreak display + rank tier color stability |

Tests assert each augmenter actually fires in the rendered page (e2e) and that the raw fixture contains the injected rows (unit).

### Bundle exclusion — webpack resolve.alias (primary) + CI grep (belt)

> **v1 draft relied on tree-shake alone; codex F1 showed that's insufficient on Next 16.** Turbopack can't always prove `isSandbox()` is compile-time constant, so the sandbox chunk survives in `.next`. v2 swaps in an explicit module alias.

`next.config.ts` swaps `@/lib/sandbox` → `lib/sandbox/empty-stub.ts` when the env var is unset:

```ts
// next.config.ts
import path from 'node:path';

const sandboxEnabled = process.env.NEXT_PUBLIC_SANDBOX_MODE === '1';

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

`lib/sandbox/empty-stub.ts` re-exports every symbol the app imports, each as a `throw` stub:

```ts
export const SANDBOX_ACTIVE = false as const;
export function isSandbox(): boolean { return false; }
export const loadFixture = () => { throw new Error('sandbox stub hit in prod'); };
// ...one throw-stub per public symbol
```

Any accidental prod call = loud crash (caught by Sentry), not a silent wrong value.

**CI grep (defense in depth):** after `pnpm build`, grep `.next/static/chunks/**/*.js` for the sentinel string `__SANDBOX_BANNER_MARKER__` baked into `SandboxBanner.tsx`. If it appears in a non-sandbox build, fail the build.

### Agentation toolbar integration

1. Invoke the `agentation` skill — it handles the npm install + config.
2. Wrap in `components/SandboxChrome.tsx`:

```tsx
'use client';
import { isSandbox } from '@/lib/sandbox';
import { SandboxBanner } from './SandboxBanner';
import dynamic from 'next/dynamic';

const AgentationToolbar = dynamic(
  () => import('@agentation/toolbar').then(m => m.Toolbar),
  { ssr: false, loading: () => null },
);

export function SandboxChrome() {
  if (!isSandbox()) return null;
  return (
    <>
      <SandboxBanner />
      <AgentationToolbar onAnnotate={submitAnnotation} />
    </>
  );
}
```

Dynamic + `ssr:false` keeps Agentation out of the server bundle entirely, and the outer `if (!isSandbox()) return null` is a static false in prod → the whole module tree drops.

### Beads bridge

> **Codex F4 flagged the v1 `exec`-based shell as injectable** (`JSON.stringify` escapes JSON, not shell). **F5 flagged missing `bd`-not-installed handling.** v2 uses `execFile` + argv + a presence probe.

```ts
// app/api/sandbox-annotation/route.ts
import { z } from 'zod';
import { isSandbox } from '@/lib/sandbox';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const pExecFile = promisify(execFile);

// Probe once at module scope; cached for the process lifetime.
const bdAvailable = await pExecFile('which', ['bd'])
  .then(() => true)
  .catch(() => false);

const BodySchema = z.object({
  page: z.string().max(200),
  text: z.string().min(1).max(2000),
  selector: z.string().max(500).optional(),
  screenshot_url: z.string().url().optional(),
});

export async function POST(req: Request): Promise<Response> {
  if (!isSandbox()) return new Response('not found', { status: 404 });

  // Localhost guard — belt + suspenders on top of NEXT_PUBLIC_SANDBOX_MODE.
  const host = req.headers.get('host') ?? '';
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  if (!/^(localhost|127\.0\.0\.1|\[::1\])/.test(host) && fwd !== '') {
    return new Response('localhost only', { status: 403 });
  }

  if (!bdAvailable) {
    return Response.json(
      { error: 'bd CLI not found on PATH. See docs/sandbox.md \u00A7setup.' },
      { status: 503 },
    );
  }

  const body = BodySchema.safeParse(await req.json());
  if (!body.success) return new Response('invalid body', { status: 400 });

  const title = `Sandbox annotation: ${body.data.page}`;
  const description = [
    body.data.text,
    '',
    `Page: ${body.data.page}`,
    `Selector: ${body.data.selector ?? '(none)'}`,
    `Screenshot: ${body.data.screenshot_url ?? '(none)'}`,
  ].join('\n');

  // argv array form — no shell interpretation of the values. `$(whoami)`
  // in the annotation text is just a literal string to bd's argv parser.
  const { stdout } = await pExecFile('bd', [
    'create',
    '--type=task',
    '--priority=2',
    `--title=${title}`,
    `--description=${description}`,
  ]);
  const match = stdout.match(/patsbythenumbers-[a-z0-9]+/);
  return Response.json({ taskId: match?.[0] ?? null });
}
```

Security properties:
- `execFile` with argv bypasses the shell entirely. No metacharacters interpreted, no injection surface.
- `isSandbox()` + localhost check = two independent gates.
- `bdAvailable` probe fails readable if the collaborator machine lacks `bd`; `docs/sandbox.md` links to the install.
- SandboxBanner surfaces `bdAvailable === false` as a secondary line: *"Annotations disabled \u2014 bd not installed."*

### Env safety check

> **Codex F3 flagged v1's "throw on `lib/env.ts` import" as non-universal** — middleware-only requests or static routes can skip it. v2 moves the check to `instrumentation.ts`, which Next calls exactly once at process startup before any request is served.

```ts
// instrumentation.ts (addition on top of existing Sentry register)
export async function register() {
  if (process.env.NEXT_PUBLIC_SANDBOX_MODE === '1') {
    const prod =
      process.env.VERCEL_ENV === 'production' ||
      process.env.NODE_ENV === 'production';
    if (prod) {
      throw new Error(
        'NEXT_PUBLIC_SANDBOX_MODE=1 detected in a production environment. ' +
        'This must never happen \u2014 remove the env var from the deploy target.',
      );
    }
  }
  // ...existing Sentry registration follows...
}
```

Fails fast at boot, before the server accepts a single connection. The deploy literally cannot serve a request with the bad env set.

### Production bundle safety: three layers (v2)

1. **Webpack resolve.alias** — `@/lib/sandbox` resolves to `empty-stub.ts` in any build where `NEXT_PUBLIC_SANDBOX_MODE !== '1'`. The directory's actual code is never reachable from a prod bundle. Stubs throw on call, so accidental prod invocation = loud Sentry error, never silent wrong data.
2. **CI grep** — post-build, grep `.next/static/chunks/**/*.js` for the sentinel `__SANDBOX_BANNER_MARKER__`. Fails the deploy if it leaks.
3. **Boot-time throw** — `instrumentation.ts` throws at process startup if `NEXT_PUBLIC_SANDBOX_MODE=1` and `VERCEL_ENV=production`. Deploy can't even accept a connection.

One of the three failing = bug; two failing = severe; three failing = incident. Defense in depth: the first guard alone is sufficient for safety; the other two catch mistakes in the first.

---

## 4. E2E tests (authored before implementation)

### `tests/e2e/sandbox.spec.ts` — 16 specs

Runs with a sibling `playwright.sandbox.config.ts` that sets `NEXT_PUBLIC_SANDBOX_MODE=1` in the webServer block:

```ts
webServer: {
  command: 'pnpm dev:sandbox',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,
}
```

Specs:

1. `banner_renders_on_every_public_route` — visits /, /players, /draft-roi, /coaching, /methodology, /phases/pass_offense; asserts `getByRole('alert')` with "SANDBOX DATA" text on each.
2. `banner_dismiss_persists_across_navigations_within_session` — click dismiss on /, navigate to /coaching, banner still hidden.
3. `banner_returns_on_new_tab` — open /coaching in a new context, banner back.
4. `hero_stats_populated_not_empty_state` — / shows numeric overall rank (matches `/^\d+(st|nd|rd|th)$/`), not em-dash.
5. `phase_grid_shows_11_cards_with_real_ranks` — each card's rank element matches ordinal regex.
6. `coaching_shows_two_oc_segments_from_mid_season_change` — `/coaching` CoachSegmentBanner renders two OC rows in the OC card (McDaniels + Patricia).
7. `draft_roi_has_both_hit_and_miss_badges` — `/draft-roi` has `[data-testid=grade-hit]` count ≥ 1 and `[data-testid=grade-miss]` count ≥ 1.
8. `coaching_fourth_down_ledger_has_decisions_not_pending` — `/coaching` shows `[data-testid=fourth-down-scatter]` (ledger), not `fourth-down-pending`.
9. `insufficient_sample_rendered_on_special_teams_week` — `/phases/special_teams` weekly trend shows at least one week with the `n < 30` caveat (or the corresponding no-value marker).
10. `bad_number_collapses_to_em_dash_not_NaN` — no-bad-numbers crawler assertion against sandbox renders (pulls from no-bad-numbers.spec.ts pattern).
11. `tied_phase_ranks_do_not_produce_duplicate_rank_numbers` — phase rank grid: no two cards show the same `/^\d+(st|nd|rd|th)$/`.
12. `sandbox_annotation_api_returns_404_when_sandbox_mode_off` — hit `/api/sandbox-annotation` against non-sandbox webServer, expect 404. (Requires secondary spec file or env toggle.)
13. `sandbox_annotation_api_creates_task_in_sandbox_mode` — POST valid body, expect 200 + `taskId` pattern. (Uses a fake `bd` stub in PATH for CI determinism.)
14. `sandbox_annotation_rejects_invalid_bodies` — POST malformed → 400.
15. `agentation_toolbar_mounts_in_sandbox_only` — presence of the toolbar's root element; absent on non-sandbox boot.
16. `production_build_excludes_sandbox_bundle` — separate CI step: run `pnpm build` without `NEXT_PUBLIC_SANDBOX_MODE`, grep `.next/static/chunks/**/*.js` for `__SANDBOX_BANNER_MARKER__`, expect zero matches. Also assert `@/lib/sandbox` resolves to `empty-stub.ts` in the bundle output.
17. `banner_shows_bd_missing_state_when_bd_absent` — start sandbox with `PATH` scrubbed of `bd`; banner shows the "Annotations disabled — bd not installed" secondary line; `/api/sandbox-annotation` returns 503.

### Unit tests

- `tests/unit/sandbox-gate.test.ts` — `isSandbox()` reads env; idempotent; false by default.
- `tests/unit/sandbox-fixtures.test.ts` — each augmenter inserts the expected row shape; base fixtures type-check against schema (enforced by tsc in CI already).
- `tests/unit/sandbox-env-guard.test.ts` — the `instrumentation.ts` safety check throws in the four (NEXT_PUBLIC_SANDBOX_MODE × prod-env) combinations that should throw; doesn't throw in the others.
- `tests/unit/sandbox-fixture-contract.test.ts` (E8-13, new post-codex) — for every `lib/data/*.ts` reader, assert the set of keys the sandbox stub returns matches the set of keys the real Drizzle query projects. Breaks noisily when the DAL evolves without fixture regeneration, preventing silent semantic drift. (Codex F6.)
- `tests/unit/sandbox-empty-stub.test.ts` — every symbol exported from `lib/sandbox/empty-stub.ts` throws on call, so any prod code that somehow reaches a sandbox function crashes loud in Sentry rather than returning a wrong fixture.

---

## 5. Simplicity review

Cuts made during design:

- ❌ **JSON + zod validation.** Replaced with TS files + tsc schema enforcement. Saves the validation layer, the JSON→TS type duplication, and the runtime parse cost.
- ❌ **Adapter pattern for DAL swap.** Replaced with a 3-line `if (isSandbox())` at the top of each reader. Same outcome, zero new abstraction.
- ❌ **Persistent annotation log.** Beads is already the persistence layer. Don't write a markdown file on the side.
- ❌ **Sandbox UI toggle.** `pnpm dev:sandbox` vs `pnpm dev` is two commands. A toggle would be UI surface to design, test, and police.
- ❌ **Bi-directional sync with prod.** Dumps are one-way, one-shot, opt-in (E8-10). The fixtures are the source of truth in sandbox.
- ❌ **`/sandbox/*` route prefix.** Considered early; doubles the route tree and middleware complexity for no clear win.
- ❌ **Auth on the annotation bridge.** Two independent gates (`isSandbox()` + localhost check) are stronger than a token.

Kept because load-bearing:

- ✅ Banner (safety signal; never surprise the user about what they're looking at).
- ✅ Env safety check (prevents shipping NEXT_PUBLIC_SANDBOX_MODE=1 accidentally).
- ✅ CI grep sentinel (guards against a future refactor leaking fixtures).
- ✅ Localhost guard on the annotation API (defense in depth).
- ✅ Dedicated `playwright.sandbox.config.ts` (e2e boot needs the env var set on the webServer — cleaner than overloading the main config).

---

## 6. Adversarial review — done

Codex (gpt-5-codex, high reasoning, 253k tokens) walked the plan and flagged 6 findings, all accepted. Full adjudication in `e8-sandbox-plan-adversarial-review.md`. Summary:

| # | Finding | Severity | Fix landed in plan |
|---|---|---|---|
| F1 | Tree-shake alone won't drop `lib/sandbox` on Next 16 | High | Webpack `resolve.alias` → `empty-stub.ts` |
| F2 | `NEXT_PUBLIC_` prefix required for browser visibility | Critical | Env var renamed; banner + toolbar would never have mounted without this |
| F3 | `lib/env.ts` import-throw isn't universal | Medium | Moved safety check to `instrumentation.ts` boot hook |
| F4 | `JSON.stringify` doesn't escape shells | High (security) | `execFile` + argv, no shell |
| F5 | `bd` ENOENT blind spot for new collaborators | Low (robustness) | Presence probe + readable 503 + banner state |
| F6 | Fixture drift time bomb on schema evolution | Medium | E8-10 promoted P3→P2; new E8-13 contract test |

Expected areas of pushback (pre-framed so we can triage quickly):

- **Fixture freshness:** quarterly dump script (E8-10) may go stale. Counter: regenerate on demand; tests catch schema drift (tsc); acceptable.
- **Bundle-leak audit:** the CI grep is a blunt instrument. Codex may push for a webpack bundle analyzer diff. Counter: overkill for one directory; revisit if we add more sandbox-gated modules.
- **`pExec` shell injection:** JSON.stringify escapes but is not a perfect shell-quoter. Counter: consider `spawn(..., [..args])` array form to bypass shell entirely. Likely accept.
- **Nested `if (isSandbox())` in every DAL reader:** codex will flag as DRY violation. Counter: the alternative (adapter abstraction) is more code for worse readability; the 3 lines are the simplest thing that works.

The plan updates after codex findings; findings + adjudication landed in `e8-sandbox-plan-adversarial-review.md` per project convention.

---

## 7. Task list (beads)

All 12 tasks already exist under epic `patsbythenumbers-l6u`. Priority-ordered execution:

| ID | Title | Depends on | Est. |
|---|---|---|---:|
| `zkr` | E8-01 Sandbox module skeleton + env gate + empty-stub + instrumentation.ts safety check | — | 60m |
| `2ek` | E8-02 Fixture TS files covering all DAL reads | — | 2h |
| `r0t` | E8-03 DAL stub layer — per-module sandbox branch | 01, 02 | 90m |
| `gra` | E8-04 Edge-case fixture augmenters | 02 | 90m |
| `wg2` | E8-05 `pnpm dev:sandbox` script + `NEXT_PUBLIC_SANDBOX_MODE=1` env plumbing | 01 | 15m |
| `549` | E8-06 SandboxBanner + dismiss + persistence + bd-missing state | 01 | 60m |
| `51a` | E8-07 Agentation toolbar install (sandbox-only) | 01 | 60m |
| `3kx` | E8-08 Beads bridge — `execFile` + argv + bd-presence probe | 01, 07 | 90m |
| `yk2` | E8-09 Webpack resolve.alias stub swap + CI grep guard | 01 | 75m |
| `5xo` | **E8-10 Fixture-from-prod dump script (P2)** | 02 | 2h |
| `k2d` | E8-11 `docs/sandbox.md` workflow doc + §setup for bd | — | 45m |
| `fkl` | E8-12 E8 epic E2E + CI sandbox boot | 03, 04, 06, 08 | 90m |
| *(new)* | **E8-13 Fixture contract test** (codex F6) | 02, 03 | 60m |

**Critical path:** 01 → (02 parallel) → 03 + 13 → 12. ~8h of focused work. Agentation + bridge (07, 08), dump script (10), and docs (11) are parallelizable.

**Ready to work now:** `zkr` (E8-01), `2ek` (E8-02), `k2d` (E8-11).

---

## 8. Out of scope (explicit)

- Deployed sandbox URL (no Vercel preview with fixtures).
- Multi-user annotation sessions (single-user tool).
- Fixture CRUD UI (edit TS files directly).
- Live sync between Agentation backend and beads beyond the one-shot task create.
- Figma / Pencil MCP integration (separate feature if wanted later).
- Light mode in sandbox (still dark-only per SPEC §11).

---

*Next step: run `/codex-review docs/plans/e8-sandbox-plan.md`; adjudicate findings into `e8-sandbox-plan-adversarial-review.md`; amend this file if design shifts; then kick off `zkr`.*
