# E7 Players Hub — adversarial review (codex)

**Reviewer:** codex-cli 0.121.0 / gpt-5-codex
**Date:** 2026-04-20
**Target:** `docs/plans/e7-players-hub-plan.md`

## Findings (15)

### 1. HIGH — Combobox role on the wrong element
The plan puts `role="combobox"`/`aria-expanded` on a wrapper `<div>` while focus stays on the `<input role="searchbox">`. Violates WAI-ARIA 1.2 combobox pattern. **Adjudication:** valid. Move `role="combobox"` onto the input directly; drop the wrapper role. The refactored 1.2 pattern puts combobox semantics on the input.

### 2. HIGH — Server component imported by client component
`RosterCard` is described as a server component but is reused inside `RosterBrowser`/`PlayerSearch` (both `'use client'`). Next.js forbids this import pattern. **Adjudication:** valid. Make `RosterCard` a client component — it has no server-only concerns (no DB, no async).

### 3. HIGH — Listbox options contain focusable `<Link>`
Reusing `RosterCard` inside `<li role="option">` nests a focusable link inside a listbox option, which breaks the `aria-activedescendant` virtual-focus contract. **Adjudication:** valid. Split into two components: `RosterCard` (grid, renders `<Link>`) and `RosterOption` (listbox, renders `<li>` with click handler, no `<Link>`). Keep visuals identical.

### 4. HIGH — `roleFor(position.toUpperCase())` crashes on null
`players.position` is nullable in schema; plan typed `RosterEntry.position` as `string`. **Adjudication:** valid. Type as `string | null`; `roleFor` coerces null → `'defense'` fallback.

### 5. HIGH — "Active roster only" not possible from current data
`roster_snapshots` doesn't store a status column, so filtering to ACT-only is a promise we can't keep. **Adjudication:** valid. Revise the DoD: we show every row nflverse emits for the current season — practice squad / IR surface together with actives until a later ETL iteration adds `status`. File follow-up in E6 if needed.

### 6. HIGH — OL/DEF cards link to unit pages, not player pages
DoD says "every active player reachable in ≤3 clicks"; codex argues unit-page destinations don't fulfill that. **Adjudication:** partially valid — wording was too strong. The unit pages *are* the player content for defenders (per SPEC §3.3: individual defender ratings are v2). Revise DoD to: "every roster card navigates to the appropriate destination — deep-dive for QB/RB/WR/TE, unit page for OL/DL/LB/DB."

### 7. MEDIUM — Special-teams routing dumps users on the defense page
K/P/LS → `/team/units/defense` is misleading. **Adjudication:** valid. Render ST cards as non-clickable (`<div>` not `<Link>`) with a muted "no page yet" state, same pattern `TopContributorCard` uses for `href === '#'`. File an E6 follow-up to stub `/team/units/special-teams`.

### 8. HIGH — `getCurrentSeason()` lags roster ETL
`getCurrentSeason()` reads from `team_phase_weekly`, which is empty until week-1 snaps are ingested. The hub would show last year's roster in the gap between preseason ETL and week 1. **Adjudication:** valid. Roster hub derives its season from `roster_snapshots` directly: `MAX(season) WHERE team='NE'`. Named helper `getCurrentRosterSeason()` in the DAL.

### 9. MEDIUM — Search input missing accessible name
No `<label>`, `aria-label`, or `aria-labelledby` wired up. **Adjudication:** valid. Add `aria-label="Search players"` on the input (visually-hidden label would also work; prefer `aria-label` for the compact placeholder UI).

### 10. MEDIUM — Position map misses KR/PR/RS
nflverse emits `KR`/`PR`/`RS` for return specialists; plan's `POSITION_TO_ROLE` omits them. **Adjudication:** valid. Extend map: `KR`, `PR`, `RS` → `'special'`. Also worth auditing `HB` (RB variant) and defensive codes more completely.

### 11. MEDIUM — Shared `data-testid` between grid card and listbox option
Tests count `[data-testid^="roster-card-"]`; if the listbox reuses the same prefix, opening the combobox doubles the matches and breaks assertions. **Adjudication:** valid. `RosterOption` uses `data-testid="roster-option-${gsisId}"`; grid keeps `roster-card-${gsisId}`.

### 12. HIGH — Mouse click on listbox option misfires
With focus on the input, a pointer click on `<li role="option">` blurs first → listbox closes → click lands on nothing. **Adjudication:** valid. `onMouseDown={(e) => e.preventDefault()}` on options, then `onClick` triggers `router.push()`.

### 13. MEDIUM — Category derivation underspecified
Role `'skill'` covers both RB and WR+TE, so the chip-count logic can't distinguish them. **Adjudication:** valid. Separate `POSITION_TO_CATEGORY` map: `RB`/`HB`/`FB` → `'RB'`, `WR`/`TE` → `'WR+TE'`, etc.

### 14. MEDIUM — QB `<=6` assertion brittle
Preseason/camp rosters can exceed 6 QBs. **Adjudication:** valid. Relax to `>=1`; drop the upper bound.

### 15. LOW — Null jersey prints `null`
`jerseyNumber` is nullable; plan says "Position · Jersey" but doesn't handle null. **Adjudication:** valid. Card renders `QB · #10` when present, `QB` alone when null (drop the separator).

## Summary
Twelve blockers and three polish items. The biggest semantic gap is the combobox architecture (findings 1–3, 11, 12) — the initial plan conflated grid card and listbox option into one reusable component, which breaks both the ARIA combobox pattern and pointer UX. Fix is a clean split. The rest cluster around data-model realities codex surfaced (nullable position/jersey, missing status column, season-detection timing, incomplete position map) — all addressable without schema changes.

Revised plan lands in `docs/plans/e7-players-hub-plan.md` §2.3, §3.2, §3.3, §3.4, §3.6, §4.1, and §10; all findings are explicitly addressed.
