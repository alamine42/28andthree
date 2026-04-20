# Feature: E7 — Players Hub

**Epic ID:** `patsbythenumbers-2le`
**Date:** 2026-04-20 (plan + build + review + ship in one day)
**Author:** Mehdi El-Amine + Claude Opus 4.7

## Summary

Adds `/players` — the roster-index hub that was missing from E4. Lists every
current-season Patriots player with position-filter chips (All / QB / RB /
WR+TE / OL / DEF / ST) and a WAI-ARIA 1.2 combobox search. Cards route to the
right destination by role: QB/RB/WR/TE → player deep-dive; OL/DL/LB/DB → unit
page; ST → non-clickable with a visible "Page coming soon" caption. Unblocks
the primary-nav "Players" link, which was a `/` placeholder, and removes the
last launch-blocking dead end in the site IA.

## Context & Motivation

### Problem Statement

E4 shipped `/players/qb/[gsisId]` and `/players/skill/[gsisId]` but never
built a hub that lets a fan *find* a player. The nav's *Players* link pointed
at `/` as a placeholder. A user who didn't already know a 10-character
gsisId could not reach player content from the home page. Shipping E6
(launch) without a players hub meant shipping a visibly broken nav.

### User Story

As a Patriots fan on the home page, I want to click *Players*, see the
roster, and tap through to Drake Maye / Stefon Diggs / Hunter Henry — so I
can check how they're doing this season without memorising gsisIds.

### Prior Art

- **Internal**: E4 Player Deep Dives (QB + skill pages, roster_snapshots
  table, `<PlayerAvatar>` component). E4 also invented the role-dispatch
  pattern used by `<TopContributorCard>` — E7 extracts a reusable version
  in `lib/format/player-routes.ts`.
- **External**: rbsdm.com, sumersports.com — both show roster-style grids as
  a browsing entry point before drilling into player-level stats.

## Architecture & Design

### High-Level Design

```
┌──────────────────────────────────────────────┐
│ Neon Postgres (E4-loaded)                    │
│   roster_snapshots  ~3,133 rows (all seasons)│
└─────────────────┬────────────────────────────┘
                  │ Drizzle
                  ▼
┌──────────────────────────────────────────────┐
│ lib/data/players-hub.ts  DAL                 │
│   getCurrentRosterSeason(team)               │
│   getPatsRoster(season, team)                │
└─────────────────┬────────────────────────────┘
                  │ Server Component (revalidate=3600)
                  ▼
┌──────────────────────────────────────────────┐
│ app/players/page.tsx                         │
│   └─ <RosterBrowser>  ('use client')         │
│        ├─ <PlayerSearch>  combobox           │
│        │   └─ <RosterCardBody> ×N (options)  │
│        ├─ Position chip row                  │
│        └─ <RosterCard> ×N (grid)             │
│             └─ <RosterCardBody>              │
└──────────────────────────────────────────────┘
```

### Key Components

| Component | Location | Purpose |
|---|---|---|
| `PlayersHubPage` | `app/players/page.tsx` | Server shell, fetches roster |
| `RosterBrowser` | `components/players/RosterBrowser.tsx` | Owns filter state, renders chips + grid |
| `PlayerSearch` | `components/players/PlayerSearch.tsx` | WAI-ARIA 1.2 combobox |
| `RosterCard` | `components/players/RosterCard.tsx` | Grid card (`<Link>` or inert `<div>`) |
| `RosterCardBody` | `components/players/RosterCardBody.tsx` | Shared visual fragment (avatar + name + pos/#) |
| `getCurrentRosterSeason` | `lib/data/players-hub.ts` | `MAX(season)` from `roster_snapshots` |
| `getPatsRoster` | `lib/data/players-hub.ts` | Current roster sorted by role + jersey |
| `roleFor` / `categoryFor` / `playerHref` | `lib/format/player-routes.ts` | Position → role / chip / destination |

### Data Model Changes

None. `roster_snapshots` was populated by E4. No new columns, no new tables.

### API Changes

- New client-navigable route: `GET /players` (HTML, ISR).
- `/players` added to `lib/revalidation/tags.ts` `REVALIDATE_PATHS` so the
  weekly roster ETL run invalidates it.

## Implementation Details

### Files Changed

- `app/players/page.tsx` (new) — server shell, season detection, empty-state fallback.
- `components/players/PlayerSearch.tsx` (new) — combobox with keyboard + pointer model.
- `components/players/RosterBrowser.tsx` (new) — filter chips + grid.
- `components/players/RosterCard.tsx` (new) — grid card; inert variant for ST.
- `components/players/RosterCardBody.tsx` (new) — shared avatar + name + meta line.
- `lib/data/players-hub.ts` (new) — DAL.
- `lib/format/player-routes.ts` (new) — role/category/href helpers.
- `components/SiteHeader.tsx` (edit) — nav "Players" link → `/players`.
- `lib/revalidation/tags.ts` (edit) — added `/players` to ISR paths.
- `tests/e2e/a11y.spec.ts` (edit) — added `/players` to axe sweep.
- `tests/e2e/no-bad-numbers.spec.ts` (edit) — added `/players` to crawler.
- `tests/e2e/e7.spec.ts` (new) — 11 smoke tests.
- `tests/unit/player-routes.test.ts` (new) — 28 unit tests.

### Key Decisions

1. **Client-side filter state, no URL sync.** App Router has no shallow
   routing; `router.replace` re-runs the server component. `?position=QB`
   deep-linking is post-launch polish.
2. **Full roster in one payload, no pagination.** ~53 rows × tiny JSON
   objects = ~5 KB. Simpler than any alternative.
3. **ST role returns `null` from `playerHref`** rather than silently
   linking to the defense unit page. Card renders as `<div>` with a
   visible "Page coming soon" caption so both sighted and SR users
   understand the tile is inert.
4. **Split `RosterCard` (grid) from listbox option rendering.** Listbox
   options cannot contain focusable children per WAI-ARIA 1.2; grid cards
   must remain `<Link>`s so middle-click / cmd-click / copy-link work.
   Shared body via `<RosterCardBody>` keeps visuals in one place.
5. **`role="combobox"` on the input itself**, not a wrapper div. This is
   the WAI-ARIA 1.2 refactored pattern; 1.1 put it on the wrapper.
6. **Season detection from `roster_snapshots`, not `team_phase_weekly`.**
   `getCurrentSeason()` keys off weekly rollups and goes stale in the gap
   between preseason ETL and the week-1 snap.
7. **ST players filtered from search matches.** Since `playerHref` returns
   `null` for them, matching them in the listbox leads to a silent no-op.
   They still browse via the ST chip in the grid.

### Tradeoffs Considered

| Option | Pros | Cons | Decision |
|---|---|---|---|
| URL-sync filter state | Shareable, deep-linkable | App Router re-renders on each change | Rejected (post-launch) |
| Pagination | Scales to all-league roster | Overkill for 53 Pats rows | Rejected |
| Fuse.js fuzzy search | Richer match quality | +12 KB gzip, overkill for 53 rows | Rejected — substring match is fine |
| Per-card headline stat (EPA, targets) | Richer info density | N position-specific card variants; stats belong to deep dive | Rejected |
| Linking ST → `/team/units/defense` | Every card clickable | Misleading — user searches kicker, lands on defense | Rejected — inert card + caption |

## Testing

### Test Coverage

- **Unit (`tests/unit/player-routes.test.ts`)**: 28 tests for `roleFor`,
  `categoryFor`, `playerHref`. Covers null/undefined/empty, case-insensitive,
  every nflverse position code including KR/PR/RS return specialists, and
  the special-returns-null contract.
- **E2E (`tests/e2e/e7.spec.ts`)**: 11 smoke tests covering grid size,
  chip filtering, Enter navigation, ArrowDown+Enter, mouse-click on option,
  OL card → unit page, ST card non-clickable, Escape preserves query,
  empty-state, nav link from home, mobile viewport.
- **A11y (`tests/e2e/a11y.spec.ts`)**: `/players` added to axe sweep.
  Passes `wcag2a wcag2aa wcag21a wcag21aa` with zero serious/critical.
- **No-bad-numbers (`tests/e2e/no-bad-numbers.spec.ts`)**: `/players`
  added. Trivially passes (no `data-numeric="true"` elements on the page —
  stats live on the deep-dive pages).

### Manual Testing Steps

1. Open `/` → click *Players* in desktop nav → land on `/players`.
2. Open mobile (Pixel 5) → tap hamburger → tap *Players*.
3. Tap *QB* chip → grid narrows to QBs.
4. Search "May" → listbox opens → Enter → Drake Maye's deep-dive.
5. Tap *OL* chip → click first card → `/team/units/offensive-line`.
6. Tap *ST* chip → cards show "Page coming soon"; clicking does nothing.
7. Tab through chips + cards → visible focus outline on each.

## Security Considerations

- **No user input hits the server.** Filter + search are pure client state.
- **No open-redirect surface.** `router.push` targets are computed from
  enum + own-DB gsisId; no user-controlled URL construction.
- **XSS-safe.** All text renders as JSX content (React auto-escapes).
  `gsisId` is embedded in DOM ids (`${listboxId}-opt-${gsisId}`) where the
  format is `00-XXXXXXX` — alphanumeric only.
- **CSP already whitelists NFL headshot CDN** (from E4).
- **No new secrets or credentials.**

## Review History

- **Adversarial review (codex, pre-build)**: 15 findings — all 7 HIGH / 7
  MEDIUM / 1 LOW adjudicated into the plan before any code. Doc:
  `docs/plans/e7-players-hub-plan-adversarial-review.md`.
- **Codex review pass 1 (post-build)**: 4 findings — all MEDIUM/LOW. Fixed:
  ArrowUp now reopens collapsed listbox; ST players filtered from search;
  ST cards surface visible "Page coming soon" caption with
  `aria-describedby`; `aria-expanded` mirrors popup render state.
- **Codex review pass 2 (post-fix)**: No findings. "Code looks shippable."

## Future Improvements

- [ ] Add `status` column to `roster_snapshots` so we can filter out
      practice squad / IR players (filed as an E6 follow-up).
- [ ] Stub `/team/units/special-teams` page so ST cards become clickable.
- [ ] URL-sync filter state (`?position=QB`) once shallow routing lands or
      the pattern is worth the App Router re-render cost.
- [ ] Per-position headline stat on cards (EPA/dropback for QB, target
      share for WR, etc.) if user feedback shows discovery needs more context.
- [ ] Fuzzy matching if users complain about substring-only search
      (e.g., "Macjone" not finding "Mac Jones").

## Related

- **Plan**: `docs/plans/e7-players-hub-plan.md`
- **Adversarial review**: `docs/plans/e7-players-hub-plan-adversarial-review.md`
- **Gotcha consolidated from this sprint**: `docs/solutions/gotchas/tailwind-flex-overrides-html-hidden-attribute.md`
- **Related features**: E4 Player Deep Dives (`FEATURE_E4` — not yet authored)
- **Follow-up tasks**: `patsbythenumbers-39d.19` (E4-follow: defensive-phase top contributors via participation data, unrelated but adjacent)
