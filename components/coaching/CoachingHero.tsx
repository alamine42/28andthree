import type { TendencyRollup } from '@/lib/data/coaching';
import type { FourthDownDecision } from '@/lib/data/coaching';
import { formatPercent } from '@/lib/format/number';

type Props = {
  season: number;
  offense: TendencyRollup | null;
  defense: TendencyRollup | null;
  fourthDowns: ReadonlyArray<FourthDownDecision>;
};

// Four-cell hairline-divided hero for /coaching. Matches the HeroStats
// pattern on the home page: uppercase mono label → big display value →
// mono caption with league context. Desktop: 4-col. Mobile: 2-col grid.
export function CoachingHero({ season, offense, defense, fourthDowns }: Props) {
  const overallPass = offense ? meanPassRate(offense) : null;
  const neutralPass = offense?.scoreTiedPassRate ?? null;
  const blitz = defense?.blitzRate ?? null;
  const fourthGoRate = computeGoRate(fourthDowns);

  return (
    <dl
      data-testid="coaching-hero"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-4"
    >
      <Cell label="Overall pass rate" caption={`${season} season`}>
        <PercentStat value={overallPass} />
      </Cell>
      <Cell label="Neutral pass rate" caption="Tied score state">
        <PercentStat value={neutralPass} />
      </Cell>
      <Cell label="Blitz rate" caption="Defense, all downs">
        <PercentStat value={blitz} />
      </Cell>
      <Cell label="4th-down go rate" caption={fourthDownCaption(fourthDowns, fourthGoRate)}>
        <PercentStat
          value={fourthGoRate?.rate ?? null}
          tone={fourthDowns.length > 0 ? 'neutral' : 'pending'}
        />
      </Cell>
    </dl>
  );
}

function Cell({
  label,
  caption,
  children,
}: {
  label: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 bg-bg p-5 md:p-8">
      <dt className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        {label}
      </dt>
      <dd className="flex flex-col gap-1">
        {children}
        {caption ? (
          <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
            {caption}
          </p>
        ) : null}
      </dd>
    </div>
  );
}

function PercentStat({
  value,
  tone = 'neutral',
}: {
  value: number | null;
  tone?: 'neutral' | 'pending';
}) {
  const cls = tone === 'pending' ? 'text-text-muted' : 'text-text';
  return (
    <p
      data-numeric="true"
      className={`font-display text-3xl font-bold tabular-nums tracking-tighter ${cls} md:text-display`}
    >
      {formatPercent(value)}
    </p>
  );
}

// Simple mean across the nine down×distance buckets. Not volume-weighted —
// headline figure prefers readability over exactness; the per-cell heatmap
// below provides the precise read.
function meanPassRate(r: TendencyRollup): number | null {
  const keys: Array<keyof TendencyRollup> = [
    'passRate1Short',
    'passRate1Mid',
    'passRate1Long',
    'passRate2Short',
    'passRate2Mid',
    'passRate2Long',
    'passRate3Short',
    'passRate3Mid',
    'passRate3Long',
  ];
  const vals = keys
    .map((k) => r[k])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

type GoRate = { rate: number; numer: number; denom: number };

function computeGoRate(decisions: ReadonlyArray<FourthDownDecision>): GoRate | null {
  const recommendedGo = decisions.filter((d) => d.goRecommended);
  if (recommendedGo.length === 0) return null;
  const wentWhenRec = recommendedGo.filter((d) => d.wentForIt).length;
  return {
    rate: wentWhenRec / recommendedGo.length,
    numer: wentWhenRec,
    denom: recommendedGo.length,
  };
}

function fourthDownCaption(
  decisions: ReadonlyArray<FourthDownDecision>,
  goRate: GoRate | null,
): string {
  if (decisions.length === 0) return 'Model pending';
  if (goRate === null) return 'No go-worthy 4th downs';
  return `${goRate.numer} of ${goRate.denom} recommended`;
}
