import type { TendencyRollup } from '@/lib/data/coaching';
import { formatPercent } from '@/lib/format/number';

type Props = {
  rollup: TendencyRollup;
};

type ScoreBand = {
  label: string;
  shortLabel: string;
  key:
    | 'scoreTrailingBigPassRate'
    | 'scoreTrailingSmallPassRate'
    | 'scoreTiedPassRate'
    | 'scoreLeadingSmallPassRate'
    | 'scoreLeadingBigPassRate';
};

const BANDS: ReadonlyArray<ScoreBand> = [
  { label: 'Trailing 9+', shortLabel: 'TRAIL 9+', key: 'scoreTrailingBigPassRate' },
  { label: 'Trailing 1\u20138', shortLabel: 'TRAIL', key: 'scoreTrailingSmallPassRate' },
  { label: 'Tied', shortLabel: 'TIED', key: 'scoreTiedPassRate' },
  { label: 'Leading 1\u20138', shortLabel: 'LEAD', key: 'scoreLeadingSmallPassRate' },
  { label: 'Leading 9+', shortLabel: 'LEAD 9+', key: 'scoreLeadingBigPassRate' },
];

// Pass rate across the five score-state bands. Trailing-big expected
// pass-heavy, leading-big run-heavy — the stacked bars visualize the
// inversion; the numbers below provide the precise read.
export function ScoreStatePanel({ rollup }: Props) {
  const values = BANDS.map((b) => ({ band: b, value: rollup[b.key] }));
  const hasAny = values.some((v) => v.value !== null);

  return (
    <div data-testid="score-state-panel" className="flex flex-col gap-3">
      <h3 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        Pass rate by score state
      </h3>

      {!hasAny ? (
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Awaiting data
        </p>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-px overflow-hidden rounded-sm border border-border bg-border">
            {values.map(({ band, value }) => (
              <div
                key={band.key}
                className="flex flex-col items-center gap-1.5 bg-bg px-2 py-3"
              >
                <PassBar value={value} label={band.label} />
                <p
                  data-numeric="true"
                  className="font-mono text-sm font-bold tabular-nums text-text"
                >
                  {formatPercent(value)}
                </p>
                <p className="text-center font-mono text-2xs uppercase tracking-widest text-text-muted">
                  {band.shortLabel}
                </p>
              </div>
            ))}
          </div>

          <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
            Trailing big &rarr; tied &rarr; leading big
          </p>
        </>
      )}
    </div>
  );
}

function PassBar({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return <div className="h-16 w-full rounded-sm bg-surface" />;
  }
  // 3px floor guarantees a sliver even at tiny values so the bar never
  // disappears. Max height caps at 64px.
  const passH = Math.max(3, Math.round(value * 64));
  const runH = 64 - passH;
  return (
    <div
      aria-label={`${label}: ${Math.round(value * 100)}% pass`}
      className="flex h-16 w-full flex-col items-stretch justify-end overflow-hidden rounded-sm bg-surface"
    >
      {runH > 0 ? (
        <div style={{ height: `${runH}px` }} className="w-full bg-surface-2" />
      ) : null}
      <div
        style={{ height: `${passH}px`, backgroundColor: 'rgba(224, 180, 74, 0.85)' }}
        className="w-full"
      />
    </div>
  );
}
