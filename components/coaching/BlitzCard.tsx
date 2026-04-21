type Props = {
  blitzRate: number;
};

// Defensive blitz rate as a stat block with league context. ~25% is the NFL
// average for "send 5+" definitions; 30%+ reads as aggressive, <20% as
// coverage-first. The caption gives the reader that grounding so the bare
// percentage isn't context-less.
export function BlitzCard({ blitzRate }: Props) {
  const pct = blitzRate * 100;
  const tone =
    pct >= 35 ? 'aggressive' : pct <= 18 ? 'conservative' : 'balanced';
  const caption =
    tone === 'aggressive'
      ? 'Well above NFL avg (~25%)'
      : tone === 'conservative'
        ? 'Well below NFL avg (~25%)'
        : 'Near NFL avg (~25%)';

  return (
    <div data-testid="blitz-panel" className="flex flex-col gap-3">
      <h3 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        Blitz rate
      </h3>
      <div className="flex items-baseline gap-4">
        <p
          data-numeric="true"
          className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-display"
        >
          {Math.round(pct)}%
        </p>
        <p className="flex flex-col gap-0.5">
          <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
            {tone}
          </span>
          <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
            {caption}
          </span>
        </p>
      </div>
    </div>
  );
}
