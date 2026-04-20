import { PHASES, type Phase } from '@/lib/constants/phases';
import type { PatsSparklines, PhaseSnapshot } from '@/lib/data/phases';
import { PhaseCard } from './PhaseCard';

type Props = {
  snapshot: ReadonlyArray<PhaseSnapshot>;
  sparklines: PatsSparklines;
};

// `overall` is already the hero stat at the top of the page; showing it again
// as a card here double-counts it and invites confusion with the 11 phase-
// specific ranks beneath.
const GRID_PHASES = PHASES.filter((p) => p !== 'overall');

export function PhaseGrid({ snapshot, sparklines }: Props) {
  const byPhase = new Map<Phase, PhaseSnapshot>(snapshot.map((s) => [s.phase, s]));

  return (
    <section className="flex flex-col gap-5" data-testid="phase-grid">
      <h2 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        League rank across phases
      </h2>
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {GRID_PHASES.map((phase) => {
          const s = byPhase.get(phase);
          const points = sparklines.get(phase) ?? [];
          return (
            <PhaseCard
              key={phase}
              phase={phase}
              rank={s?.rank ?? null}
              epaPerPlay={s?.epaPerPlay ?? null}
              sparkline={points}
              insufficientSample={s ? s.plays < 30 : false}
            />
          );
        })}
      </div>
    </section>
  );
}
