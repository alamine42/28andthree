import type { CoachSegmentWithRollup } from '@/lib/data/coaching';

type Props = {
  segments: ReadonlyArray<CoachSegmentWithRollup>;
};

// Shows the coordinator banner(s) at the top of /coaching. When two segments
// exist for the same role (mid-season change), they render side by side.
export function CoachSegmentBanner({ segments }: Props) {
  const byRole = new Map<'HC' | 'OC' | 'DC', CoachSegmentWithRollup[]>();
  for (const s of segments) {
    const list = byRole.get(s.role) ?? [];
    list.push(s);
    byRole.set(s.role, list);
  }

  return (
    <div className="flex flex-col gap-1" data-testid="coach-segment-banner">
      {(['HC', 'OC', 'DC'] as const).map((role) => {
        const list = byRole.get(role);
        if (!list || list.length === 0) return null;
        return (
          <div
            key={role}
            className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border pb-1"
          >
            {list.map((s, i) => (
              <span
                key={`${role}-${i}`}
                data-testid={`coach-segment-${role.toLowerCase()}-${i}`}
                className="font-mono text-2xs uppercase tracking-widest text-text-muted"
              >
                <time className="text-text-muted">
                  Weeks {s.weekStart}
                  {s.weekEnd !== s.weekStart ? `–${s.weekEnd}` : ''}
                </time>
                {' · '}
                <span className="text-text">{s.coachName}</span>
                {' ('}
                {role}
                {')'}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
