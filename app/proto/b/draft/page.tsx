import { draftClass2024, draftClasses } from '@/lib/proto/data';
import { SectionHead } from '../../_components/shared';
import { BShell, DataRail, PageHead, RailBlock, RailRow } from '../_shell';

// Screen 5 — draft ROI. The class strip stays (it reads well), but the
// per-class table gets the rail's grade summary beside it instead of a
// run of counts crammed into the section header.
export default function BDraft() {
  return (
    <BShell active="Draft" screen="Draft ROI" rail={<Rail />}>
      <PageHead
        eyebrow="Draft · 2021–2026"
        title="Mayo & Wolf, by the draft class."
        lede="Slot-expected value is the 2015–2024 league curve at the same slot. Actual is EPA-weighted contribution to date."
      />

      <section className="mt-2">
        <SectionHead note="six classes">Classes</SectionHead>
        <div className="grid gap-px bg-border sm:grid-cols-3 lg:grid-cols-6">
          {draftClasses.map((c) => (
            <ClassTile key={c.year} {...c} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionHead note="8 picks · 1 hit · 4 fair · 3 miss">2024 class</SectionHead>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border-strong text-left">
              <Th align="right">#</Th>
              <Th>Player</Th>
              <Th>Pos</Th>
              <Th align="right">Rd</Th>
              <Th align="right">Expected</Th>
              <Th align="right">Actual</Th>
              <Th align="right">Grade</Th>
            </tr>
          </thead>
          <tbody>
            {draftClass2024.map((p) => (
              <tr key={p.pick} className="border-b border-border hover:bg-surface">
                <td className="px-3 py-2.5 text-right font-mono text-2xs tabular-nums text-text-muted">
                  #{p.pick}
                </td>
                <td className="px-3 py-2.5 text-sm text-text">
                  {p.name}
                  {p.proxy ? (
                    <span
                      title="Trench or secondary pick — graded on a unit proxy, not individual EPA"
                      className="ml-1 text-text-dim"
                    >
                      *
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 font-mono text-2xs uppercase tracking-widest text-text-muted">
                  {p.position}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-text-muted">
                  R{p.round}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-text-muted">
                  {p.expected.toFixed(1)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-text">
                  {p.actual == null ? '—' : p.actual.toFixed(1)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <GradeBadge grade={p.grade} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 font-mono text-2xs text-text-dim">
          * Trench and secondary picks carry a unit-proxy tier, not an individual EPA grade.
        </p>
      </section>
    </BShell>
  );
}

function ClassTile({
  year,
  picks,
  hit,
  fair,
  miss,
  pending,
}: {
  year: number;
  picks: number;
  hit: number;
  fair: number;
  miss: number;
  pending: number;
}) {
  const total = Math.max(1, hit + fair + miss + pending);
  return (
    <div className="flex flex-col gap-2 bg-bg p-3">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-xl font-bold tabular-nums text-text">{year}</span>
        <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          {picks} picks
        </span>
      </div>
      <div className="flex h-1 w-full overflow-hidden bg-border" aria-hidden="true">
        <span className="bg-positive" style={{ width: `${(hit / total) * 100}%` }} />
        <span className="bg-chart-neutral" style={{ width: `${(fair / total) * 100}%` }} />
        <span className="bg-negative" style={{ width: `${(miss / total) * 100}%` }} />
      </div>
      <p className="font-mono text-2xs tabular-nums text-text-muted">
        {hit}H · {fair}F · {miss}M · {pending}P
      </p>
    </div>
  );
}

function GradeBadge({ grade }: { grade: 'HIT' | 'FAIR' | 'MISS' | 'PENDING' }) {
  const tone =
    grade === 'HIT'
      ? 'border-positive-dim text-positive'
      : grade === 'MISS'
        ? 'border-border-strong text-negative'
        : 'border-border-strong text-text-muted';
  return (
    <span className={`border px-2 py-0.5 font-mono text-2xs uppercase tracking-widest ${tone}`}>
      {grade}
    </span>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 font-mono text-2xs font-normal uppercase tracking-widest text-text-muted ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  );
}

function Rail() {
  return (
    <>
      <RailBlock title="2024 grades">
        <dl className="space-y-2">
          <RailRow label="Hit" value="1" />
          <RailRow label="Fair" value="4" />
          <RailRow label="Miss" value="3" />
          <RailRow label="Pending" value="0" />
        </dl>
      </RailBlock>
      <RailBlock title="Across six classes">
        <dl className="space-y-2">
          <RailRow label="Picks" value="58" />
          <RailRow label="Graded" value="38" />
          <RailRow label="Hit rate" value="24%" />
        </dl>
        <p className="mt-2 font-mono text-2xs text-text-dim">
          Hit rate counts graded picks only; 2025 and 2026 are still pending.
        </p>
      </RailBlock>
      <DataRail />
    </>
  );
}
