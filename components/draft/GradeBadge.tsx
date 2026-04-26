import type { Grade } from '@/lib/logic/draft-grade';

type Props = {
  grade: Grade;
  unitProxy?: boolean;
};

// Grade color follows DESIGN.md: --positive green for HIT, --text for
// FAIR/PENDING (neutral), --negative cranberry for MISS. The "unit-proxy"
// modifier is rendered as a small superscript asterisk so the user can
// tell that OL/DL/LB/DB grades come from a cruder methodology.
export function GradeBadge({ grade, unitProxy }: Props) {
  const base =
    'inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-2xs uppercase tracking-widest';
  // MISS keeps --text inside the badge even though --negative now clears
  // AA (5.28:1 on --surface after the 2026-04-26 lightening — see
  // DESIGN.md Decisions Log). The border carries the color signal; the
  // word stays in bone for symmetry with the FAIR/PENDING pills.
  const tier =
    grade === 'HIT'
      ? 'border-positive bg-surface text-positive'
      : grade === 'MISS'
        ? 'border-negative bg-surface text-text'
        : 'border-border bg-surface text-text-muted';
  return (
    <span className={`${base} ${tier}`} data-testid={`grade-${grade.toLowerCase()}`}>
      {grade}
      {unitProxy ? (
        <sup
          className="ml-0.5 text-[0.6em]"
          title="Unit-proxy: grade based on the team unit's league rank during the player's active seasons, not per-play attribution."
        >
          *
        </sup>
      ) : null}
    </span>
  );
}
