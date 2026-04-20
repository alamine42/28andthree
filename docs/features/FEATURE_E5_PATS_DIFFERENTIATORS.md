# Feature: E5 — Pats Differentiators (Draft ROI + Coaching)

**Epic ID:** `patsbythenumbers-nzw`
**Date:** 2026-04-20 (draft build + /fullreview UX pass + ship)
**Author:** Mehdi El-Amine + Claude Opus 4.7

## Summary

Builds `/draft-roi` and `/coaching` — the two pages that give 28 and Three its
"differentiator" edge against FTN / Sumer / rbsdm. `/draft-roi` grades every
2021–2025 Pats pick (HIT / FAIR / MISS / PENDING) against a slot-expected-value
curve fit from league-wide 2015–2024 outcomes. `/coaching` renders weekly
HC / OC / DC tendencies: play-call mix by down × distance, situational rates,
score-state pressure, personnel groupings, blitz rate, and a 4th-down ledger
against Ben Baldwin's nfl4th model. Coordinator changes split into date-range
segments so each tendency rollup sits under the coach who produced it.

This ship is the /fullreview polish pass on the initial draft — the
code + schema landed earlier today (95325bf); this commit replaces the first
UI with the analyst-terminal visual language set by E3 and E7, using the
hairline-grid + eyebrow/display/mono typography pattern consistently.

## Context & Motivation

### Problem Statement

Per SPEC §6, the site's category differentiation rests on two pages that
peers don't ship: (a) draft ROI across a full class window with a publicly
defensible slot-EV curve, and (b) a coaching dashboard deep enough to read
Vrabel's in-game identity. The initial code-complete commit shipped the logic
and schema but left the visual treatment at a spec-reference-implementation
level — tables, a bullet list, and a scatter plot that was visually
unreadable (Y axis was bernoulli 0/1).

### User Story

As a Patriots fan reading the box score twice, I want to open `/draft-roi`
and within 3 seconds know which draft class was best across 2021–2025 —
without scrolling or counting badges. I want to open `/coaching` and see, at
a glance, how pass-heavy the team has been, how aggressive the blitz package
is, and whether Vrabel is out-aggressing the 4th-down model.

### Prior Art

- **Internal**: E3 Team Overview (`components/HeroStats.tsx`, `PhaseCard`) —
  set the hairline-grid-with-cells visual language. E7 Players Hub reused
  the pattern for the roster grid. E5 inherits it end-to-end.
- **External**: Bloomberg Terminal's heat-mapped cells, Stripe's stacked
  status bars + hairline detail rows. Explicit inspiration for
  `DraftClassStrip` (Stripe-style summary row) and `PlayCallMixTable`
  (Bloomberg heatmap).

## Architecture & Design

### High-Level Design

```
┌──────────────────────────────────────────────────┐
│ Neon Postgres                                    │
│   draft_picks, draft_expected_value,             │
│   coaching_tendencies_weekly,                    │
│   skill_season.epa_(receiving|rushing) — new     │
└─────────────────┬────────────────────────────────┘
                  │ DAL (Drizzle, missing-table tolerant)
                  ▼
┌──────────────────────────────────────────────────┐
│ lib/data/draft.ts    lib/data/coaching.ts        │
│   getDraftRoiByClass   getCoachSegments          │
│                        getFourthDownDecisions    │
└─────────────────┬────────────────────────────────┘
                  │ server components (pure-render)
                  ▼
┌──────────────────────────────────────────────────┐
│ app/draft-roi/page.tsx      app/coaching/page.tsx│
│   ├─ DraftClassStrip            ├─ CoachingHero  │
│   └─ ClassTable × 5             ├─ CoachSegmentBanner│
│                                 ├─ PlayCallMixTable │
│                                 ├─ SituationalGrid  │
│                                 ├─ ScoreStatePanel  │
│                                 ├─ FourthDownLedger │
│                                 └─ BlitzCard + PersonnelPanel│
└──────────────────────────────────────────────────┘
```

### Key Components

| Component | Location | Purpose |
|---|---|---|
| `DraftClassStrip` | `components/draft/DraftClassStrip.tsx` | 5-card at-a-glance strip with stacked grade bar + hit-rate. Anchors below. |
| `ClassTable` | `components/draft/ClassTable.tsx` | Per-class table; row = pick # / player / round / raw / ratio / grade. |
| `GradeBadge` | `components/draft/GradeBadge.tsx` | HIT / FAIR / MISS / PENDING pill with unit-proxy asterisk. |
| `CoachingHero` | `components/coaching/CoachingHero.tsx` | 4-cell hairline grid of headline numbers. |
| `CoachSegmentBanner` | `components/coaching/CoachSegmentBanner.tsx` | 3-card coordinator strip with mid-season "changed" pill. |
| `PlayCallMixTable` | `components/coaching/PlayCallMixTable.tsx` | 3×3 heat-tinted pass-rate grid. |
| `SituationalGrid` | `components/coaching/SituationalGrid.tsx` | Shotgun / play-action / motion / no-huddle stat tiles. |
| `ScoreStatePanel` | `components/coaching/ScoreStatePanel.tsx` | 5-band pass-rate bars (trailing big → leading big). |
| `PersonnelPanel` | `components/coaching/PersonnelPanel.tsx` | Top-5 personnel groupings with share bars. |
| `FourthDownLedger` | `components/coaching/FourthDownLedger.tsx` | Week-by-week 4th-down rec vs. actual, tone-bordered. |
| `BlitzCard` | `components/coaching/BlitzCard.tsx` | Defensive blitz rate + aggressive/balanced/conservative label. |
| `SectionHeader` | `components/coaching/SectionHeader.tsx` | Shared eyebrow + H2 anchor. |

### Data Model Changes

New tables (migration `0010_elite_genesis.sql`, applied in earlier commit):
- `draft_picks` — Pats picks 2021–2025 (hand-curated seed)
- `draft_expected_value` — slot × position-bucket EV curves (isotonic fit)
- `draft_outcomes_historical` — 2010–2024 all-team outcomes for curve fit
- `coaching_tendencies_weekly` — wide weekly rollup per HC/OC/DC

Columns added to existing tables:
- `skill_season.epa_receiving`, `skill_season.epa_rushing` — so Draft ROI has
  real per-player actuals for offensive skill picks
- `plays.personnel_offense/defense` — bumped 96 → 128 chars preemptively

### API Changes

None — both pages are server-rendered App Router routes; no new HTTP endpoints.

## Implementation Details

### Files Changed

**Pages (modified):**
- `app/draft-roi/page.tsx` — added DraftClassStrip, richer empty state,
  de-duplicated fetch (summary now computed from fetched rows, not re-queried).
- `app/coaching/page.tsx` — rebuilt IA into Hero → Coordinator → Offense →
  4th downs → Defense sections. Conditional grid when blitz data absent.

**Components (modified):**
- `components/draft/ClassTable.tsx` — new `PickRow` sub-component, ratio column
  tinted by tier, mobile-fold round into pick cell, clamped-ratio title fallback.
- `components/coaching/CoachSegmentBanner.tsx` — 3-card hairline grid with
  role labels, stable keys, mid-season "changed" pill.
- `components/coaching/PlayCallMixTable.tsx` — heat-tinted cells (amber
  pass-heavy, cranberry run-heavy), inline rollup key lookup, legend swatch.

**Components (new):**
- `components/draft/DraftClassStrip.tsx`
- `components/coaching/{CoachingHero,FourthDownLedger,ScoreStatePanel,`
  `PersonnelPanel,SituationalGrid,BlitzCard,SectionHeader}.tsx`

**DAL:**
- `lib/data/draft.ts` — removed unused `getDraftClassSummary` (was double-
  fetching rows for a pure-function summary; page now computes inline).

**Docs (new):**
- `docs/solutions/gotchas/text-text-dim-fails-wcag-for-actual-text.md` —
  policy note from axe findings during this review.

### Key Decisions

1. **Heat map over naked percentages for play-call mix.** A 3×3 grid of
   percentages in mono is visually flat — a glance doesn't reveal the
   "3rd-and-long is 91% pass" story. Inline `rgba()` tints (amber/cranberry)
   scale with `|pass - 0.5|`, capped at 0.75 alpha so numbers stay legible.
   Opacity applied via inline style because tailwind config exposes tokens
   as `var(--token)` without `<alpha-value>`.

2. **4th-down ledger replaces scatter.** A Y ∈ {0, 1} scatter is information-
   poor on small data (≤ 17 points). A week-by-week row with model rec +
   team choice + agree/disagree check/cross scans in one pass and fits the
   terminal aesthetic. Test-id `fourth-down-scatter` preserved for backward
   compatibility with existing e2e assertions.

3. **Dedicated hero strip on coaching.** Matches home + phase page pattern
   (4-cell hairline grid) so `/coaching` reads as part of the same site
   language instead of "a data dump page."

4. **`text-text-dim` convention enforced.** See gotcha doc — reserve for
   chart fills; text uses `text-text-muted` to pass WCAG AA.

### Tradeoffs Considered

| Option | Pros | Cons | Decision |
|---|---|---|---|
| Stacked bar with normalized widths | All years compare 1:1 | Small classes overstate individual picks | **Chosen** — pick count shown separately in caption |
| One pip per pick | Counts picks at a glance | 5-pick class shrinks visually vs 10-pick | Rejected |
| Scatter plot for 4th-down | Canonical in football-nerd papers | Bernoulli Y unreadable at small n | Rejected |
| Ledger table for 4th-down | Scan-friendly, terminal-coherent | Less generalizable to other metrics | **Chosen** |
| `cells` array in PlayCallMixTable | Separated data prep | O(n²) `.find` per render, redundant | Rejected — inline rollup key lookup |
| `text-text-dim` for captions | Lower visual weight | Fails WCAG AA at body sizes | Rejected — `text-text-muted` site-wide |

## Testing

### Test Coverage

- **Unit:** 174 Node tests pass — existing draft-grade (14), coach-segments
  (9), phase-aggregation, and the wider E1–E4 suite all green.
- **E2E (Playwright chromium):**
  - `e5.spec.ts` (11 tests) — structural smoke + data-tolerant assertions
    pass in both empty and populated states.
  - `a11y.spec.ts` — `/draft-roi` + `/coaching` scan with axe, 0 serious /
    critical violations.
  - `no-bad-numbers.spec.ts` — no NaN / null / undefined / bare 0.0 leaks
    on either route.
- **Pre-existing failures (unrelated):** `/status` smoke tests fail locally
  because the ETL hasn't been run on this machine. Not caused by this commit.

### Manual Testing Steps

1. `pnpm dev` → `http://localhost:3000/draft-roi` — see empty-state card
   (no ETL locally). Copy reads "DRAFT DATA — AWAITING ETL".
2. `http://localhost:3000/coaching` — same empty-state card.
3. Resize to mobile (<640px) — headers stack, section gaps narrow,
   nothing overflows the viewport.
4. After ETL runs (next Tuesday cron or manual dispatch), verify
   DraftClassStrip renders 5 cards, PlayCallMixTable shows heat tints,
   FourthDownLedger enumerates weeks.

## Security Considerations

Security review (part of /ship): **clear to ship.** All changes are server-
rendered presentation code reading from the parameterized DAL — no user input,
no auth surface, no new HTTP endpoints. Defense-in-depth note flagged:
`gsisId` flows into URL path segments via `playerHref()` without
`encodeURIComponent`; source is the nflverse ETL, not user input, so not a
live concern but worth hardening in the routing helper (out of this scope).

## Future Improvements

- [ ] **Populate data.** Waiting on E5-02a (ingest 2010–2024 historical draft
  outcomes), E5-02b (slot-EV curve fit), E5-03 (Pats seed), E5-07 (play-call
  splits ETL), E5-08b (nfl4th integration).
- [ ] **League comparisons.** Once more-than-Pats data lands, add league
  percentile/rank to hero cells (e.g., "14th in blitz rate").
- [ ] **Coordinator-role splits for hero.** Currently hero averages the
  latest OC rollup; if coordinator changed mid-season, consider a weighted
  average or a split tile.
- [ ] **Model pending UX.** When 4th-down decisions exist but no go-worthy
  plays arose, caption reads "No go-worthy 4th downs" — consider a richer
  explainer aside for this exact state.
- [ ] **`encodeURIComponent(gsisId)` in `lib/format/player-routes.ts`** as
  defense-in-depth hardening.

## Related

- **Tasks:** E5-01, nzw.3, nzw.5, nzw.6, nzw.7, nzw.8, nzw.9, nzw.10, nzw.13,
  nzw.14, nzw.15, nzw.16, nzw.18 closed in the initial E5 commit (95325bf).
  This /ship pass is a polish layer on top; no new tasks created.
- **Related features:** `docs/features/FEATURE_E3_TEAM_OVERVIEW_PHASE_PAGES.md`
  (design language source), `FEATURE_E7_PLAYERS_HUB.md` (same hairline-grid
  pattern).
- **Gotcha doc:** `docs/solutions/gotchas/text-text-dim-fails-wcag-for-actual-text.md`.
- **Plan:** `docs/plans/e5-pats-differentiators-plan.md` (+ adversarial review).
