import { and, desc, eq, sql } from 'drizzle-orm';
import type { Phase } from '@/lib/constants/phases';
import { games, players, qbSeason, skillSeason } from '@/db/schema';
import { getDb } from '@/lib/db';
import { isSandbox } from '@/lib/sandbox';

export type ContributorCard = {
  gsisId: string;
  displayName: string;
  position: string | null;
  headshotUrl: string | null;
  primaryStat: string;
  primaryStatLabel: string;
  role: 'qb' | 'skill' | 'unit' | 'defender';
  // E4-follow (39d.19): per SPEC §3.3, defender cards built from nflverse
  // participation arrays carry a caveat — no individual pass-coverage
  // credit. UI renders this under the card.
  caveat?: string;
};

// Caveat copy for defender contributor cards. Same string used by every
// defensive phase per SPEC §3.3.
const DEFENDER_CAVEAT =
  'Based on nflverse participation data; no pass-coverage credit ' +
  '(individual ratings deferred per methodology).';

/** Return top N contributors for a phase. Offensive phases have named
 * players (QB or skill). Defensive + special-teams phases fall back to a
 * single unit card that links to /team/units/<slug>. Review finding #5. */
export async function getTopContributors(
  phase: Phase,
  team: string,
  season: number,
  limit = 3,
): Promise<ContributorCard[]> {
  if (isSandbox()) {
    const stub = await import('@/lib/sandbox/stubs/contributors');
    return stub.getTopContributors(phase, team, season, limit);
  }
  const db = getDb();
  if (!db) return [];

  switch (phase) {
    case 'pass_offense':
    case 'third_down_offense':
    case 'overall':
      return topQbs(db, team, season, limit);
    case 'rush_offense':
      return topRushers(db, team, season, limit);
    case 'redzone_offense':
    case 'explosive_offense':
      return topReceivers(db, team, season, limit, phase === 'redzone_offense');
    case 'pass_defense':
    case 'run_defense':
    case 'redzone_defense':
    case 'third_down_defense':
    case 'explosive_defense':
      return topDefenders(db, phase, team, season, limit);
    case 'special_teams':
    default:
      // Special teams: nflverse participation doesn't credit ST defenders
      // reliably enough to leaderboard. Stay on unit fallback.
      return unitFallback(phase);
  }
}

type DbClient = NonNullable<ReturnType<typeof getDb>>;

async function topQbs(
  db: DbClient,
  team: string,
  season: number,
  limit: number,
): Promise<ContributorCard[]> {
  const rows = await db
    .select({
      gsisId: qbSeason.gsisId,
      dropbacks: qbSeason.dropbacks,
      epa: qbSeason.epaPerDropback,
      displayName: players.displayName,
      position: players.position,
      headshotUrl: players.headshotUrl,
    })
    .from(qbSeason)
    .innerJoin(players, eq(players.gsisId, qbSeason.gsisId))
    .where(and(eq(qbSeason.team, team), eq(qbSeason.season, season)))
    .orderBy(desc(qbSeason.dropbacks))
    .limit(limit);

  return rows.map((r) => ({
    gsisId: r.gsisId,
    displayName: r.displayName,
    position: r.position,
    headshotUrl: r.headshotUrl,
    primaryStat: r.epa != null ? `${r.epa >= 0 ? '+' : '−'}${Math.abs(r.epa).toFixed(2)}` : '—',
    primaryStatLabel: 'EPA/dropback',
    role: 'qb',
  }));
}

async function topRushers(
  db: DbClient,
  team: string,
  season: number,
  limit: number,
): Promise<ContributorCard[]> {
  const rows = await db
    .select({
      gsisId: skillSeason.gsisId,
      carries: skillSeason.carries,
      ypc: skillSeason.ypc,
      displayName: players.displayName,
      position: players.position,
      headshotUrl: players.headshotUrl,
    })
    .from(skillSeason)
    .innerJoin(players, eq(players.gsisId, skillSeason.gsisId))
    .where(and(
      eq(skillSeason.team, team),
      eq(skillSeason.season, season),
      sql`${skillSeason.carries} IS NOT NULL AND ${skillSeason.carries} > 0`,
    ))
    .orderBy(desc(skillSeason.carries))
    .limit(limit);

  return rows.map((r) => ({
    gsisId: r.gsisId,
    displayName: r.displayName,
    position: r.position,
    headshotUrl: r.headshotUrl,
    primaryStat: r.ypc != null ? r.ypc.toFixed(1) + ' ypc' : '—',
    primaryStatLabel: `${r.carries} carries`,
    role: 'skill',
  }));
}

async function topReceivers(
  db: DbClient,
  team: string,
  season: number,
  limit: number,
  redzone: boolean,
): Promise<ContributorCard[]> {
  const orderCol = redzone ? skillSeason.redzoneTargets : skillSeason.targets;
  const rows = await db
    .select({
      gsisId: skillSeason.gsisId,
      targets: skillSeason.targets,
      targetShare: skillSeason.targetShare,
      redzoneTargets: skillSeason.redzoneTargets,
      displayName: players.displayName,
      position: players.position,
      headshotUrl: players.headshotUrl,
    })
    .from(skillSeason)
    .innerJoin(players, eq(players.gsisId, skillSeason.gsisId))
    .where(and(
      eq(skillSeason.team, team),
      eq(skillSeason.season, season),
      sql`${orderCol} IS NOT NULL AND ${orderCol} > 0`,
    ))
    .orderBy(desc(orderCol))
    .limit(limit);

  return rows.map((r) => ({
    gsisId: r.gsisId,
    displayName: r.displayName,
    position: r.position,
    headshotUrl: r.headshotUrl,
    primaryStat: redzone
      ? `${r.redzoneTargets ?? '—'} RZ targets`
      : r.targetShare != null ? Math.round(r.targetShare * 100) + '%' : '—',
    primaryStatLabel: redzone ? 'Red-zone usage' : 'Target share',
    role: 'skill',
  }));
}

// ---- Defender leaderboards (E4-follow / 39d.19) ----------------------------
//
// Built from `plays.defense_players` participation arrays joined to the
// existing per-play features. Per phase:
//
//   pass_defense        — sacks + pressures (qb_dropback plays only)
//   run_defense         — credit on rush stops at or behind LOS (yards_gained ≤ 1)
//   third_down_defense  — defenders on stops (down=3, opp didn't gain ydstogo)
//   redzone_defense     — defenders on plays where defense limited the drive
//                         (yardline_100 ≤ 20, no TD)
//   explosive_defense   — defenders on plays where the offense WAS NOT
//                         explosive (negative-credit framing — "kept it small")
//
// A "stop" credit goes to every defender on the field for the qualifying
// play; coverage credit is explicitly off-limits per SPEC §3.3 (the
// caveat copy on each card spells this out).
//
// Falls back to unit card when:
//   - participation_coverage < 0.80 across the team-season (low-tag games)
//   - no qualifying plays found (early-season backfill state)
//
// The query unnests defense_players + groups by gsis_id, filters for the
// team-season, and uses participation_coverage on `games` to gate.

const PARTICIPATION_COVERAGE_FLOOR = 0.8;

async function topDefenders(
  db: DbClient,
  phase: Phase,
  team: string,
  season: number,
  limit: number,
): Promise<ContributorCard[]> {
  const phaseFilter = defensivePhaseFilter(phase);
  if (!phaseFilter) return unitFallback(phase);

  // sql.raw is safe here because phaseFilter is built from a hardcoded
  // switch on `Phase` (closed enum), not user input.
  let list: Array<{
    gsisId: string;
    displayName: string | null;
    position: string | null;
    headshotUrl: string | null;
    n: number;
  }> = [];
  try {
    const rows = await db.execute<{
      gsisId: string;
      displayName: string | null;
      position: string | null;
      headshotUrl: string | null;
      n: number;
    }>(sql`
      SELECT
        defender AS "gsisId",
        pl.display_name AS "displayName",
        pl.position AS "position",
        pl.headshot_url AS "headshotUrl",
        COUNT(*)::int AS n
      FROM plays p
      JOIN ${games} g ON g.game_id = p.game_id
      CROSS JOIN LATERAL UNNEST(p.defense_players) AS defender
      LEFT JOIN ${players} pl ON pl.gsis_id = defender
      WHERE p.season = ${season}
        AND p.season_type = 'REG'
        AND p.defteam = ${team}
        AND p.defense_players IS NOT NULL
        AND COALESCE(g.participation_coverage, 0) >= ${PARTICIPATION_COVERAGE_FLOOR}
        AND ${sql.raw(phaseFilter)}
      GROUP BY defender, pl.display_name, pl.position, pl.headshot_url
      ORDER BY n DESC
      LIMIT ${limit}
    `);
    list = (rows.rows ?? rows) as typeof list;
  } catch (err) {
    // 42703 = undefined_column. Hit when the migration adding
    // defense_players hasn't been applied yet — render the unit-card
    // fallback so build/SSG succeeds. Same pattern as draft.ts.
    if (isMissingColumnError(err)) return unitFallback(phase);
    throw err;
  }
  if (list.length === 0) return unitFallback(phase);

  return list.map(
    (r): ContributorCard => ({
      gsisId: r.gsisId,
      displayName: r.displayName ?? r.gsisId,
      position: r.position,
      headshotUrl: r.headshotUrl,
      primaryStat: String(r.n),
      primaryStatLabel: defenderStatLabel(phase),
      role: 'defender',
      caveat: DEFENDER_CAVEAT,
    }),
  );
}

function defensivePhaseFilter(phase: Phase): string | null {
  // Per-phase predicate over `plays p`. Mirrors phase-aggregation conventions
  // from the ETL. Each filter targets the play *types* the defense gets
  // credit for; the unnest above attributes every defender on the field.
  switch (phase) {
    case 'pass_defense':
      // Sacks + pressures on dropbacks.
      return `
        p.qb_dropback = true
        AND COALESCE(p.qb_kneel, false) = false
        AND COALESCE(p.qb_spike, false) = false
        AND (p.sack = true OR p.was_pressure = true)
      `;
    case 'run_defense':
      // Rush stops at or behind the LOS.
      return `
        p.rush_attempt = true
        AND p.yards_gained IS NOT NULL
        AND p.yards_gained <= 1
      `;
    case 'third_down_defense':
      // 3rd-down stops: down=3, gained < ydstogo.
      return `
        p.down = 3
        AND p.ydstogo IS NOT NULL
        AND p.yards_gained IS NOT NULL
        AND p.yards_gained < p.ydstogo
      `;
    case 'redzone_defense':
      // Plays in the red zone (no separate "stop" filter — being on the
      // field for opp red-zone snaps is the credit unit).
      return `
        p.yardline_100 IS NOT NULL
        AND p.yardline_100 <= 20
      `;
    case 'explosive_defense':
      // Defense kept the offense in check (no explosive play).
      return `
        (p.pass_attempt = true OR p.rush_attempt = true)
        AND COALESCE(p.is_explosive_pass, false) = false
        AND COALESCE(p.is_explosive_run, false) = false
      `;
    default:
      return null;
  }
}

function defenderStatLabel(phase: Phase): string {
  switch (phase) {
    case 'pass_defense':
      return 'Sacks + pressures';
    case 'run_defense':
      return 'Stops at/behind LOS';
    case 'third_down_defense':
      return '3rd-down stops';
    case 'redzone_defense':
      return 'Red-zone snaps';
    case 'explosive_defense':
      return 'Snaps without an explosive';
    default:
      return 'Snaps';
  }
}

function isMissingColumnError(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  const e = err as { code?: unknown; cause?: unknown };
  if (typeof e.code === 'string' && e.code === '42703') return true;
  if (e.cause && typeof e.cause === 'object') {
    const c = e.cause as { code?: unknown };
    if (typeof c.code === 'string' && c.code === '42703') return true;
  }
  return false;
}

function unitFallback(_phase: Phase): ContributorCard[] {
  // Single synthetic "card" that the phase page renders as a link to the
  // unit. Keeps phase pages visually balanced even when we can't credit
  // individual defenders (SPEC §3.3).
  return [
    {
      gsisId: '',
      displayName: 'Unit metrics',
      position: null,
      headshotUrl: null,
      primaryStat: 'See team page →',
      primaryStatLabel: 'Defensive unit',
      role: 'unit',
    },
  ];
}
