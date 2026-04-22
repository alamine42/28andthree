import { asc, eq, sql } from 'drizzle-orm';
import { draftPicks, draftExpectedValue, skillSeason, qbSeason } from '@/db/schema';
import { getDb } from '@/lib/db';
import { bucketForPosition } from '@/lib/format/position-bucket';
import { type Grade, gradePick } from '@/lib/logic/draft-grade';
import { isSandbox } from '@/lib/sandbox';

export type DraftRoiRow = {
  draftSeason: number;
  round: number;
  pickOverall: number;
  gsisId: string | null;
  displayName: string | null;
  position: string | null;
  tradedTo: string | null;
  actualValue: number | null;
  expectedValue: number | null;
  grade: Grade;
};

export type DraftClassSummary = {
  hit: number;
  fair: number;
  miss: number;
  pending: number;
};

/** Pats picks for a given draft class, enriched with slot-EV + actual value
 *  + computed grade. Empty array when the draft tables haven't been
 *  populated yet — pages render an empty-state callout. */
export async function getDraftRoiByClass(
  draftSeason: number,
  currentSeason: number,
): Promise<DraftRoiRow[]> {
  if (isSandbox()) {
    const stub = await import('@/lib/sandbox/stubs/draft');
    return stub.getDraftRoiByClass(draftSeason, currentSeason);
  }
  const db = getDb();
  if (!db) return [];

  // Tolerate missing tables: before the E5 migration lands, the DB has no
  // draft_* tables. Return [] so the page renders its empty-state copy
  // rather than crashing the build.
  let picks: Array<typeof draftPicks.$inferSelect> = [];
  try {
    picks = await db
      .select()
      .from(draftPicks)
      .where(eq(draftPicks.draftSeason, draftSeason))
      .orderBy(asc(draftPicks.pickOverall));
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }

  if (picks.length === 0) return [];

  const gsisIds = picks.map((p) => p.gsisId).filter((g): g is string => g !== null);
  const [actualValues, expectedValues] = await Promise.all([
    fetchActualValues(gsisIds),
    fetchExpectedValues(picks.map((p) => ({ pickOverall: p.pickOverall, position: p.position }))),
  ]);

  return picks.map((p): DraftRoiRow => {
    const bucket = bucketForPosition(p.position);
    const expected = bucket ? expectedValues.get(`${p.pickOverall}:${bucket}`) ?? null : null;
    const actual = p.gsisId ? actualValues.get(p.gsisId) ?? null : null;
    const grade = gradePick({
      gsisId: p.gsisId,
      draftSeason: p.draftSeason,
      positionBucket: bucket ?? 'ST',
      actualValue: actual,
      expectedValue: expected,
      currentSeason,
    });
    return {
      draftSeason: p.draftSeason,
      round: p.round,
      pickOverall: p.pickOverall,
      gsisId: p.gsisId,
      displayName: p.playerName,
      position: p.position,
      tradedTo: p.tradedTo,
      actualValue: actual,
      expectedValue: expected,
      grade,
    };
  });
}

// ---- Internals -------------------------------------------------------------

async function fetchActualValues(gsisIds: string[]): Promise<Map<string, number>> {
  const db = getDb();
  const out = new Map<string, number>();
  if (!db || gsisIds.length === 0) return out;

  // QB: sum(epa_per_dropback × dropbacks) across all seasons on record.
  try {
    const qbRows = await db
      .select({
        gsisId: qbSeason.gsisId,
        v: sql<number>`COALESCE(SUM(${qbSeason.epaPerDropback} * ${qbSeason.dropbacks}), 0)::double precision`,
      })
      .from(qbSeason)
      .where(inList(qbSeason.gsisId, gsisIds))
      .groupBy(qbSeason.gsisId);
    for (const r of qbRows) out.set(r.gsisId, r.v);
  } catch (err) {
    if (!isMissingColumnError(err) && !isMissingTableError(err)) throw err;
  }

  // Skill: sum of (epa_receiving + epa_rushing) across seasons. NULL-safe.
  try {
    const skillRows = await db
      .select({
        gsisId: skillSeason.gsisId,
        v: sql<number>`COALESCE(SUM(COALESCE(${skillSeason.epaReceiving}, 0) + COALESCE(${skillSeason.epaRushing}, 0)), 0)::double precision`,
      })
      .from(skillSeason)
      .where(inList(skillSeason.gsisId, gsisIds))
      .groupBy(skillSeason.gsisId);
    for (const r of skillRows) {
      // Skill and QB shouldn't overlap on gsisId, but the guard is cheap.
      if (!out.has(r.gsisId)) out.set(r.gsisId, r.v);
    }
  } catch (err) {
    // epa_receiving / epa_rushing columns don't exist pre-E5 migration.
    if (!isMissingColumnError(err) && !isMissingTableError(err)) throw err;
  }

  return out;
}

async function fetchExpectedValues(
  picks: Array<{ pickOverall: number; position: string | null }>,
): Promise<Map<string, number>> {
  const db = getDb();
  const out = new Map<string, number>();
  if (!db || picks.length === 0) return out;

  const slots = Array.from(new Set(picks.map((p) => p.pickOverall)));
  try {
    const rows = await db
      .select()
      .from(draftExpectedValue)
      .where(inList(draftExpectedValue.pickOverall, slots));
    for (const r of rows) out.set(`${r.pickOverall}:${r.positionBucket}`, r.expectedValue);
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }
  return out;
}

// Postgres error codes 42P01 (undefined_table) + 42703 (undefined_column)
// identify the pre-migration state. We swallow these specifically so the
// app renders empty states instead of 500-ing; any other error bubbles up.
function isMissingTableError(err: unknown): boolean {
  return isPgError(err, '42P01');
}

function isMissingColumnError(err: unknown): boolean {
  return isPgError(err, '42703');
}

function isPgError(err: unknown, code: string): boolean {
  if (err === null || typeof err !== 'object') return false;
  const e = err as { code?: unknown; cause?: unknown };
  if (typeof e.code === 'string' && e.code === code) return true;
  // psycopg / node-postgres sometimes nest the PG error under `cause`.
  if (e.cause && typeof e.cause === 'object') {
    const c = e.cause as { code?: unknown };
    if (typeof c.code === 'string' && c.code === code) return true;
  }
  return false;
}

// Tiny helper for WHERE col IN (…) across the drizzle select() API.
// drizzle's `inArray` would work, but we avoid importing yet another helper
// from deep paths — one-call sql tag is clear.
function inList<T>(column: T, values: (string | number)[]) {
  return sql`${column} IN (${sql.raw(values.map((v) => (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)).join(','))})`;
}
