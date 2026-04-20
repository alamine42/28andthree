import type { TendencyRollup } from '@/lib/data/coaching';
import { formatPercent } from '@/lib/format/number';

type Props = {
  rollup: TendencyRollup;
};

// Top personnel groupings as a share-bar list. 11-personnel routinely
// dominates in modern NFL offenses; the ranked list surfaces the long tail
// (12, 21, 22, 13) that colors a playbook's identity.
export function PersonnelPanel({ rollup }: Props) {
  const groups = rollup.personnelTopGroups.slice(0, 5);

  return (
    <div data-testid="personnel-panel" className="flex flex-col gap-3">
      <h3 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        Personnel groupings
      </h3>

      {groups.length === 0 ? (
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Awaiting data
        </p>
      ) : (
        <ul className="flex flex-col">
          {groups.map((g) => (
            <li
              key={g.grouping}
              className="flex items-center gap-4 border-b border-border py-3 last:border-b-0"
            >
              <span className="w-14 font-mono text-sm font-bold uppercase tracking-widest text-text">
                {g.grouping}
              </span>
              <span
                aria-hidden="true"
                className="relative h-1.5 flex-1 overflow-hidden rounded-sm bg-surface"
              >
                <span
                  style={{ width: `${g.share * 100}%` }}
                  className="absolute inset-y-0 left-0 bg-positive"
                />
              </span>
              <span
                data-numeric="true"
                className="w-14 text-right font-mono text-sm tabular-nums text-text"
              >
                {formatPercent(g.share)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
