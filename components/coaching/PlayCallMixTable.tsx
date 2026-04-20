import type { TendencyRollup } from '@/lib/data/coaching';
import { formatPercent } from '@/lib/format/number';

type Props = {
  rollup: TendencyRollup;
};

const DOWNS = [1, 2, 3] as const;
const BUCKETS = ['short', 'mid', 'long'] as const;

const BUCKET_LABEL: Record<(typeof BUCKETS)[number], string> = {
  short: '0\u20133',
  mid: '4\u20137',
  long: '8+',
};

// Heat-tinted pass rate grid. Cell opacity scales with pass-share so the
// "obvious passing downs" pattern — 3rd-and-long pass-heavy, 1st-and-short
// run-heavy — leaps off the page at a glance. Opacity is applied via inline
// style because tailwind.config.ts exposes tokens as raw `var(--token)`
// without the `<alpha-value>` placeholder.
export function PlayCallMixTable({ rollup }: Props) {
  return (
    <div data-testid="play-call-mix-table" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Pass rate by down &times; distance
        </h3>
        <HeatLegend />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] table-fixed border-collapse">
          <caption className="sr-only">
            Pass rate by down and distance. Higher percentages shown with a
            deeper amber tint.
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th className="w-14 py-2 pr-4 text-left font-mono text-2xs uppercase tracking-widest text-text-muted">
                Down
              </th>
              {BUCKETS.map((b) => (
                <th
                  key={b}
                  className="py-2 text-center font-mono text-2xs uppercase tracking-widest text-text-muted"
                >
                  {BUCKET_LABEL[b]} <span className="text-text-muted">yds</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOWNS.map((d) => (
              <tr key={d} className="border-b border-border last:border-b-0">
                <td className="py-3 pr-4 font-mono text-xs uppercase tracking-widest text-text-muted">
                  {d}
                  {suffix(d)}
                </td>
                {BUCKETS.map((b) => {
                  const key = `passRate${d}${cap(b)}` as keyof TendencyRollup;
                  const v = rollup[key] as number | null;
                  return (
                    <HeatCell
                      key={b}
                      value={v}
                      label={`${d}${suffix(d)} and ${BUCKET_LABEL[b]} yards`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeatCell({ value, label }: { value: number | null; label: string }) {
  const tintStyle = tintFor(value);
  return (
    <td
      aria-label={value === null ? `${label}: no data` : `${label}: ${Math.round(value * 100)}%`}
      className="relative px-1 py-3 text-center"
    >
      <span
        aria-hidden="true"
        style={tintStyle}
        className="absolute inset-x-1 inset-y-1.5 rounded-sm"
      />
      <span
        data-numeric="true"
        className="relative font-mono text-base font-bold tabular-nums text-text"
      >
        {formatPercent(value)}
      </span>
    </td>
  );
}

function HeatLegend() {
  return (
    <div
      aria-hidden="true"
      className="hidden items-center gap-1.5 font-mono text-2xs uppercase tracking-widest text-text-muted md:flex"
    >
      <span>Run</span>
      <span className="inline-flex overflow-hidden rounded-sm">
        {[0.15, 0.35, 0.55, 0.75].map((o, i) => (
          <span
            key={`run-${i}`}
            style={{ backgroundColor: `rgba(162, 58, 74, ${o})` }}
            className="h-2 w-4"
          />
        ))}
        <span className="h-2 w-4 bg-bg" />
        {[0.15, 0.35, 0.55, 0.75].map((o, i) => (
          <span
            key={`pass-${i}`}
            style={{ backgroundColor: `rgba(224, 180, 74, ${o})` }}
            className="h-2 w-4"
          />
        ))}
      </span>
      <span>Pass</span>
    </div>
  );
}

function tintFor(value: number | null): React.CSSProperties {
  if (value === null) return {};
  // 50/50 → no tint. Pass-heavy cells glow amber; run-heavy cells take a
  // cranberry undertone. Alpha capped at 0.75 so the number stays legible.
  const diff = value - 0.5;
  const alpha = Math.min(Math.abs(diff) * 1.5, 0.75);
  const color = diff >= 0 ? '224, 180, 74' : '162, 58, 74';
  return { backgroundColor: `rgba(${color}, ${alpha})` };
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
