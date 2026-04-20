# E4 Plan — Adversarial Review Adjudication

**Date:** 2026-04-19
**Reviewer:** Codex CLI (gpt-5-codex via API-key auth), challenge mode.
**Plan under review:** `docs/plans/e4-player-deep-dives-plan.md` v1.
**Raw output:** `/tmp/codex-e4-review-output.txt` (session-local).

Codex raised 12 findings. Each adjudicated: **ACCEPT** / **PARTIAL** / **REJECT**.

---

## Findings

### 1. HIGH — Participation data missingness breaks flagship pages

**Critique:** plan "blanks pressure- and route-derived stats to NULL," turning QB/WR pages into em-dashes when coverage drops below 80% for a real game.

**Verdict: ACCEPT.**

**Fix applied:** §3.4 gets a `participationCoverage` helper computed at ETL time per (season, week, team): `tagged_plays / total_plays`. QB page + skill page render:
- `coverage ≥ 80%` → show participation-derived stats normally.
- `coverage < 80%` → hide affected modules (pressure split, clean-pocket split, routes-run) behind a conspicuous banner: *"Participation data incomplete for this game (47% coverage). Hiding pressure + routes."*

Add a contract test #22 asserting any `qb_weekly` row with pressure_rate != NULL has coverage ≥ 80% for that game.

### 2. HIGH — primary_starter fails on blowout benchings

**Critique:** "starter benched after 10 dropbacks, backup throws 11" → nobody hits 50%, contract test demands one, page renders empty.

**Verdict: ACCEPT.**

**Fix applied:** §3.6 rewritten. Rule:
- Compute dropback count per QB per game.
- **First tier:** QB with >50% of dropbacks is primary_starter.
- **Tiebreaker (nobody hits 50%):** QB with the most dropbacks is force-marked primary_starter.
- **Second-order tie (same dropbacks):** earliest passer in the game (first play with that QB as passer).

Deterministic. Every game has exactly one primary_starter. Contract test #17 updated to match.

### 3. MED — skill_weekly NULL vs 0 ambiguity

**Critique:** "target_share = targets / team_dropbacks means a pure rushing back gets 0.0, UI reads as saw-targets-but-none."

**Verdict: ACCEPT.**

**Fix applied:** §3.2 `skill_weekly` — stats that conceptually don't apply to a position emit NULL:
- RB: `target_share`, `adot_on_targets` remain applicable (RBs do get targeted).
- RB: `routes` NULL unless participation confirms (RBs run routes when they're not blocking).
- WR/TE: `ypc`, `carries`, `broken_tackles` remain applicable.
- Any player with 0 targets: `target_share = 0`, `adot_on_targets = NULL` (no air-yards sample).

Clearer rule: "0 = actually 0; NULL = not applicable or not measured."

### 4. MED — Mid-week trade PK hole

**Critique:** PK `(gsis_id, season, week, team)` doesn't cover a Tuesday trade + Thursday game — same week, same player, two teams.

**Verdict: ACCEPT.**

**Fix applied:** Re-key `qb_weekly` + `skill_weekly` on `(gsis_id, game_id, team)`. `season` and `week` become derived-from-games-join columns (still stored for query ergonomics).

Unique index: `(gsis_id, game_id)` since one player can only appear once per game. `team` stays in the row for the mid-week-trade derivation but isn't part of the PK.

DAL signatures add explicit `team?` filter:
- `getQbDeepDive(id, { season, primaryStarterOnly, team? })` — default includes all teams; caller opts into team filter.
- Contract test #18 updated: at most one qb_weekly row per (gsis_id, game_id).

### 5. MED — Defensive-phase top contributors feels like a cop-out

**Critique:** falling back to a generic "see team-level metrics" card for 7 of 12 phases undermines the sprint goal.

**Verdict: PARTIAL.**

**Fix applied:** §3.9 contributor table rewritten. Defensive phases now surface simple leaderboards where the data supports it:
- **pass_defense**: top 3 by `sack + qb_hit + pressures` (all in plays table).
- **run_defense**: top 3 by tackles on rushes (nflverse has `tackle_with_assist_*` + `solo_tackle_*`).
- **third_down_defense**: top 3 by defensive stops on 3rd down (aggregatable from plays).
- **redzone_defense**: top 3 by RZ stops.
- **special_teams**: top 3 returners/kickers by EPA.
- **explosive_defense**: top 3 by explosive plays allowed-to-team-assigned-defender (weaker signal — guard with caveat).

Caveat copy on each defensive contributor card: *"Based on nflverse solo-tackle + pressure data; no pass-coverage credit (SPEC §3.3 defers)."*

`getTopContributors` gets a `phaseKind: 'offense' | 'defense' | 'unit'` discriminant. `unit` kind is now only for special-teams phases that genuinely don't have a single contributor to credit (still gets the unit card fallback).

### 6. HIGH — Headshot URL pattern wrong

**Critique:** `/league/api/clubs/logos/{player_id}` is the club-logo endpoint. Every "headshot" would render a Patriots logo.

**Verdict: ACCEPT.** Embarrassing; good catch.

**Fix applied:** §3.10 rewritten. Drop the hardcoded URL pattern entirely. Instead:
- `players.headshot_url` populated from `nflreadpy.load_rosters()`'s `headshot_url` field (roster feed already has the correct URL for each player).
- ETL does a **one-time HEAD check** at ingest for the top-200 most-featured players (starters + 4th-quarter roster); if the URL 404s, stores NULL and the UI falls back to initials. Check is rate-limited to 5 req/sec.
- `next.config.ts` `images.remotePatterns` allowlists the CDN host (`static.www.nfl.com` already in CSP from E1).

### 7. MED — Storage sizing unproven

**Critique:** `plays` column additions waved away at "40 MB"; real delta is ~120 MB before indexes; combined with new rollup tables could push Neon Launch quota.

**Verdict: ACCEPT.**

**Fix applied:** Added §3.15 "Storage projection" to the plan:

| Table | Net delta |
|---|---|
| `plays` +7 cols (6 TEXT IDs avg 12 bytes + 2 names avg 20 bytes + 1 SMALLINT) | ~90 bytes/row × 295k rows = ~27 MB raw; +TOAST ~35 MB; +indexes ~30 MB = **~90 MB** |
| `players` | ~3000 rows × 150 bytes ≈ **<1 MB** |
| `qb_weekly` + `qb_season` | ~5k + ~200 rows ≈ **<2 MB** |
| `skill_weekly` + `skill_season` | ~25k + ~1.5k rows ≈ **~10 MB** |
| `team_unit_weekly` + `team_unit_season` | ~10k + ~600 rows ≈ **~3 MB** |
| **Total E4 delta** | **~105 MB** |

Current DB is ~450 MB post-E3; post-E4 ~555 MB. Neon Launch tier = 10 GB. Fine. Set Neon storage-monitor threshold to 2 GB alert.

### 8. MED — JSONB on team_unit_* loses type safety

**Critique:** Drizzle sees opaque `json`; first typo ships silently.

**Verdict: ACCEPT.**

**Fix applied:** §3.2 rewritten. Three typed tables instead of one JSONB blob:
- `team_defense_weekly` (team, season, week, pressure_rate, coverage_epa_allowed, run_stop_rate, explosive_plays_allowed)
- `team_ol_weekly` (team, season, week, pass_block_win_rate, run_block_rate, pressures_allowed, epa_on_dropbacks)
- `team_dl_weekly` (team, season, week, pressures_generated, pass_rush_win_rate, run_stop_rate, sack_rate)

3 extra tables but type-safe throughout the DAL. Accepted — E5 adding metrics to any unit is a normal schema migration.

### 9. MED — Round-trip budget violated

**Critique:** QB page does 7 queries once all splits + contributors load; budget says ≤5.

**Verdict: ACCEPT.**

**Fix applied:** §3.9 DAL refactor:
- **`getQbDeepDive`** returns the main rollup PLUS the clean-pocket split PLUS the deep-ball split in one query (server-side CTE aggregating all three from `qb_weekly` + `plays`).
- Drop `getCleanPocketSplit` and `getDeepBallSplit` as separate functions; folded in.
- Contributor queries are unique to the phase page, not the QB page, so QB page stays at 3 round-trips: `getCurrentSeason`, `getPlayer`, `getQbDeepDive`.
- Phase page (E3) keeps its 4 queries + 1 new `getTopContributors` = 5. Within budget.
- Avatars: `loading="lazy"` on `next/image` + `priority` only on above-fold (hero) avatar. Phase-page contributor avatars lazy-load.

### 10. HIGH — Empty-path webhook flushes 480 pages

**Critique:** A single weekly ETL run invalidates every pre-rendered player page; Vercel rebuild burst cost not budgeted.

**Verdict: ACCEPT.**

**Fix applied:** §3.12 rewritten:
- Switch from path-based to **tag-based revalidation** (now real — we deferred this in E3 since the path set was small).
- New tag scheme: `home`, `phase:<slug>` (12), `player:<gsis_id>`, `unit:<slug>` (3).
- ETL webhook specifies tags, not paths. Empty body = "flush all" is dropped; callers must enumerate intent.
- **Pre-rendering via `generateStaticParams` capped to current-season roster** (~50 players), not historical (480). Older-season player pages ISR-on-demand.
- Revalidation workflow specifies `player:<all-active-pats>` + `unit:defense|offensive-line|defensive-line` + phase tags for the current week. Historical pages revalidate on next cache miss within the 1hr TTL, no forced flush.

### 11. HIGH — Contract test #17 too strict

**Critique:** "every game has 1 primary_starter=true" fails on historical games where no QB crossed 50%.

**Verdict: ACCEPT.**

**Fix applied:** Contract test #17 rewritten: *"every game has at least one `qb_weekly` row, and exactly one has `primary_starter = true` after the deterministic tiebreaker rule in §3.6."* This is provable-by-construction given the rewritten primary_starter rule (#2) — every game gets a starter.

### 12. MED — Roster snapshot "most-recent season wins" breaks historical pages

**Critique:** 2020 Pats page shows current team/jersey; breadcrumb drift when a trade happens.

**Verdict: ACCEPT.**

**Fix applied:** §3.8 rewritten.
- Add new table `roster_snapshots` (gsis_id, season, team, jersey_number, position, headshot_url). One row per (player, season, team).
- `players` table retains the `current_*` fields for "right now" display.
- `getPlayer(gsisId, season?)` prefers `roster_snapshots` row for the requested season; falls back to `players.current_*` if missing.
- `getPlayer` used by header in QB/skill pages passes the rendered season's year so 2020 pages show the 2020 jersey + team.

---

## Summary

| # | Sev | Verdict | Finding |
|---|---|---|---|
| 1 | HIGH | ACCEPT | 80% participation-coverage gate + hide-module banner |
| 2 | HIGH | ACCEPT | primary_starter deterministic tiebreaker (max dropbacks → earliest passer) |
| 3 | MED | ACCEPT | skill_weekly: NULL = N/A, 0 = actually 0 |
| 4 | MED | ACCEPT | Re-key rollups on `(gsis_id, game_id, team)` for mid-week trades |
| 5 | MED | PARTIAL | Defensive-phase leaderboards where data supports; caveat copy |
| 6 | HIGH | ACCEPT | Trust roster-provided `headshot_url`; ingest-time HEAD check |
| 7 | MED | ACCEPT | Storage projection documented (~105 MB total, well under Neon Launch) |
| 8 | MED | ACCEPT | Three typed unit tables instead of JSONB blob |
| 9 | MED | ACCEPT | Fold splits into `getQbDeepDive` CTE; lazy-load avatars |
| 10 | HIGH | ACCEPT | Tag-based revalidation + cap pre-render to current-season roster |
| 11 | HIGH | ACCEPT | Contract test #17 aligned with deterministic starter rule |
| 12 | MED | ACCEPT | `roster_snapshots` table for per-season identity |

**Plan delta:** 11 accepts + 1 partial. Net new work: ~6 hours spread across ETL (#1, #2, #4, #6, #8, #12), DAL (#9), and revalidation (#10).

**New beads tasks:**
- `E4-00a` — Participation ingest + `plays` player-ID columns (was already noted in §8)
- `E4-00b` — Tag-based revalidation + roster_snapshots table (findings #10 + #12)

Plan updated to v2 in a follow-on edit.
