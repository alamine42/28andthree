// Coordinator-change segmentation (plan §3.5).
//
// Scans weekly rows per role; closes + opens a segment whenever the coach
// identity changes. Identity keyed by coach_id first; falls back to a
// normalized coach_name comparison when coach_id is null, to survive feed
// drift like "Alex Van Pelt" vs "Alex VanPelt" (review finding #9).

export type CoachRole = 'HC' | 'OC' | 'DC';

export type WeeklyCoachRow = {
  week: number;
  coachRole: CoachRole;
  coachId: string | null;
  coachName: string;
};

export type CoachSegment = {
  role: CoachRole;
  coachId: string | null;
  coachName: string;
  weekStart: number;
  weekEnd: number;
};

export function computeCoachSegments(rows: ReadonlyArray<WeeklyCoachRow>): CoachSegment[] {
  if (rows.length === 0) return [];

  const byRole = new Map<CoachRole, WeeklyCoachRow[]>();
  for (const row of rows) {
    const bucket = byRole.get(row.coachRole) ?? [];
    bucket.push(row);
    byRole.set(row.coachRole, bucket);
  }

  const segments: CoachSegment[] = [];
  for (const [role, group] of byRole) {
    group.sort((a, b) => a.week - b.week);

    let current: CoachSegment | null = null;
    for (const row of group) {
      if (current === null || !sameCoach(current, row)) {
        if (current !== null) segments.push(current);
        current = {
          role,
          coachId: row.coachId,
          coachName: row.coachName,
          weekStart: row.week,
          weekEnd: row.week,
        };
      } else {
        current.weekEnd = row.week;
        // Adopt a non-null coachId if the new row finally has one — keeps
        // the segment's id populated after a mid-stretch feed correction.
        if (current.coachId === null && row.coachId !== null) current.coachId = row.coachId;
      }
    }
    if (current !== null) segments.push(current);
  }

  return segments;
}

// Two rows represent the same coach when their ids match, OR — when an id
// is missing — their normalized display names match.
function sameCoach(segment: CoachSegment, row: WeeklyCoachRow): boolean {
  if (segment.coachId !== null && row.coachId !== null) {
    return segment.coachId === row.coachId;
  }
  return normalizeName(segment.coachName) === normalizeName(row.coachName);
}

// Aggressive normalization: lowercase, drop punctuation + all whitespace so
// "Alex Van Pelt" / "alex van pelt" / "Alex VanPelt" / "A. Van Pelt" all
// collapse to the same key. Acceptable false-positive surface is tiny
// because two coaches who only differ by spacing would be a naming
// clash we'd hit regardless.
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s.\-']/g, '');
}
