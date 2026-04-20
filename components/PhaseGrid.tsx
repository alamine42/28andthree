import { PHASES, type Phase } from '@/lib/constants/phases';
import type { PatsSparklines, PhaseSnapshot } from '@/lib/data/phases';
import { PhaseCard } from './PhaseCard';

type Props = {
  snapshot: ReadonlyArray<PhaseSnapshot>;
  sparklines: PatsSparklines;
};

export function PhaseGrid({ snapshot, sparklines }: Props) {
  const byPhase = new Map<Phase, PhaseSnapshot>(snapshot.map((s) => [s.phase, s]));

  return (
    <section className="flex flex-col gap-5" data-testid="phase-grid">
      <h2 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        League rank across phases
      </h2>
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {PHASES.map((phase) => {
          const s = byPhase.get(phase);
          const points = sparklines.get(phase) ?? [];
          return (
            <PhaseCard
              key={phase}
              phase={phase}
              rank={s?.rank ?? null}
              epaPerPlay={s?.epaPerPlay ?? null}
              sparkline={points}
              deltaRank={s?.deltaRank ?? null}
              insufficientSample={s ? s.plays < 30 : false}
            />
          );
        })}
      </div>
    </section>
  );
}
