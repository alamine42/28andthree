import type { FourthDownDecision } from '@/lib/data/coaching';

type Props = {
  decisions: ReadonlyArray<FourthDownDecision>;
};

// Week-by-week 4th-down decision ledger. For each 4th-down play: what the
// model recommended, what the Pats actually did, and whether they agreed
// with the model. Replaces an earlier scatter-plot rendering (Y axis was a
// bernoulli outcome — unreadable). This tabular layout scans left-to-right
// and highlights disagreement rows with a cranberry bar.
export function FourthDownLedger({ decisions }: Props) {
  const sorted = [...decisions].sort((a, b) => a.week - b.week);

  return (
    <div data-testid="fourth-down-scatter" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          4th-down ledger
        </h3>
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Model rec vs. team choice
        </p>
      </div>

      <ul className="flex flex-col">
        {sorted.map((d, i) => (
          <LedgerRow key={`${d.week}-${i}`} decision={d} />
        ))}
      </ul>
    </div>
  );
}

function LedgerRow({ decision: d }: { decision: FourthDownDecision }) {
  const agreed = d.wentForIt === d.goRecommended;
  const toneBorder = agreed ? 'border-l-positive' : 'border-l-negative';
  const wpDisplay = formatSignedWp(d.wpBoostGo);

  return (
    <li
      className={`grid grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-3 border-l-2 border-b border-border py-2.5 pl-3 ${toneBorder}`}
    >
      <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        Wk {d.week}
      </span>

      <span className="flex flex-col gap-0.5">
        <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Model rec
        </span>
        <span className="font-mono text-xs text-text">
          {d.goRecommended ? (
            <span className="text-positive">GO</span>
          ) : (
            <span className="text-text-muted">KICK</span>
          )}
          <span
            data-numeric="true"
            className="ml-2 tabular-nums text-text-muted"
            title="WP gain from going for it"
          >
            {wpDisplay} WP
          </span>
        </span>
      </span>

      <span className="flex flex-col gap-0.5">
        <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Team choice
        </span>
        <span className="font-mono text-xs text-text">
          {d.wentForIt ? (
            <span className={d.goRecommended ? 'text-text' : 'text-positive'}>
              WENT
            </span>
          ) : (
            <span className={d.goRecommended ? 'text-negative' : 'text-text'}>
              KICKED
            </span>
          )}
          {d.wentForIt && d.resultYards !== null ? (
            <span
              data-numeric="true"
              className="ml-2 tabular-nums text-text-muted"
            >
              {d.resultYards >= 0 ? '+' : '\u2212'}
              {Math.abs(d.resultYards)} yds
            </span>
          ) : null}
        </span>
      </span>

      <span
        aria-label={agreed ? 'Agreed with model' : 'Disagreed with model'}
        className={`justify-self-end font-mono text-xs font-bold ${agreed ? 'text-positive' : 'text-negative'}`}
      >
        {agreed ? '\u2713' : '\u2717'}
      </span>
    </li>
  );
}

function formatSignedWp(wp: number): string {
  const pct = Math.abs(wp * 100).toFixed(1);
  if (wp > 0) return `+${pct}%`;
  if (wp < 0) return `\u2212${pct}%`;
  return `${pct}%`;
}
