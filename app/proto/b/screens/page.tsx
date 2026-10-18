import Link from 'next/link';
import type { Route } from 'next';
import { Eyebrow } from '../../_components/shared';
import { BShell, DataRail, PageHead, RailBlock } from '../_shell';

// Index of every screen and state in direction B. Prototype scaffolding —
// not a screen the real site would have.
const SCREENS = [
  {
    href: '/proto/b',
    label: 'Season overview',
    note: 'Home. Phase table, league table, results rail.',
  },
  {
    href: '/proto/b/phase',
    label: 'Phase detail',
    note: 'Drill-in from any phase row. Four states below.',
  },
  { href: '/proto/b/players', label: 'Players hub', note: 'Search, filters, roster table.' },
  {
    href: '/proto/b/qb',
    label: 'QB deep dive',
    note: 'The densest screen. Methodology moves to the rail.',
  },
  { href: '/proto/b/draft', label: 'Draft ROI', note: 'Class strip plus per-class table.' },
  { href: '/proto/b/coaching', label: 'Coaching', note: 'The awaiting-ETL state it is in today.' },
  {
    href: '/proto/b/trends',
    label: 'Trends',
    note: 'Fluid chart — contrast with the fixed 720px ones.',
  },
];

const STATES = [
  { href: '/proto/b/phase?state=loaded', label: 'Loaded', note: 'The normal case.' },
  {
    href: '/proto/b/phase?state=small-sample',
    label: 'n < 30',
    note: 'Rank renders, caution above it.',
  },
  {
    href: '/proto/b/phase?state=historical',
    label: 'Historical season',
    note: 'Chip plus back link, never implicit.',
  },
  {
    href: '/proto/b/phase?state=no-data',
    label: 'No data',
    note: 'Copy differs for past vs upcoming.',
  },
  {
    href: '/proto/b/coaching',
    label: 'Awaiting ETL',
    note: 'Whole screen empty, sections still named.',
  },
  { href: '/proto/b/not-found', label: '404', note: 'Nothing here. Recovery is navigation.' },
  { href: '/proto/b/error', label: 'Error boundary', note: 'Something broke. Recovery is retry.' },
];

export default function BScreens() {
  return (
    <BShell active="Team" screen="Screen index" rail={<Rail />}>
      <PageHead
        eyebrow="Direction B · prototype index"
        title="Every screen and state."
        lede="Seven screens, seven states. The phase screen carries four of them behind ?state=."
      />
      <Group title="Screens" items={SCREENS} />
      <div className="mt-8">
        <Group title="States" items={STATES} />
      </div>
    </BShell>
  );
}

function Group({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string; note: string }[];
}) {
  return (
    <section>
      <div className="mb-2 border-b border-border pb-2">
        <Eyebrow>{title}</Eyebrow>
      </div>
      <ul className="divide-y divide-border border-b border-border">
        {items.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href as Route}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 hover:bg-surface"
            >
              <span className="w-48 text-sm text-text">{s.label}</span>
              <span className="flex-1 text-xs text-text-muted">{s.note}</span>
              <span className="font-mono text-2xs uppercase tracking-widest text-text-dim">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Rail() {
  return (
    <>
      <RailBlock title="Not built">
        <ul className="space-y-2 text-xs text-text-muted">
          <li>Skill-player deep dive — same shell as the QB screen.</li>
          <li>Unit pages (OL, DL, secondary).</li>
          <li>Methodology and about — these keep the 120px editorial rhythm and the full hero.</li>
        </ul>
      </RailBlock>
      <DataRail />
    </>
  );
}
