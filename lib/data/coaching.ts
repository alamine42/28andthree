import { and, asc, eq } from 'drizzle-orm';
import { coachingTendenciesWeekly } from '@/db/schema';
import { getDb } from '@/lib/db';
import {
  type CoachRole,
  type CoachSegment,
  computeCoachSegments,
  type WeeklyCoachRow,
} from '@/lib/logic/coach-segments';

export type TendencyRollup = {
  passRate1Short: number | null;
  passRate1Mid: number | null;
  passRate1Long: number | null;
  passRate2Short: number | null;
  passRate2Mid: number | null;
  passRate2Long: number | null;
  passRate3Short: number | null;
  passRate3Mid: number | null;
  passRate3Long: number | null;
  shotgunRate: number | null;
  playActionRate: number | null;
  motionRate: number | null;
  noHuddleRate: number | null;
  scoreLeadingBigPassRate: number | null;
  scoreLeadingSmallPassRate: number | null;
  scoreTiedPassRate: number | null;
  scoreTrailingSmallPassRate: number | null;
  scoreTrailingBigPassRate: number | null;
  secondsPerSnap: number | null;
  personnelTopGroups: Array<{ grouping: string; share: number }>;
  blitzRate: number | null;
};

export type CoachSegmentWithRollup = CoachSegment & { rollup: TendencyRollup };

export type FourthDownDecision = {
  week: number;
  wpBoostGo: number;
  wentForIt: boolean;
  goRecommended: boolean;
  resultYards: number | null;
};

/** Compute read-time coordinator segments for a given team/season.
 *
 *  One segment per (role, continuous coach identity). When a coordinator
 *  changes mid-season, the role produces two segments.
 */
export async function getCoachSegments(
  team: string,
  season: number,
): Promise<CoachSegmentWithRollup[]> {
  const db = getDb();
  if (!db) return [];

  let rows: Array<typeof coachingTendenciesWeekly.$inferSelect> = [];
  try {
    rows = await db
      .select()
      .from(coachingTendenciesWeekly)
      .where(
        and(
          eq(coachingTendenciesWeekly.team, team),
          eq(coachingTendenciesWeekly.season, season),
        ),
      )
      .orderBy(asc(coachingTendenciesWeekly.week));
  } catch (err) {
    // Pre-E5 migration: table doesn't exist yet. Render empty state.
    if (isMissingTableError(err)) return [];
    throw err;
  }

  if (rows.length === 0) return [];

  const weeklyRows: WeeklyCoachRow[] = rows.map((r) => ({
    week: r.week,
    coachRole: r.coachRole as CoachRole,
    coachId: r.coachId,
    coachName: r.coachName,
  }));

  const segments = computeCoachSegments(weeklyRows);

  // Enrich with rollup averages across the segment's weeks.
  return segments.map((s): CoachSegmentWithRollup => {
    const segmentRows = rows.filter(
      (r) =>
        r.coachRole === s.role && r.week >= s.weekStart && r.week <= s.weekEnd,
    );
    return { ...s, rollup: averageRollup(segmentRows) };
  });
}

export async function getFourthDownDecisions(
  team: string,
  season: number,
): Promise<FourthDownDecision[]> {
  const db = getDb();
  if (!db) return [];

  // Pick the HC row (by convention, HC weekly rows carry the 4th-down payload).
  let rows: Array<{ payload: unknown }> = [];
  try {
    rows = await db
      .select({ payload: coachingTendenciesWeekly.fourthDownDecisions })
      .from(coachingTendenciesWeekly)
      .where(
        and(
          eq(coachingTendenciesWeekly.team, team),
          eq(coachingTendenciesWeekly.season, season),
          eq(coachingTendenciesWeekly.coachRole, 'HC'),
        ),
      );
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }

  const out: FourthDownDecision[] = [];
  for (const r of rows) {
    if (!r.payload || !Array.isArray(r.payload)) continue;
    for (const d of r.payload) {
      if (!isFourthDownDecision(d)) continue;
      out.push({
        week: d.week,
        wpBoostGo: d.wpBoostGo,
        wentForIt: d.wentForIt,
        goRecommended: d.goRecommended,
        resultYards: d.resultYards ?? null,
      });
    }
  }
  return out;
}

// ---- Internals -------------------------------------------------------------

function averageRollup(rows: Array<typeof coachingTendenciesWeekly.$inferSelect>): TendencyRollup {
  const out: TendencyRollup = {
    passRate1Short: mean(rows, 'passRate1Short'),
    passRate1Mid: mean(rows, 'passRate1Mid'),
    passRate1Long: mean(rows, 'passRate1Long'),
    passRate2Short: mean(rows, 'passRate2Short'),
    passRate2Mid: mean(rows, 'passRate2Mid'),
    passRate2Long: mean(rows, 'passRate2Long'),
    passRate3Short: mean(rows, 'passRate3Short'),
    passRate3Mid: mean(rows, 'passRate3Mid'),
    passRate3Long: mean(rows, 'passRate3Long'),
    shotgunRate: mean(rows, 'shotgunRate'),
    playActionRate: mean(rows, 'playActionRate'),
    motionRate: mean(rows, 'motionRate'),
    noHuddleRate: mean(rows, 'noHuddleRate'),
    scoreLeadingBigPassRate: mean(rows, 'scoreLeadingBigPassRate'),
    scoreLeadingSmallPassRate: mean(rows, 'scoreLeadingSmallPassRate'),
    scoreTiedPassRate: mean(rows, 'scoreTiedPassRate'),
    scoreTrailingSmallPassRate: mean(rows, 'scoreTrailingSmallPassRate'),
    scoreTrailingBigPassRate: mean(rows, 'scoreTrailingBigPassRate'),
    secondsPerSnap: mean(rows, 'secondsPerSnap'),
    personnelTopGroups: mergePersonnel(rows),
    blitzRate: mean(rows, 'blitzRate'),
  };
  return out;
}

function mean<K extends keyof (typeof coachingTendenciesWeekly.$inferSelect)>(
  rows: Array<typeof coachingTendenciesWeekly.$inferSelect>,
  key: K,
): number | null {
  const nums = rows
    .map((r) => r[key] as number | null)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function mergePersonnel(
  rows: Array<typeof coachingTendenciesWeekly.$inferSelect>,
): Array<{ grouping: string; share: number }> {
  const totals = new Map<string, number>();
  let weeks = 0;
  for (const r of rows) {
    const groups = r.personnelTopGroups;
    if (!Array.isArray(groups)) continue;
    weeks++;
    for (const g of groups) {
      if (isPersonnel(g)) totals.set(g.grouping, (totals.get(g.grouping) ?? 0) + g.share);
    }
  }
  if (weeks === 0) return [];
  return Array.from(totals.entries())
    .map(([grouping, sum]) => ({ grouping, share: sum / weeks }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 5);
}

function isPersonnel(v: unknown): v is { grouping: string; share: number } {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { grouping?: unknown }).grouping === 'string' &&
    typeof (v as { share?: unknown }).share === 'number'
  );
}

function isFourthDownDecision(v: unknown): v is {
  week: number;
  wpBoostGo: number;
  wentForIt: boolean;
  goRecommended: boolean;
  resultYards?: number | null;
} {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.week === 'number' &&
    typeof o.wpBoostGo === 'number' &&
    typeof o.wentForIt === 'boolean' &&
    typeof o.goRecommended === 'boolean'
  );
}

function isMissingTableError(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  const e = err as { code?: unknown; cause?: unknown };
  if (typeof e.code === 'string' && e.code === '42P01') return true;
  if (e.cause && typeof e.cause === 'object') {
    const c = e.cause as { code?: unknown };
    if (typeof c.code === 'string' && c.code === '42P01') return true;
  }
  return false;
}
