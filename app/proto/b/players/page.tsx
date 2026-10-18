import Link from 'next/link';
import type { Route } from 'next';
import { ROSTER_FILTERS, roster } from '@/lib/proto/data';
import { SectionHead } from '../../_components/shared';
import { BShell, DataRail, PageHead, RailBlock, RailRow } from '../_shell';

// Screen 3 — players hub. The live version spends its top ~280px on a
// display headline and a three-line paragraph, then puts search below it.
// Here search is the first thing under the head, and the rail carries the
// position breakdown that the filter pills only imply.
export default function BPlayers() {
  return (
    <BShell active="Players" screen="Players hub" rail={<Rail />}>
      <PageHead
        eyebrow="2026 season · current roster"
        title="Patriots, the whole roster."
        lede="Skill positions open a deep dive. Line and secondary cards open their unit page."
      />

      <div className="flex flex-wrap items-center gap-3 border-y border-border py-3">
        <input
          type="search"
          placeholder="Search players…"
          aria-label="Search players"
          className="w-full max-w-xs border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive md:w-64"
        />
        <div className="flex flex-wrap gap-1">
          {ROSTER_FILTERS.map((f, i) => (
            <span
              key={f.label}
              className={`cursor-default border px-2 py-1 font-mono text-2xs uppercase tracking-widest ${
                i === 0
                  ? 'border-positive text-positive'
                  : 'border-border-strong text-text-muted hover:text-text'
              }`}
            >
              {f.label}
              <span className="ml-1 tabular-nums text-text-dim">{f.count}</span>
            </span>
          ))}
        </div>
      </div>

      {/* A table, not a card grid. The live grid gives every player an
          identical padded tile with an empty avatar circle; a table fits
          roughly twice as many rows on screen and lets the position and
          number columns align, which is what scanning a roster needs. */}
      <section className="mt-6">
        <SectionHead note={`${roster.length} players`}>Roster</SectionHead>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border-strong text-left">
              <Th>Player</Th>
              <Th>Pos</Th>
              <Th align="right">#</Th>
              <Th align="right">Opens</Th>
            </tr>
          </thead>
          <tbody>
            {roster.map((p) => (
              <tr key={p.name} className="border-b border-border hover:bg-surface">
                <td className="px-3 py-2.5">
                  <Link
                    href={(p.deepDive ? '/proto/b/qb' : '/proto/b/players') as Route}
                    className="text-sm text-text hover:underline"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 font-mono text-2xs uppercase tracking-widest text-text-muted">
                  {p.position}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-text-muted">
                  {p.number}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-2xs uppercase tracking-widest text-text-dim">
                  {p.deepDive ? 'Deep dive' : 'Unit page'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </BShell>
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
      <RailBlock title="By position">
        <dl className="space-y-2">
          <RailRow label="Quarterback" value="3" />
          <RailRow label="Running back" value="5" />
          <RailRow label="Receiver / TE" value="9" />
          <RailRow label="Offensive line" value="2" />
          <RailRow label="Defense" value="5" />
        </dl>
      </RailBlock>
      <RailBlock title="Unit pages" note="no deep dive">
        <ul className="divide-y divide-border">
          {['Offensive line', 'Defensive line', 'Secondary'].map((u) => (
            <li key={u}>
              <Link
                href={'/proto/b/players' as Route}
                className="block py-2 text-xs text-text-muted hover:text-text"
              >
                {u} →
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 font-mono text-2xs text-text-dim">
          Line and secondary play is measured as a unit, not per player.
        </p>
      </RailBlock>
      <DataRail />
    </>
  );
}
