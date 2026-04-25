# E9 (bd-8rd): Schedule-aware ETL + UI — Technical Plan

**Status:** v2 (post-codex adversarial review — 4 findings adjudicated)
**Beads issue:** `patsbythenumbers-8rd`
**Sprint:** post-launch polish (2026-05)
**Review doc:** `e9-schedule-aware-plan-adversarial-review.md`

> **v2 delta vs v1**:
> - Offseason gate deadlock fix (codex CRITICAL): missing `nextGameDate` now triggers a run, not a skip. Plus a 14-day max-skip cadence as belt + suspenders.
> - Day-delta math normalized to `America/New_York` (codex SUGGESTION).
> - Playoff round mapping kept as numeric (19/20/21/22) — verified against actual DB rows; documented the convention so future readers don't second-guess it.
> - Color contrast warning on `--accent`/`--negative` deferred — DESIGN.md issue, not in this plan's scope. Filed as a separate concern (see §9).

---

## 1. Context

### Problem

Two related smells, one root cause:

1. **ETL** has off-season awareness (`etl/freshness.py`) but it's anchored to hardcoded calendar dates: `feb_start = date(today.year, 2, 15)` and `today.month < 3`. The moment the NFL shifts the season window (international games, expanded preseason, schedule slip), these break silently — the gate passes when it shouldn't or skips when it shouldn't.
2. **Web UI** has zero schedule awareness. `app/page.tsx::buildEyebrow()` returns `IN PROGRESS` or `FINAL` based on a heuristic ("any phase has ≥100 plays"). In mid-June with 4 months since the last game, the eyebrow still says `2025 SEASON · FINAL` — technically true but misleading. There's no signal to the user that they're looking at frozen data.

### Audience

Same solo audience (Mehdi + readers of the public site). The win is correctness + signal:
- ETL failures during in-season weeks remain loud; off-season silence is explicit.
- Site visitors see honest copy ("OFFSEASON · NEXT GAME IN 87 DAYS") rather than implicit-stale "FINAL".

### Why now

Tail end of 2025 season just shipped (Feb 8 SB). We're entering the first full off-season since the site exists. Without this, the eyebrow + footer copy will silently be wrong for ~6 months until preseason.

### Success (qualitative)

- One module owns "what is today, in NFL calendar terms?". Both ETL Python and web TypeScript read from it.
- Zero hardcoded month/date checks anywhere. All boundaries derive from `games` table state.
- Eyebrow + footer convey schedule context honestly.

### Success (quantitative acceptance)

Mirrored in §8 task acceptance:
1. `getSchedulePhase()` unit tests cover all 3 phases × 4 boundary cases (12 cases).
2. ETL freshness-gate uses the new helper; no hardcoded dates remain in `etl/freshness.py`.
3. Existing freshness tests still pass.
4. Home page eyebrow + footer show schedule-aware copy in dev sandbox + prod.
5. E2E spec covers eyebrow in regular / playoffs / offseason states (3 seeded fixtures).

---

## 2. UX

The whole UX deliverable is copy + visibility-state. No new components, no new pages.

### Eyebrow copy table

| Phase | Eyebrow (existing → new) |
|---|---|
| `regular` | `2025 SEASON · IN PROGRESS` (unchanged) |
| `playoffs` | `2025 PLAYOFFS · DIVISIONAL ROUND` *(or "WILD CARD", "CONFERENCE", "SUPER BOWL" — derived from week numbers)* |
| `offseason`, post-SB / pre-Sept | `2025 SEASON · FINAL · NEXT GAME IN 87 DAYS` |
| `offseason`, no future REG game scheduled yet | `2025 SEASON · FINAL · OFFSEASON` |

The "next game in N days" string only appears when there's a scheduled REG game in `games` for season N+1. nflverse typically publishes the next-season schedule in mid-May.

### Footer "last refresh" copy

Today: `LAST REFRESH: <relative time>` (live dot pulses).
New, in offseason: `LAST REFRESH: 2026-02-09 · NEXT REFRESH AFTER WEEK 1 KICKOFF` (live dot dimmed).

The footer is `components/SiteFooter.tsx` — small change to the freshness indicator.

### Anti-goals

- No new "Draft countdown" card, no "Training camp tracker", no offseason news. Just truthful copy on what exists.
- No flicker / hydration mismatch. Phase resolves at server-render time; client never re-derives.

---

## 3. Architecture

### Module layout

```
lib/schedule/
  phase.ts              ← TypeScript helper (web)
  phase.test.ts         ← unit tests (no DB; pure function tests)
  index.ts              ← re-exports

etl/
  schedule.py           ← Python helper (ETL) — same contract as TS
  freshness.py          ← REFACTORED: drops hardcoded dates, calls schedule.py
tests/                  ← (etl/tests/test_schedule.py)
```

Two implementations, one contract. Both live next to their respective consumers (no shared dependency between Python + TypeScript by design — the project doesn't have a polyglot codegen pipeline). The contract is documented as a comment block in both files; unit-test golden values are mirrored.

### Public API (TypeScript)

```ts
export type SchedulePhase = 'regular' | 'playoffs' | 'offseason';

export type ScheduleSnapshot = {
  phase: SchedulePhase;
  // The "season of interest" for the user right now. During offseason, this
  // is the most recently completed season (we still display its data).
  season: number;
  // Last completed game; populated whenever `games` has a completed row.
  lastGameDate: Date | null;
  daysSinceLastGame: number | null;
  // Next scheduled REG game (any season). Null if nflverse hasn't released
  // the next schedule yet.
  nextGameDate: Date | null;
  daysUntilNextGame: number | null;
  // Playoffs sub-state, only populated when phase === 'playoffs'.
  playoffRound: 'wild_card' | 'divisional' | 'conference' | 'super_bowl' | null;
};

export const getSchedulePhase: (now?: Date) => Promise<ScheduleSnapshot>;
```

`now` is injectable for testing; production callers pass nothing (defaults to `new Date()`).

### Public API (Python)

```python
@dataclass(frozen=True, slots=True)
class ScheduleSnapshot:
    phase: Literal['regular', 'playoffs', 'offseason']
    season: int
    last_game_date: date | None
    days_since_last_game: int | None
    next_game_date: date | None
    days_until_next_game: int | None
    playoff_round: Literal['wild_card', 'divisional', 'conference', 'super_bowl'] | None

def get_schedule_phase(
    *,
    now: datetime,
    db_connection: psycopg.Connection,
) -> ScheduleSnapshot: ...
```

Same shape, snake-case. `now` is required (no implicit `datetime.now()`) per the existing freshness convention.

### Phase derivation rules

**Pure function**, takes a list of `(season, season_type, first_game, last_game)` tuples + `now`, returns `ScheduleSnapshot`. Both implementations call this pure function; only the SQL fetch differs.

**Day-delta math** (`daysSinceLastGame`, `daysUntilNextGame`) is computed in `America/New_York` local time, not UTC. Without this, the deltas can flip ±1 around UTC midnight (especially the Pats time zone is UTC-5/-4). Implementation: convert both `now` and `gameDate` to NY-local dates (no time component), then `(d2 - d1).days`. Same convention in TS + Python (`zonedTimeToUtc` / `zoneinfo.ZoneInfo("America/New_York")`).

```
INPUT:
  rows: [(season, season_type, first_game, last_game), ...]   # from one query
  now: datetime

ALGORITHM:
  1. Pick "season of interest":
       - The latest season whose REG first_game ≤ now.
       - If no such season exists → use MIN(season) in rows (early data).
  2. Within that season:
       - REG window:    [first_game(REG), last_game(REG)]
       - POST window:   (last_game(REG), last_game(POST)]
       - Otherwise:      offseason
  3. If now ∈ REG window → phase=regular
     If now ∈ POST window → phase=playoffs + derive playoff_round from week
     Else → phase=offseason
  4. lastGameDate = MAX(game_date) over completed games (any season ≤ now).
     nextGameDate = MIN(game_date) over games where game_date > now.
```

### Single SQL query (used by both)

```sql
SELECT season, season_type,
       MIN(game_date) AS first_game,
       MAX(game_date) AS last_game,
       MAX(week)      AS last_week,
       MIN(week) FILTER (WHERE game_date > $1)             AS next_week,
       MIN(game_date) FILTER (WHERE game_date > $1)        AS next_game_date,
       MAX(game_date) FILTER (WHERE game_date <= $1
                              AND completed = true)        AS last_completed
FROM games
WHERE season BETWEEN ($2 - 1) AND ($2 + 1)
GROUP BY season, season_type
ORDER BY season, season_type;
```

Bounded to 3 seasons (last/current/next) → max 6 rows back (REG+POST per season). $1 = `now`, $2 = current calendar year. Hits the (season) index already on the table.

### Caching

TypeScript: wrap `getSchedulePhase()` in React `cache()`. Web pages have `revalidate = 3600`; the helper computes once per render. No cross-render cache (avoids stale state at midnight UTC boundaries).

Python: no caching. The ETL freshness-gate runs once per cron invocation; no duplicate calls within a process.

### ETL freshness.py refactor

**Before**:
```python
def _is_offseason(today, next_week1):
    feb_start = date(today.year, 2, 15)
    offseason_end = next_week1 - timedelta(days=7)
    return feb_start <= today < offseason_end
```

**After**:
```python
from etl.schedule import get_schedule_phase

# Max days the gate is allowed to skip in a row, regardless of phase.
# Belt + suspenders: even if our schedule view says "stale forever",
# we re-attempt every 2 weeks to pull a fresh nflverse release.
_MAX_OFFSEASON_SKIP_DAYS = 14

def check_freshness(..., last_ok_run_at: datetime | None):
    snap = get_schedule_phase(now=now, db_connection=db_connection)

    # Offseason skip rule. Three guards, all must hold to skip:
    #   1) Phase is offseason.
    #   2) We DO know the next game date (else we need to run to refresh schedule).
    #   3) Next game is >7 days away.
    #   4) Last successful run was <14 days ago (forces a periodic refresh
    #      so newly-published next-season schedules get ingested even if
    #      the gate would otherwise skip indefinitely).
    if (
        snap.phase == 'offseason'
        and snap.days_until_next_game is not None
        and snap.days_until_next_game > 7
        and last_ok_run_at is not None
        and (now - last_ok_run_at).days < _MAX_OFFSEASON_SKIP_DAYS
    ):
        return FreshnessResult(
            should_run=False,
            reason='offseason',
            current_season=snap.season,
        )
    # ... rest unchanged
```

**Why the 14-day max-skip**: codex flagged this as critical. Without it, an offseason where our DB has no next-season schedule yet (e.g., March 2026, before nflverse releases the 2026 schedule) would loop forever — `days_until_next_game` stays `None`, gate skips, gate never runs, schedule never gets pulled. The two-week ceiling guarantees the ETL re-attempts even when it "thinks" it has nothing to do.

The new `last_ok_run_at` parameter is sourced from `meta_refresh.completed_at` (latest `status='ok'` row) in `run_freshness_gate()`.

The `current_season` injection from `etl/main.py::_current_season_year()` becomes redundant — `snap.season` is the new source of truth. Keep `_current_season_year()` as a thin wrapper that calls the snap (one less code path that drifts).

### Web UI consumers

**`app/page.tsx::buildEyebrow()`**: replace the heuristic with snap-based copy.

```ts
async function buildEyebrow(snap: ScheduleSnapshot, snapshot: PhaseSnapshot[]): Promise<string> {
  const { season, phase, daysUntilNextGame, playoffRound } = snap;
  switch (phase) {
    case 'regular':
      return `${season} SEASON · IN PROGRESS`;
    case 'playoffs':
      return `${season} PLAYOFFS · ${PLAYOFF_LABELS[playoffRound!]}`;
    case 'offseason': {
      const tail = daysUntilNextGame != null
        ? `NEXT GAME IN ${daysUntilNextGame} DAYS`
        : 'OFFSEASON';
      return `${season} SEASON · FINAL · ${tail}`;
    }
  }
}
```

**`components/SiteFooter.tsx`**: read `snap` from a server component prop or via a fresh call; render dimmed live-dot + offseason copy when `phase === 'offseason'`.

---

## 4. E2E tests upfront

### Unit tests (TypeScript) — `lib/schedule/phase.test.ts`

| Test | Input rows | now | Expected phase | Expected fields |
|---|---|---|---|---|
| Regular-season Tuesday | 2025 REG 2025-09-04..2026-01-05 | 2025-10-15 | regular | season=2025, daysSinceLastGame≥0, daysUntilNextGame≤7 |
| First day of REG | 2025 REG 2025-09-04..2026-01-05 | 2025-09-04 | regular | season=2025 |
| Last day of REG | 2025 REG ..2026-01-05 | 2026-01-05 | regular | season=2025 |
| Day after REG ends | 2025 REG ..2026-01-05 + POST 2026-01-11..02-08 | 2026-01-06 | offseason→playoffs gap *(see edge case below)* | – |
| Wild card weekend | + POST 2026-01-11.. | 2026-01-11 | playoffs | playoffRound=wild_card |
| Divisional | | 2026-01-18 | playoffs | playoffRound=divisional |
| Conference | | 2026-01-25 | playoffs | playoffRound=conference |
| Super Bowl Sunday | | 2026-02-08 | playoffs | playoffRound=super_bowl |
| Day after SB | + last_game=2026-02-08 | 2026-02-09 | offseason | nextGameDate from 2026 schedule (if released) |
| Mid-offseason, no next schedule | only past games | 2026-06-15 | offseason | nextGameDate=null, tail copy='OFFSEASON' |
| Pre-season approach | + 2026 REG first=2026-09-03 | 2026-08-20 | offseason | daysUntilNextGame=14 |
| First game of next season | + 2026 REG first=2026-09-03 | 2026-09-03 | regular | season=2026 |

**Edge case "REG ends but POST hasn't started"**: There's typically a 4-7 day gap. Decision: treat that gap as `playoffs` (not `offseason`) since it's clearly within the playoff window. Snap calls this with `phase='playoffs', playoffRound='wild_card'` (the upcoming round).

### Unit tests (Python) — `etl/tests/test_schedule.py`

Mirror of the TS table. Same row shapes, same expected outputs. Both implementations should produce byte-identical phase + fields given identical input.

### Integration test (Python) — `etl/tests/test_freshness_offseason.py`

Existing freshness tests assume hardcoded `Feb 15` boundary. Update to seed `games` table with 2024-25 schedule, advance `now` through the year, assert gate decisions match snap-derived phase.

### E2E spec — `tests/e2e/schedule-eyebrow.spec.ts`

Three sandbox fixture variants (added to `lib/sandbox/fixtures/team.ts` or new `lib/sandbox/fixtures/schedule.ts`):

1. **regular**: `gameSchedule.next = 5 days out, last = 2 days ago` → expect `IN PROGRESS`
2. **playoffs**: `last REG was 4 days ago, next POST is in 3 days` → expect `PLAYOFFS · WILD CARD`
3. **offseason**: `last game was 60 days ago, no next game scheduled` → expect `OFFSEASON`

Spec uses sandbox mode with a query-param to select fixture variant (`?fixture=offseason`). Or: 3 separate fixture-mode env flags. Or simpler: 3 separate Playwright `test()` blocks with `process.env.SANDBOX_SCHEDULE_PHASE` set per test.

---

## 5. Simplicity review

Before adversarial review, applied the "ruthlessly simple" lens:

- **Cut**: a "preseason" phase. Games table doesn't track preseason; trying to model it requires either a separate table or hardcoded heuristics. Not worth it.
- **Cut**: `playoffRound` derivation that's anything other than week-number lookup. Wild-card = week 19, divisional = 20, conference = 21, super_bowl = 22 (nflverse convention, normalized to numeric in our `etl/ingest/nflverse.py::fetch_schedules` step). Verified against `games` table 2024-25 + 2025-26 POST rows: weeks 19-22, n=6/4/2/1 per round. Hardcoded mapping in `PLAYOFF_LABELS` constant — codex flagged this as a possible string-vs-int trap because raw nflverse output uses string labels for postseason; our normalize step writes integers, so the integer mapping is correct here. Documented inline.
- **Kept**: dual implementation (TS + Python). Tempted to query DB once on web side and pass to ETL via a shared state file — but that's complexity for ~30 lines of mirrored logic. Mirror is cheaper.
- **Kept**: `now` injection. Tests unreadable without it.
- **Kept**: `revalidate = 3600` on consuming pages. Phase doesn't change frequently enough to justify shorter TTL. Revalidation across the day boundary is rough but acceptable — phase boundaries are days, not minutes.

---

## 6. Adversarial review (codex)

Completed 2026-04-25 — see `e9-schedule-aware-plan-adversarial-review.md`. Four findings, adjudicated:

| # | Severity | Finding | Verdict |
|---|---|---|---|
| 1 | CRITICAL | Offseason gate deadlock: missing `nextGameDate` causes infinite skip | **Accepted** — fixed in §3 (3 added skip guards + 14-day max-skip ceiling) |
| 2 | WARNING | `--accent`/`--negative` color contrast fails WCAG AA on dark surfaces | **Deferred** — DESIGN.md issue, not in this plan's scope. See §9. |
| 3 | WARNING | Playoff round mapping assumes numeric weeks but nflverse ships strings | **Rejected with note** — verified our `games.week` is `smallint` 19-22 (ETL normalizes). Documented in §5. |
| 4 | SUGGESTION | UTC date-math swings ±1 around midnight | **Accepted** — day-deltas now computed in `America/New_York` (§3) |

---

## 7. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Games table empty on first deploy → snap returns garbage. | Helper returns `phase='offseason', season=fallback` (current calendar year) when no rows. Document as "bootstrap state". |
| nflverse releases next-season schedule late (post-July) → no `nextGameDate`, eyebrow shows bare 'OFFSEASON' for weeks. | Acceptable. Better than fabricating a date. |
| Python + TS implementations drift. | Shared golden-values fixture in `tests/fixtures/schedule-cases.json`; both test suites consume. CI fails if either suite diverges. |
| Hydration mismatch on home page (server renders 2025-10-15, client renders 2025-10-16 due to timezone). | Server-only computation. Eyebrow/footer rendered server-side with no client overrides. |
| `revalidate=3600` could mean a stale phase shows for an hour at a phase boundary (e.g. SB Sunday → SB Monday). | Acceptable. Phase transitions happen ~5 times per year; a 1-hour stale window is invisible. |

---

## 8. Tasks

Filed as children of `bd-8rd`:

1. **bd-8rd.1 — Shared golden-values fixture** (`tests/fixtures/schedule-cases.json`): seed 12 cases (rows + now → expected snap). Used by both TS + Python unit tests. P2.
2. **bd-8rd.2 — TypeScript `lib/schedule/phase.ts` + unit tests**. Pure function + thin DB wrapper. P2.
3. **bd-8rd.3 — Python `etl/schedule.py` + unit tests**. Mirror of (2). P2.
4. **bd-8rd.4 — Refactor `etl/freshness.py`** to call `etl/schedule.py`; drop hardcoded `feb_start` / `today.month < 3` checks. Existing freshness tests stay green. P2.
5. **bd-8rd.5 — Web UI consumers**: `app/page.tsx::buildEyebrow()` + `components/SiteFooter.tsx` schedule-aware copy. Sandbox stub mirrors. P2.
6. **bd-8rd.6 — E2E spec** `tests/e2e/schedule-eyebrow.spec.ts` covering regular / playoffs / offseason. P2.
7. **bd-8rd.7 — Doc** `docs/runbook.md#schedule-aware-helpers` covering the contract + how to add a new consumer. P3.

Sequencing: 1 → (2 ‖ 3) → 4 → 5 → 6 → 7.

---

## 9. Out-of-scope (filed separately)

- **DESIGN.md `--accent` / `--negative` contrast** — codex finding #2. Both colors fail WCAG AA 4.5:1 on `--bg` and `--surface`. Not in this plan's scope; tracked in a separate beads issue.
