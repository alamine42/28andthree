# E7: Players Hub — Roster Index + Discovery

**Status:** planned
**Owner:** alamine@gmail.com
**Beads epic:** `patsbythenumbers-2le`
**Priority:** P1 (launch-required)
**Related:** SPEC §3.3 (player deep dives), DESIGN.md §Components, E4 plan §3.8 (roster ETL), `app/players/{qb,skill}/[gsisId]/page.tsx`

---

## 1. Context

### 1.1 Problem
E4 shipped `/players/qb/[gsisId]` and `/players/skill/[gsisId]` deep-dive pages, but never built the hub that lets a fan *find* a player. The primary-nav "Players" link currently points to `/` as a placeholder (`components/SiteHeader.tsx:9`). Fans have no path into player content unless they already know a 10-character gsisId. This is a shipping-blocker: the nav is visibly broken and the site fails the basic test of "can a new user reach a player page from the home page."

### 1.2 Audience
- Primary: the Patriots fan who just landed on the site and wants to see how Drake Maye / Stefon Diggs / Hunter Henry are doing this year.
- Secondary: the analytics-literate reader who wants to browse the roster by position ("show me all the WRs") before drilling in.
- Not yet in scope: cross-team comparison ("how does Maye rank vs. league QBs?"), historical seasons picker, opponent-filtered splits — those belong to a post-launch iteration.

### 1.3 Definition of done
- `/players` is a live, server-rendered route with ISR.
- Every player that nflverse emits in `roster_snapshots` for the current season (team = NE) renders as a card. Practice squad + IR surface alongside actives until a future ETL iteration persists a `status` column (review finding #5).
- Every card navigates somewhere useful: QB/RB/WR/TE/FB → player deep-dive; OL/DL/LB/DB → the matching unit page; ST → non-clickable card with a muted "no page yet" label (review finding #7).
- Filter chips narrow by position: All / QB / RB / WR+TE / OL / DEF / ST, with counts derived from an explicit `POSITION_TO_CATEGORY` map (review finding #13).
- Search matches on display name with keyboard a11y (WAI-ARIA 1.2 combobox with `role="combobox"` on the input, `aria-activedescendant` virtual focus, non-focusable options).
- Nav's "Players" link points to `/players`.
- E2E spec green on chromium + Pixel 5 viewport; axe reports no serious/critical violations; no-bad-numbers crawler passes.

### 1.4 Non-goals
- Season/team switchers (fixed to `NE` current season for launch).
- Sortable table columns (filter chips + search cover the discovery need with less complexity).
- Individual defender ratings (SPEC §3.3 defers to v2).
- Cross-page player comparisons or favoriting.
- Headshot image optimization pipeline changes (already handled in E4 via `next/image` + unoptimized + CDN whitelist).

---

## 2. UX scope

### 2.1 Page layout (desktop, ≥1024px)

```
┌─────────────────────────────────────────────────────────┐
│ 2025 SEASON · ACTIVE ROSTER                             │  ← mono eyebrow
│                                                         │
│ Patriots, the whole roster.                             │  ← Cabinet Grotesk display
│                                                         │
│ ┌───────────────────────────────────────────┐           │
│ │ 🔍 Search players…                        │           │  ← combobox
│ └───────────────────────────────────────────┘           │
│                                                         │
│ [All 53] [QB 3] [RB 4] [WR+TE 9] [OL 9]  [DEF 25] [ST 3]│  ← filter chips
│                                                         │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
│ │ [ava]  │ │ [ava]  │ │ [ava]  │ │ [ava]  │             │
│ │ Maye   │ │ Diggs  │ │ Henry  │ │ Gibson │             │
│ │ QB · 10│ │ WR · 1 │ │ TE · 85│ │ RB · 27│             │
│ └────────┘ └────────┘ └────────┘ └────────┘             │
│   … 4-column grid, ~14 rows                             │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Mobile layout (<640px)
- Search full-width at top.
- Chip row horizontally scrolls with scroll-snap + hidden scrollbar — mimics iOS segmented control behavior; no wrapping soup.
- Cards: single column, full-width, larger avatar (72px), comfortable tap target (≥44px).
- Hamburger nav already covers the nav entry point (just shipped E6-05a pattern in `components/SiteHeader.tsx`).

### 2.3 Card anatomy
- **Avatar** (`<PlayerAvatar>` from E4, size 56 desktop / 72 mobile). Initials fallback when headshot missing.
- **Name** — display font, bold, 16px on mobile / 18px desktop.
- **Position · Jersey** — mono 11px muted. Format: `QB · #10` when jersey present, `QB` alone when jersey is null (review finding #15). Position also collapses gracefully when null: the card renders name + avatar only rather than `null · #10`.
- Clickability: QB/skill cards render as `<Link>`; OL/DL/LB/DB cards render as `<Link>` to the relevant unit page; ST cards render as a `<div>` with a muted "page coming soon" affordance (review finding #7).
- No headline stat on cards. Keeps the grid calm and focuses the index on *discovery*; stats belong to the deep-dive page. If we add a stat later, it goes in one defined slot per position (post-launch).

### 2.4 Interactions
- Hover/focus: card surface → `--surface`, outline on the `<Link>` itself (not a wrapper — see `docs/solutions/gotchas/display-contents-hides-focus-rings.md`).
- Chip click: update filter, scroll to top of grid.
- Search:
  - Type ≥2 chars → show up to 8 matches in a listbox below the input.
  - ArrowDown/Up to move listbox focus; Enter to navigate; Esc to clear + collapse.
  - Clicking outside closes the listbox.
  - Empty state ("No players match 'xyz'") after a real search attempt.
- No loading spinners anywhere — everything is client-side filter/search over 53 rows shipped with the page.

### 2.5 Copy voice
Per DESIGN.md §Content:
- Eyebrow: `2025 SEASON · ACTIVE ROSTER` (mono, uppercase, tracked).
- H1: `Patriots, the whole roster.` — terse, declarative, no exclamation.
- Empty state: `No players match "xyz".` (straight quotes around user input).
- Chip labels: `All 53` / `QB 3` / `WR+TE 9` — count is part of the label, not a superscript.

---

## 3. Architecture decisions

### 3.1 Route + rendering strategy
- **`app/players/page.tsx`** — server component, `export const revalidate = 3600`. Matches the hour TTL pattern from home + phase pages.
- **Season detection:** the hub does *not* use `getCurrentSeason()` (which reads from `team_phase_weekly` and goes stale until week 1 data lands). Instead a new DAL helper `getCurrentRosterSeason()` reads `SELECT MAX(season) FROM roster_snapshots WHERE team = 'NE'`. This ensures a newly-ingested preseason roster appears as soon as the ETL commits, not after week 1 (review finding #8).
- **No search params for filter state** in the MVP. Filter lives in client state. Reasoning: URL-sync adds Next.js App Router shallow-routing dance (`router.replace(url, { scroll: false })` still re-renders the server component because App Router has no shallow routing), which costs complexity without unlocking a real user need at launch. Post-launch: wire `?position=QB` as deep-link support once we see users sharing filtered views.
- **~53 players per page load.** Full roster ships to the client. No pagination, no virtualization — the payload is ~5KB of JSON, well under any budget.

### 3.2 DAL: `lib/data/players-hub.ts`
Two read functions, server-only.

```ts
export type RosterEntry = {
  gsisId: string;
  displayName: string;
  position: string | null;   // nullable per schema — handled in roleFor + card anatomy (review finding #4)
  jerseyNumber: number | null;
  headshotUrl: string | null;
  role: PlayerRole;          // computed — drives the card's destination href
  category: PlayerCategory;  // drives the filter chip it belongs to
};

export type PlayerRole = 'qb' | 'skill' | 'ol' | 'dline' | 'defense' | 'special';
export type PlayerCategory = 'QB' | 'RB' | 'WR+TE' | 'OL' | 'DEF' | 'ST';

export async function getCurrentRosterSeason(team?: string): Promise<number | null>;
export async function getPatsRoster(season: number): Promise<RosterEntry[]>;
```

Source of truth: `roster_snapshots` filtered by `team='NE'`, `season=<current>`. Already populated by the E4 ETL — no new ingest work. Empty roster rows (whitespace gsis_id) are already filtered upstream in `etl/ingest/rosters.py` so the DAL can trust the gsisId field. Status filtering (ACT vs PS vs IR) is **not** available from the current schema — all nflverse-emitted rows for the season surface (review finding #5). A follow-up E6 task will add a `status` column to `roster_snapshots` if practice-squad noise proves distracting in production.

Sort order: position bucket (QB → RB → WR → TE → OL → DL → LB → DB → ST → UNKNOWN) then jersey number ascending (nulls last). Implementation: a small lookup map keyed on `role`; no SQL `CASE` (simpler, and the sort happens on ~53 rows — negligible cost).

### 3.3 Position → role + category mapping
New helper `lib/format/player-routes.ts`. Two independent maps (role drives routing; category drives filter chips) because `'skill'` role covers both RB and WR+TE chips (review finding #13). Single source of truth; `TopContributorCard` can migrate to it post-launch.

```ts
const POSITION_TO_ROLE: Record<string, PlayerRole> = {
  QB: 'qb',
  RB: 'skill', HB: 'skill', FB: 'skill', WR: 'skill', TE: 'skill',
  C: 'ol', G: 'ol', OG: 'ol', T: 'ol', OT: 'ol', OL: 'ol',
  DT: 'dline', DE: 'dline', NT: 'dline', DL: 'dline',
  LB: 'defense', ILB: 'defense', OLB: 'defense', MLB: 'defense',
  CB: 'defense', S: 'defense', FS: 'defense', SS: 'defense', DB: 'defense',
  K: 'special', P: 'special', LS: 'special', KR: 'special', PR: 'special', RS: 'special', ST: 'special',
};

const POSITION_TO_CATEGORY: Record<string, PlayerCategory> = {
  QB: 'QB',
  RB: 'RB', HB: 'RB', FB: 'RB',
  WR: 'WR+TE', TE: 'WR+TE',
  C: 'OL', G: 'OL', OG: 'OL', T: 'OL', OT: 'OL', OL: 'OL',
  DT: 'DEF', DE: 'DEF', NT: 'DEF', DL: 'DEF',
  LB: 'DEF', ILB: 'DEF', OLB: 'DEF', MLB: 'DEF',
  CB: 'DEF', S: 'DEF', FS: 'DEF', SS: 'DEF', DB: 'DEF',
  K: 'ST', P: 'ST', LS: 'ST', KR: 'ST', PR: 'ST', RS: 'ST', ST: 'ST',
};

export function roleFor(position: string | null | undefined): PlayerRole {
  if (!position) return 'defense';
  return POSITION_TO_ROLE[position.toUpperCase()] ?? 'defense';
}

export function categoryFor(position: string | null | undefined): PlayerCategory {
  if (!position) return 'DEF';
  return POSITION_TO_CATEGORY[position.toUpperCase()] ?? 'DEF';
}

export function playerHref(entry: { role: PlayerRole; gsisId: string }): Route | null {
  switch (entry.role) {
    case 'qb':      return `/players/qb/${entry.gsisId}` as Route;
    case 'skill':   return `/players/skill/${entry.gsisId}` as Route;
    case 'ol':      return '/team/units/offensive-line' as Route;
    case 'dline':   return '/team/units/defensive-line' as Route;
    case 'defense': return '/team/units/defense' as Route;
    case 'special': return null; // no ST page yet — renders as a non-clickable card
  }
}
```

Position nulls and unknown codes collapse to `'defense'` / `'DEF'` as a last-resort fallback. `playerHref` returns `null` for ST to force the caller to render the card as non-clickable (review finding #7); we don't want to pretend a kicker link goes somewhere useful.

Return-specialist codes (`KR`/`PR`/`RS`) are classified as ST (review finding #10).

### 3.4 Components

| Component | File | Kind | Purpose |
|---|---|---|---|
| `PlayersHubPage` | `app/players/page.tsx` | server | Fetches roster, renders shell + `<RosterBrowser>` |
| `RosterBrowser` | `components/players/RosterBrowser.tsx` | `'use client'` | Owns filter + search state, renders chip row + search + grid |
| `PlayerSearch` | `components/players/PlayerSearch.tsx` | `'use client'` | WAI-ARIA 1.2 combobox input + listbox, navigates on select |
| `RosterCard` | `components/players/RosterCard.tsx` | `'use client'` | Grid card: avatar + name + pos/jersey; `<Link>` for reachable roles, `<div>` for ST |
| `RosterOption` | `components/players/RosterOption.tsx` | `'use client'` | Listbox option: same visual body as `RosterCard` but a non-focusable `<li role="option">` — no nested `<Link>` |
| `PositionChips` | inline in `RosterBrowser` | `'use client'` | `<button>`s with `aria-pressed`, one row |

All are client components (review finding #2). `RosterCard` and `RosterOption` share a `<RosterCardBody>` pres fragment for visuals so name/position/avatar treatment stays in one place; the outer wrapper differs by context because the ARIA contracts differ (review finding #3). The listbox options therefore contain **no focusable descendants** — click/tap navigates via an `onMouseDown`/`onClick` handler that does `router.push()`. Grid cards keep `<Link>` so they work with middle-click, cmd-click, right-click-copy-url, etc.

Test IDs split by context to prevent selector collisions (review finding #11): grid cards emit `data-testid="roster-card-${gsisId}"`; listbox options emit `data-testid="roster-option-${gsisId}"`.

### 3.5 Client-state model (inside `RosterBrowser`)

```ts
const [category, setCategory] = useState<PlayerCategory | 'ALL'>('ALL');
const [query, setQuery] = useState('');

const visible = useMemo(() => {
  const byCategory = category === 'ALL'
    ? roster
    : roster.filter((r) => r.category === category);
  if (query.trim().length < 2) return byCategory;
  const q = query.trim().toLowerCase();
  return byCategory.filter((r) => r.displayName.toLowerCase().includes(q));
}, [roster, category, query]);
```

- One `useMemo`. Filtering 53 rows on every keystroke costs <1ms.
- No debouncing needed — React's re-render cadence is faster than user typing.
- No fuzzy-match library. Substring match covers 95% of the intent for ~53 rows; "Macjone" not matching "Mac Jones" is an edge case we document, not engineer around at launch.

### 3.6 Combobox a11y (WAI-ARIA 1.2)

Per the WAI-ARIA 1.2 refactored pattern, `role="combobox"` goes on the **input itself** (review finding #1), not a wrapper. Wrapper is a plain `<div>`. Options are non-focusable; focus remains on the input throughout (review finding #3).

```
<div className="relative">
  <input
     type="text"
     role="combobox"
     aria-label="Search players"               // review finding #9
     aria-expanded={open}
     aria-controls={listboxId}
     aria-autocomplete="list"
     aria-activedescendant={activeId ?? undefined}
     onKeyDown={handleKey}
     onChange={(e) => setQuery(e.target.value)}
  />
  <ul id={listboxId} role="listbox" hidden={!open}>
    <li id={`opt-${p.gsisId}`}
        role="option"
        aria-selected={activeIdx === i}
        data-testid={`roster-option-${p.gsisId}`}
        onMouseDown={(e) => e.preventDefault()}     // review finding #12 — keep input focused
        onClick={() => navigate(p)}>
      <RosterCardBody player={p} />
    </li>
  </ul>
</div>
```

Keyboard model:
- `ArrowDown` in input with matches: open listbox, set active to first option (virtual focus via `aria-activedescendant`).
- `ArrowDown` in listbox: next option, wrap at end.
- `Enter` in listbox: navigate (use `router.push`).
- `Enter` in input with matches but no active option: navigate to first match.
- `Escape`: close listbox, clear focus but preserve input text (matches GitHub / Notion).
- `Escape` when listbox closed: clear input.
- `Tab` out: close listbox without selection.

Pointer model:
- `onMouseDown` on an option calls `preventDefault()` so the input doesn't blur; this is the fix for the classic "click on listbox option does nothing because the blur closes the list before the click lands" bug (review finding #12).
- `onClick` handler then performs the navigation.

### 3.7 Revalidation
- Add `/players` to `lib/revalidation/tags.ts` `REVALIDATE_PATHS` so the weekly roster ETL run invalidates it.
- Tag-based revalidation is a separate E6 item (`player:index` tag) — out of scope for E7; path-based is sufficient until the full tag migration lands.

### 3.8 Performance budget
- Page JS bundle (client component portion): **≤12KB gzip** (combobox + chip row + filter memo — no libraries).
- Headshot images: 53 × ~3KB (WebP, 64×64 served) = 160KB, all lazy-loaded below the first screen.
- LCP: avatar row is below the fold; LCP element is the H1 → well under 2.5s budget.
- No network requests on filter/search — all in-memory.

### 3.9 Security
- No user input hits the server (filter/search is pure client).
- CSP already whitelists the NFL headshot CDN (E4).
- `router.push()` target is computed from a position-role enum + a gsisId we just rendered from our own DB — no open-redirect surface.

### 3.10 Error surface
- DB unreachable at build / ISR refresh → `getPatsRoster()` returns `[]` (existing pattern in `lib/data/*`). Page renders the shell + an empty-state message: `Roster data unavailable — check back after the next ETL run.`
- Empty roster (ETL ran, produced zero rows) → same empty state. Not impossible (week 0, offseason).
- Unknown position → falls through to `'defense'` role (defensive default, see §3.3). A subsequent `/team/units/defense` page render is our safety net.

### 3.11 Nav wiring (E7-03)
- `components/SiteHeader.tsx` `NAV_LINKS[2].href` changes from `'/'` to `'/players'`.
- Audit (not fix) the other placeholder hrefs: Team (`'/'`), Phases (`'/'`), Draft (`'/'`), Coaching (`'/'`). Team → `'/'` is fine (home *is* the team view). Phases has no index page (all phase content is on `/phases/[slug]`). Draft + Coaching are E5 work. Leaving those as `'/'` for now is consistent with E5's planning.
- Typed routes: `/players` must be recognized. Next.js `experimental.typedRoutes` picks it up automatically from the new `app/players/page.tsx`.

---

## 4. Tests

### 4.1 E2E — `tests/e2e/e7.spec.ts`

```ts
test.describe('E7 players hub', () => {
  test('renders current-season Pats roster with >= 30 cards', async ({ page }) => {
    await page.goto('/players');
    const cards = page.locator('[data-testid^="roster-card-"]');
    await expect.poll(async () => cards.count()).toBeGreaterThanOrEqual(30);
  });

  test('position chip narrows the grid', async ({ page }) => {
    await page.goto('/players');
    await page.getByRole('button', { name: /^QB/i }).click();
    const cards = page.locator('[data-testid^="roster-card-"]');
    await expect.poll(async () => cards.count()).toBeGreaterThanOrEqual(1);
    // No upper bound — camp rosters can carry many QBs and we don't filter
    // by status yet (review finding #14).
  });

  test('search → Enter navigates to the matched player', async ({ page }) => {
    await page.goto('/players');
    const input = page.getByRole('combobox', { name: /search players/i });
    await input.fill('May'); // Drake Maye
    await expect(page.getByRole('listbox')).toBeVisible();
    await input.press('Enter');
    await expect(page).toHaveURL(/\/players\/qb\/00-\d{7}/);
  });

  test('keyboard-only: arrow into listbox, Enter selects', async ({ page }) => {
    await page.goto('/players');
    await page.getByRole('combobox', { name: /search players/i }).fill('Dig');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/players\/skill\/00-\d{7}/);
  });

  test('OL card routes to the offensive-line unit page', async ({ page }) => {
    await page.goto('/players');
    await page.getByRole('button', { name: /^OL/i }).click();
    await page.locator('[data-testid^="roster-card-"]').first().click();
    await expect(page).toHaveURL(/\/team\/units\/offensive-line/);
  });

  test('ST card renders as non-clickable (no href)', async ({ page }) => {
    await page.goto('/players');
    await page.getByRole('button', { name: /^ST/i }).click();
    const first = page.locator('[data-testid^="roster-card-"]').first();
    // ST cards should be a <div> with no href — clicking should not navigate.
    const tag = await first.evaluate((el) => el.tagName);
    expect(tag).toBe('DIV');
  });

  test('mouse click on listbox option navigates (no blur-close bug)', async ({ page }) => {
    await page.goto('/players');
    await page.getByRole('combobox', { name: /search players/i }).fill('May');
    await page.locator('[data-testid^="roster-option-"]').first().click();
    await expect(page).toHaveURL(/\/players\/(qb|skill)\/00-\d{7}/);
  });

  test('Escape in listbox closes but preserves input', async ({ page }) => {
    await page.goto('/players');
    const input = page.getByRole('combobox', { name: /search players/i });
    await input.fill('Maye');
    await expect(page.getByRole('listbox')).toBeVisible();
    await input.press('Escape');
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(input).toHaveValue('Maye');
  });

  test('empty search state', async ({ page }) => {
    await page.goto('/players');
    await page.getByRole('combobox', { name: /search players/i }).fill('Zzzzzzz');
    await expect(page.getByText(/no players match/i)).toBeVisible();
  });

  test('mobile viewport: chip row scrollable, cards single column', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 }); // Pixel 5
    await page.goto('/players');
    // Single-col check: card width ≈ viewport width - gutters.
    const first = page.locator('[data-testid^="roster-card-"]').first();
    const box = await first.boundingBox();
    expect(box?.width).toBeGreaterThan(300);
  });

  test('nav "Players" link reaches the hub', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^Players$/i }).first().click();
    await expect(page).toHaveURL(/\/players$/);
  });
});
```

### 4.2 Axe scan
Add `/players` to `tests/e2e/a11y.spec.ts` ROUTES. Expected to pass:
- All interactive elements are focusable (no `display: contents` traps).
- Combobox follows ARIA 1.2 with the labels + relations above.
- Chip buttons use `aria-pressed`.
- Avatar images have `alt` (already handled in `<PlayerAvatar>`).

### 4.3 No-bad-numbers
Add `/players` to `tests/e2e/no-bad-numbers.spec.ts` ROUTES. There are no rendered metrics on the page itself (no `[data-numeric="true"]`), so this is a sanity check that nothing accidentally leaks.

### 4.4 Unit tests — `tests/unit/player-routes.test.ts`

```ts
describe('roleFor', () => {
  it('maps QB → qb', () => assert.equal(roleFor('QB'), 'qb'));
  it('maps RB/HB/FB → skill', () => {
    for (const p of ['RB','HB','FB']) assert.equal(roleFor(p), 'skill');
  });
  it('maps WR/TE → skill', () => {
    for (const p of ['WR','TE']) assert.equal(roleFor(p), 'skill');
  });
  it('maps OL variants → ol', () => {
    for (const p of ['C','G','OG','T','OT','OL']) assert.equal(roleFor(p), 'ol');
  });
  it('maps DL variants → dline', () => {
    for (const p of ['DT','DE','NT','DL']) assert.equal(roleFor(p), 'dline');
  });
  it('maps LB + DB variants → defense', () => {
    for (const p of ['LB','ILB','OLB','MLB','CB','S','FS','SS','DB']) {
      assert.equal(roleFor(p), 'defense');
    }
  });
  it('maps K/P/LS → special', () => {
    for (const p of ['K','P','LS']) assert.equal(roleFor(p), 'special');
  });
  it('defensive default for unknown', () => assert.equal(roleFor('XYZ'), 'defense'));
  it('case-insensitive', () => assert.equal(roleFor('qb'), 'qb'));
});
```

### 4.5 DAL test — `tests/unit/players-hub.test.ts`
Mock the Drizzle client; assert that `getPatsRoster(2025)` emits WHERE `team='NE'` AND `season=2025` and sorts by position bucket + jersey. Confirm empty-DB short-circuit returns `[]` (matches existing DAL pattern).

---

## 5. Task sequencing

```
E7-01 (index page + DAL)  ──┐
                             ├──▶ E7-04 (search, P2)  ──┐
                             │                           ├──▶ E7-05 (E2E)
                             ├──▶ E7-02 (position chips)┤
                             │                           │
                             └──▶ E7-03 (nav wiring)   ──┘
```

E7-01 unblocks every other task. E7-02 and E7-03 are independent of each other; both can ship in one day. E7-04 (search) is P2 — shippable last, cuttable from launch if budget tightens (filter chips alone cover discovery).

### 5.1 Estimates
| Task | Estimate |
|---|---|
| E7-01: DAL + index page + RosterCard | 3h |
| E7-02: Position chips + filter memo | 1h |
| E7-03: Nav wiring + audit | 15m |
| E7-04: Combobox search | 2.5h |
| E7-05: E2E spec + axe + no-bad-numbers wiring | 1.5h |
| **Total** | **~8h** |

### 5.2 E6 dependencies (already wired in beads)
- `E6-05b` (mobile pass: players + units) — blocks on E7-01.
- `E6-03` (metadata audit) — blocks on E7-01 (new route needs metadata).
- `E6-04` (sitemap.xml + robots.txt) — blocks on E7-03 (nav wiring is the signal the route is real).
- `E6-11` (perf regression hunt) — blocks on E7-05.
- `E6-15` (launch checklist) — blocks on E7-05.

---

## 6. Simplicity review

What we're **not** doing and why:

1. **No URL-sync for filter state.** App Router has no shallow routing; every `router.replace` re-renders the server component. The cost > the benefit at launch.
2. **No virtualization.** 53 rows fit in one DOM, under any device's budget. `react-window` would be dead weight.
3. **No search library** (Fuse.js, fzf). Substring match covers 95% of the intent on 53 rows. Ship the 5% as a post-launch polish item if users complain.
4. **No per-card stat.** Adding "EPA/dropback" to QB cards, "target share" to WR cards, etc. creates N position-specific card variants and double-plumbing of data already shown on the deep-dive page. Index page is for *discovery*, not a compressed second dashboard.
5. **No season switcher.** Current-season-only is consistent with the rest of the app's v1 scope.
6. **No team switcher.** NE-only; not building a league-wide player directory.
7. **Single DAL read.** One query, no joins beyond roster_snapshots. Stats come from the deep-dive query when the user clicks through.

---

## 7. Adversarial review (codex)

Completed 2026-04-20. Full findings in [`e7-players-hub-plan-adversarial-review.md`](./e7-players-hub-plan-adversarial-review.md). 15 findings (7 HIGH / 7 MEDIUM / 1 LOW); all 15 adjudicated and incorporated:

| # | Severity | Finding | Resolution | Section |
|---|---|---|---|---|
| 1 | HIGH | `role="combobox"` on wrapper, not input | Moved onto input per WAI-ARIA 1.2 | §3.6 |
| 2 | HIGH | Server component imported by client | All hub components are client-side | §3.4 |
| 3 | HIGH | `<Link>` inside `<li role="option">` | Split into `RosterCard` + `RosterOption`; options are non-focusable | §3.4, §3.6 |
| 4 | HIGH | `roleFor` crashes on null position | Typed `string \| null`, null → `'defense'` | §3.2, §3.3 |
| 5 | HIGH | Can't filter to ACT — no `status` column | DoD revised to "every row nflverse emits"; status filter deferred | §1.3 |
| 6 | HIGH | OL/DEF cards didn't meet DoD | Revised DoD wording — unit pages count as destinations per SPEC §3.3 | §1.3 |
| 7 | MEDIUM | ST cards dumped on defense page | Non-clickable ST cards (`playerHref` returns `null`) | §2.3, §3.3 |
| 8 | HIGH | Season detection lags ETL | New `getCurrentRosterSeason()` reads `MAX(season)` from rosters | §3.1, §3.2 |
| 9 | MEDIUM | Search input missing accessible name | `aria-label="Search players"` | §3.6 |
| 10 | MEDIUM | Position map missed KR/PR/RS | Added to `POSITION_TO_ROLE` + `_TO_CATEGORY` | §3.3 |
| 11 | MEDIUM | Shared `data-testid` collision | Grid uses `roster-card-*`, options use `roster-option-*` | §3.4 |
| 12 | HIGH | Mouse click on option blurs + closes | `onMouseDown={preventDefault}` then `onClick` navigates | §3.6 |
| 13 | MEDIUM | Category derivation underspecified | Separate `POSITION_TO_CATEGORY` map | §3.3 |
| 14 | MEDIUM | QB `<=6` assertion brittle | Dropped upper bound; assert `>=1` | §4.1 |
| 15 | LOW | Null jersey prints `null` | `#NN` when present, hide divider when null | §2.3 |

---

## 8. Task set (beads)

| ID | Task | Pri | Est | Blocks on |
|---|---|---|---|---|
| `patsbythenumbers-o0l` | E7-01: /players index page + roster data | P1 | 3h | — |
| `patsbythenumbers-4nf` | E7-02: Position filter chips | P1 | 1h | E7-01 |
| `patsbythenumbers-x7m` | E7-03: Nav wiring — /players | P1 | 15m | E7-01 |
| `patsbythenumbers-kyg` | E7-04: Player search (combobox) | P2 | 2.5h | E7-01 |
| `patsbythenumbers-ziu` | E7-05: E7 epic E2E + axe + no-bad-numbers | P1 | 1.5h | E7-01, E7-02, E7-03 |

Epic: `patsbythenumbers-2le` (P1, open, 0/5 children complete).

---

## 9. Open risks

1. **Roster freshness at launch.** ETL runs weekly; if a player is cut mid-week, the index will be stale for up to 6 days. Acceptable for v1 — SPEC §3.5 already flags data-freshness as a known tradeoff. Post-launch we can add a `last_ingested_at` indicator in the eyebrow.
2. **Practice-squad / IR noise.** `roster_snapshots` has no `status` column, so all rows nflverse emits show up together (review finding #5). Active-only filtering requires schema + ETL work that belongs in a follow-up task. If the noise is distracting in prod, file it as an E6 polish item pre-launch.
3. **No `/team/units/special-teams` page.** ST cards render as non-clickable (review finding #7). Acceptable for launch — the fan sees the player exists and that the breakdown is coming. File a stub page as an E6 follow-up if feedback demands it.
4. **Keyboard-only search on iOS.** Mobile Safari's soft keyboard can collapse the listbox by taking focus. Validation during E7-04 implementation; may need `onBlur` to check `relatedTarget` before closing.
5. **`roleFor` fallback masks bugs.** Unknown positions default to `'defense'` silently. If nflverse adds a new code (historically rare but possible), defenders-page links swell quietly rather than surfacing a missing entry. Mitigation: log in dev when `POSITION_TO_ROLE` misses; trust prod to behave.

---

## 10. Exit criteria

**Automated:**
- `pnpm test` green (unit suite including `player-routes.test.ts` + `players-hub.test.ts`).
- `pnpm test:e2e --grep e7` green on chromium.
- `@axe-core/playwright` green on `/players` (no serious/critical).
- `pnpm build` completes; `/players` appears in the build manifest as `●` (SSG) or `○` (Static).

**Operator-verified:**
- Click *Players* in nav → land on `/players`.
- Click a QB card → deep-dive page loads.
- Click a DEF card → `/team/units/defense`.
- Search "Maye" → listbox → Enter → Drake Maye's deep-dive.
- Pixel 5 viewport: chip row scrolls horizontally; cards single-column; tap target ≥44px.
- Typecheck clean (`pnpm typecheck`).
- `/consolidate` run if we hit any non-obvious gotchas during build (combobox a11y edge cases are the likely candidates).
