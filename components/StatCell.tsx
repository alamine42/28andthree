import { MetricValue } from '@/components/numeric';

// Hairline-divided stat cell (DESIGN.md "Stat block"): mono uppercase
// label over a display-weight value. One definition — this replaced four
// per-template copies during the E11 simplify pass.

export function StatCell({
  label,
  children,
  testid,
}: {
  label: string;
  children: React.ReactNode;
  testid?: string;
}) {
  return (
    <div className="flex flex-col gap-2 bg-bg p-6 md:p-8" data-testid={testid}>
      <dt className="font-mono text-2xs uppercase tracking-widest text-text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The big display-weight number inside a StatCell. */
export function StatValue({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-display">
      {children}
    </p>
  );
}

/** StatCell + StatValue + MetricValue in one — the common case. */
export function MetricCell<T>({
  label,
  value,
  format,
  testid,
}: {
  label: string;
  value: T | null | undefined;
  format: (v: T | null | undefined) => string;
  testid?: string;
}) {
  return (
    <StatCell label={label} testid={testid}>
      <StatValue>
        <MetricValue value={value} format={format} />
      </StatValue>
    </StatCell>
  );
}
