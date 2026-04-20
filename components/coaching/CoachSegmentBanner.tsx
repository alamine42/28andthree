import type { CoachSegmentWithRollup } from '@/lib/data/coaching';

type Props = {
  segments: ReadonlyArray<CoachSegmentWithRollup>;
};

type Role = 'HC' | 'OC' | 'DC';
const ROLES: readonly Role[] = ['HC', 'OC', 'DC'] as const;

const ROLE_LABEL: Record<Role, string> = {
  HC: 'Head coach',
  OC: 'Offensive coordinator',
  DC: 'Defensive coordinator',
};

// Three-card coordinator strip. Each card anchors the role (HC / OC / DC),
// names the current coach, and enumerates mid-season tenure chips when the
// role has more than one segment. Hairline-gap grid mirrors HeroStats so the
// visual language is consistent across team pages.
export function CoachSegmentBanner({ segments }: Props) {
  const byRole = new Map<Role, CoachSegmentWithRollup[]>();
  for (const s of segments) {
    if (!isRole(s.role)) continue;
    const list = byRole.get(s.role) ?? [];
    list.push(s);
    byRole.set(s.role, list);
  }

  return (
    <div
      data-testid="coach-segment-banner"
      className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-3"
    >
      {ROLES.map((role) => {
        const list = [...(byRole.get(role) ?? [])].sort(
          (a, b) => a.weekStart - b.weekStart,
        );
        return <CoachCard key={role} role={role} segments={list} />;
      })}
    </div>
  );
}

function CoachCard({
  role,
  segments,
}: {
  role: Role;
  segments: CoachSegmentWithRollup[];
}) {
  const primary = segments[segments.length - 1];
  const changed = segments.length > 1;
  return (
    <div
      data-testid={`coach-card-${role.toLowerCase()}`}
      className="flex flex-col gap-3 bg-bg p-5 md:p-6"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          {ROLE_LABEL[role]}
        </p>
        {changed ? (
          <span
            className="inline-flex items-center rounded-sm border border-positive-dim px-1.5 py-0.5 font-mono text-2xs uppercase tracking-widest text-positive"
            title="Mid-season coaching change — tendency rows split per §3.5a"
          >
            changed
          </span>
        ) : null}
      </div>

      {primary ? (
        <>
          <p className="font-display text-xl font-bold leading-tight tracking-tightest text-text md:text-2xl">
            {primary.coachName}
          </p>
          <ul className="flex flex-col gap-1.5">
            {segments.map((s, i) => (
              <li
                key={`${role}-${s.coachId ?? s.coachName}-${s.weekStart}`}
                data-testid={`coach-segment-${role.toLowerCase()}-${i}`}
                className="flex items-baseline justify-between gap-2 font-mono text-2xs uppercase tracking-widest"
              >
                <span className={i === segments.length - 1 ? 'text-text' : 'text-text-muted'}>
                  {s.coachName}
                </span>
                <span className="text-text-muted">
                  WK {s.weekStart}
                  {s.weekEnd !== s.weekStart ? `\u2013${s.weekEnd}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          No data
        </p>
      )}
    </div>
  );
}

function isRole(r: string): r is Role {
  return r === 'HC' || r === 'OC' || r === 'DC';
}
