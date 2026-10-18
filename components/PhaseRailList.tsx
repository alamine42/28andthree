import Link from 'next/link';
import type { Route } from 'next';
import { MetricValue } from '@/components/numeric';
import { rankTier } from '@/lib/color/rank';
import { PHASES, type Phase } from '@/lib/constants/phases';
import type { PhaseSnapshot } from '@/lib/data/phases';
import { formatRank } from '@/lib/format/number';
import { phaseDisplayName } from '@/lib/format/phase';
import { withSeason } from '@/lib/season-view';

type Props = {
  snapshot: ReadonlyArray<PhaseSnapshot>;
  current: Phase;
  seasonQuery?: number | null;
};

// E13 direction B. Every phase, with its rank, in the phase-detail rail.
// Before this, moving from pass defence to run defence meant going back to
// the overview and finding the next row; the comparison the page invites
// cost two navigations per step.
const LIST_PHASES = PHASES.filter((p) => p !== 'overall');

export function PhaseRailList({ snapshot, current, seasonQuery }: Props) {
  const byPhase = new Map<Phase, PhaseSnapshot>(snapshot.map((s) => [s.phase, s]));

  return (
    <ul className="divide-y divide-border">
      {LIST_PHASES.map((phase) => {
        const rank = byPhase.get(phase)?.rank ?? null;
        const tier = rankTier(rank);
        const isCurrent = phase === current;
        const color =
          tier === 'positive'
            ? 'text-positive'
            : tier === 'negative'
              ? 'text-negative'
              : 'text-text-muted';
        return (
          <li key={phase}>
            <Link
              href={withSeason(`/phases/${phase}`, seasonQuery) as Route}
              aria-current={isCurrent ? 'page' : undefined}
              className={`flex min-h-[44px] items-center justify-between gap-2 py-2 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive md:min-h-0 ${
                isCurrent ? 'text-text' : 'text-text-muted hover:text-text'
              }`}
            >
              <span className="min-w-0 truncate">{phaseDisplayName(phase)}</span>
              <MetricValue value={rank} format={formatRank} className={`text-2xs ${color}`} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
