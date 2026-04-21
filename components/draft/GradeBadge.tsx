import type { Grade } from '@/lib/logic/draft-grade';

type Props = {
  grade: Grade;
  unitProxy?: boolean;
};

// Grade color follows DESIGN.md: --positive amber for HIT, --text for
// FAIR/PENDING (neutral), --negative cranberry for MISS. The "unit-proxy"
// modifier is rendered as a small superscript asterisk so the user can
// tell that OL/DL/LB/DB grades come from a cruder methodology.
export function GradeBadge({ grade, unitProxy }: Props) {
  const base =
    'inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-2xs uppercase tracking-widest';
  // MISS uses --text inside the badge: the --negative cranberry on
  // --surface sits at 2.59:1 (below WCAG AA 4.5:1). The border-negative
  // on the pill carries the color signal; the word "MISS" stays in bone.
  // Same pattern as numeric.tsx for delta glyphs.
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
