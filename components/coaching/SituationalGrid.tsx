import type { TendencyRollup } from '@/lib/data/coaching';
import { formatPercent } from '@/lib/format/number';

type Props = {
  rollup: TendencyRollup;
};

type Stat = {
  label: string;
  key: 'shotgunRate' | 'playActionRate' | 'motionRate' | 'noHuddleRate';
  hint: string;
};

const STATS: ReadonlyArray<Stat> = [
  { label: 'Shotgun', key: 'shotgunRate', hint: 'QB aligned in shotgun' },
  { label: 'Play-action', key: 'playActionRate', hint: 'All dropbacks' },
  { label: 'Pre-snap motion', key: 'motionRate', hint: 'Any offensive player' },
  { label: 'No-huddle', key: 'noHuddleRate', hint: 'Snapped without huddle' },
];

// Hairline-grid stat tiles for offensive situational rates. Two columns on
// mobile, four on desktop.
export function SituationalGrid({ rollup }: Props) {
  return (
    <div
      data-testid="situational-splits"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-4"
    >
      {STATS.map((s) => (
        <div key={s.key} className="flex flex-col gap-2 bg-bg p-4 md:p-6">
          <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
            {s.label}
          </p>
          <p
            data-numeric="true"
            className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text"
          >
            {formatPercent(rollup[s.key])}
          </p>
          <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
            {s.hint}
          </p>
        </div>
      ))}
    </div>
  );
}
