import type { TendencyRollup } from '@/lib/data/coaching';

type Props = {
  rollup: TendencyRollup;
};

const DOWNS = [1, 2, 3] as const;
const BUCKETS = ['short', 'mid', 'long'] as const;

const BUCKET_LABEL: Record<(typeof BUCKETS)[number], string> = {
  short: '0–3',
  mid: '4–7',
  long: '8+',
};

export function PlayCallMixTable({ rollup }: Props) {
  const cell = (down: number, bucket: string) => {
    const key = `passRate${down}${cap(bucket)}` as keyof TendencyRollup;
    const v = rollup[key] as number | null;
    return v === null ? '—' : `${Math.round(v * 100)}%`;
  };

  return (
    <div data-testid="play-call-mix-table" className="overflow-x-auto">
      <table className="w-full min-w-[28rem] table-fixed border-collapse">
        <caption className="pb-2 text-left font-mono text-2xs uppercase tracking-widest text-text-muted">
          Pass rate by down × distance
        </caption>
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 pr-4 text-left font-mono text-2xs uppercase tracking-widest text-text-muted">
              Down
            </th>
            {BUCKETS.map((b) => (
              <th
                key={b}
                className="py-2 pr-4 text-right font-mono text-2xs uppercase tracking-widest text-text-muted"
              >
                {BUCKET_LABEL[b]} yds
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DOWNS.map((d) => (
            <tr key={d} className="border-b border-border last:border-b-0">
              <td className="py-3 pr-4 font-mono text-xs text-text-muted">{d}{suffix(d)}</td>
              {BUCKETS.map((b) => (
                <td
                  key={b}
                  className="py-3 pr-4 text-right font-mono text-sm tabular-nums text-text"
                  data-numeric="true"
                >
                  {cell(d, b)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function suffix(down: number): string {
  if (down === 1) return 'st';
  if (down === 2) return 'nd';
  if (down === 3) return 'rd';
  return 'th';
}
