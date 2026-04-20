---
title: "/fullreview is mandatory after /build-it — not optional polish"
category: "workflow-tips"
date: "2026-04-18"
tags: [workflow, codex, review, process, quality-gates]
---

# Skipping /fullreview lets real bugs ship

## Context

The epic cadence is **`/epic-plan` → `/build-it` → `/fullreview` → `/ship`**.
`/build-it` gets the tests green; `/fullreview` runs UX + simplify +
design + codex ×2 against the implementation and fixes what they find.

Twice now, skipping or running `/fullreview` only after `/ship` has
surfaced bugs that would have shipped — and in E4's case, did briefly
ship before being caught on a retroactive review.

## What actually slipped past green tests

**E3 (rank deltas):** unit + E2E tests green. Only `/fullreview` (via
design review + the codex pass) noticed that improving ranks rendered
with the decline arrow. The regression is pure semantics — no test
assertion distinguishes "▲ for 10→5" from "▼ for 10→5" unless you
specifically write it. See
[rank-delta-sign-semantics](../gotchas/rank-delta-sign-semantics.md).

**E4 (player deep-dives):** tests green, shipped, *then* ran codex
review on the shipped build. Five real findings:

1. **Dead toggle.** `QbStarterToggle` changed local state but the
   server component rendered all-games data regardless — the toggle
   did nothing. Unit tests confirmed state changed. No test confirmed
   the *chart* changed. (HIGH — shipping-blocker by UX.)
2. **WCAG 2.4.7 violation.** `TopContributorCard` used
   `<Link className="contents">` — focus ring invisible to keyboard
   users. See [display-contents-hides-focus-rings](../gotchas/display-contents-hides-focus-rings.md).
   (HIGH.)
3. **Missing SPEC §3.3 modules.** QB page shipped without the
   deep-ball and success-rate cells the spec required. (HIGH.)
4. **Missing contract tests #16–#20.** Plan spec'd 5 new data-integrity
   contracts; build shipped with 0 of them. (MEDIUM.)
5. **Pluralization bug.** `SmallSampleBanner` said "carrie" instead of
   "carry" for singular. `.replace(/s$/, '')` is not pluralization.
   (LOW.)

None of these were caught by `pnpm test`, `pnpm test:e2e`, or typecheck.
All five were caught by the first codex pass of `/fullreview`. The
second codex pass returned clean.

## Guidance

`/fullreview` is a **quality gate**, not polish. Run it every time
`/build-it` finishes, before `/ship`. The marginal cost is ~15 minutes
of wall time (codex is mostly idle while reading); the marginal benefit
is catching a category of bug that unit + E2E tests structurally cannot:

- **Semantic correctness** (sign conventions, pluralization,
  content that matches spec) — no assertion distinguishes right from
  plausible-wrong unless you wrote it.
- **A11y compliance** beyond axe defaults — focus-ring paint,
  contrast in unusual combinations, screen-reader flow.
- **Dead / no-op UI** — state that updates but doesn't affect render.
- **Spec drift** — modules the plan promised but implementation forgot.
- **Missing tests** — the plan said 5 new contracts; I shipped 0.

## How to apply

- After `/build-it` reports green, the next command is **always**
  `/fullreview`. No "tests pass, looks good, shipping" shortcuts.
- If codex finds >0 HIGH issues on pass 1, run it again after the
  fixes. Pass 2 returning clean is the actual "ready to ship" signal.
- If you *do* catch yourself having shipped without `/fullreview`, run
  it on the shipped commit and file follow-ups. Don't pretend the gate
  didn't exist.

## Related

- `/fullreview` skill definition — runs improve-ux + simplify +
  design-review + codex-review ×2
- `docs/solutions/gotchas/rank-delta-sign-semantics.md` — E3 bug
  caught by `/fullreview`
- `docs/solutions/gotchas/display-contents-hides-focus-rings.md` —
  E4 bug caught by post-ship `/fullreview`
