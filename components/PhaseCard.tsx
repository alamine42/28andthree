import Link from 'next/link';
import type { Route } from 'next';
import { rankTier } from '@/lib/color/rank';
import { type Phase } from '@/lib/constants/phases';
import { phaseDisplayName } from '@/lib/format/phase';
import { formatEpa } from '@/lib/format/number';
import { Delta, MetricValue, RankNumber } from '@/components/numeric';
import { Sparkline } from '@/components/charts/Sparkline';
import type { SparklinePoint } from '@/lib/data/phases';

type Props = {
  phase: Phase;
  rank: number | null;
  epaPerPlay: number | null;
  sparkline: ReadonlyArray<SparklinePoint>;
  /** Rank delta vs. prior week. Positive = improved, negative = declined. */
  deltaRank?: number | null;
  insufficientSample?: boolean;
};

export function PhaseCard({ phase, rank, epaPerPlay, sparkline, deltaRank, insufficientSample }: Props) {
  const tier = rankTier(rank);
  const slug = phase;
  const display = phaseDisplayName(phase);
  const values = sparkline.map((p) => p.value);

  return (
    <Link
      href={`/phases/${slug}` as Route}
      data-testid={`phase-card-${slug}`}
      className="group flex min-h-[148px] flex-col gap-3 bg-bg p-5 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive md:min-h-[172px] md:p-6"
    >
      <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        {display}
      </p>
      <div className="flex items-baseline gap-3">
        <RankNumber rank={rank} className="text-3xl leading-none md:text-display" />
        {deltaRank != null && deltaRank !== 0 ? (
          <Delta value={deltaRank} className="text-xs" />
        ) : null}
        {insufficientSample ? (
          <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
            n &lt; 30
          </span>
        ) : null}
      </div>
      {values.length > 0 ? (
        <Sparkline
          values={values}
          tier={tier}
          title={`${display} weekly trend, last ${values.length} weeks`}
        />
      ) : (
        <div className="h-5" aria-hidden="true" />
      )}
      <p className="font-mono text-xs text-text-muted">
        <MetricValue value={epaPerPlay} format={formatEpa} />
        <span className="ml-1 text-text-muted">EPA/play</span>
      </p>
    </Link>
  );
}
