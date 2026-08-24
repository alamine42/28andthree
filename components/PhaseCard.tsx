import Link from 'next/link';
import type { Route } from 'next';
import { rankTier } from '@/lib/color/rank';
import { type Phase } from '@/lib/constants/phases';
import { phaseDisplayName } from '@/lib/format/phase';
import { formatEpa } from '@/lib/format/number';
import { MetricValue, RankNumber } from '@/components/numeric';
import { Sparkline } from '@/components/charts/Sparkline';
import type { SparklinePoint } from '@/lib/data/phases';

type Props = {
  phase: Phase;
  rank: number | null;
  epaPerPlay: number | null;
  sparkline: ReadonlyArray<SparklinePoint>;
  insufficientSample?: boolean;
  /** When a past season is in view, its year — appended as ?season= so the
   * historical context follows the click through. */
  seasonQuery?: number | null;
};

export function PhaseCard({
  phase,
  rank,
  epaPerPlay,
  sparkline,
  insufficientSample,
  seasonQuery,
}: Props) {
  const tier = rankTier(rank);
  const slug = phase;
  const display = phaseDisplayName(phase);
  const values = sparkline.map((p) => p.value);

  // No trend arrow on the headline rank: the big number is a season-to-date
  // cumulative rank but the weekly delta would compare isolated single-week
  // ranks — different metrics on the same tile produced "01 ▼ 1" paradoxes.
  // The sparkline sits inline to the right of the rank to carry the trend
  // signal without costing a full row of vertical space.
  return (
    <Link
      href={`/phases/${slug}${seasonQuery != null ? `?season=${seasonQuery}` : ''}` as Route}
      data-testid={`phase-card-${slug}`}
      className="flex min-h-[80px] flex-col gap-1.5 bg-bg p-3 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive md:min-h-[96px] md:p-4"
    >
      <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        {display}
      </p>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <RankNumber rank={rank} className="text-2xl leading-none md:text-3xl" />
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
            width={88}
            height={24}
          />
        ) : null}
      </div>
      <p className="font-mono text-2xs text-text-muted">
        <MetricValue value={epaPerPlay} format={formatEpa} />
        <span className="ml-1 text-text-muted">EPA/play</span>
      </p>
    </Link>
  );
}
