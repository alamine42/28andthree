import Link from 'next/link';
import type { Route } from 'next';
import { Eyebrow } from './_components/shared';

const DIRECTIONS = [
  {
    slug: 'a',
    name: 'A · Terminal shell',
    claim: 'Persistent left rail, sticky context bar, content fills the viewport.',
    cost: 'Largest build. Needs a DESIGN.md amendment for app-shell chrome.',
    gives: 'Team state never leaves the screen. Drill-downs swap one region, not the page.',
    costs: 'Reads like a tool, not a publication. The editorial voice loses its stage.',
  },
  {
    slug: 'b',
    name: 'B · Editorial dashboard',
    claim: 'Keeps the top nav and the voice. Adds a right rail and kills the hero on data pages.',
    cost: 'Smallest change. No new navigation model.',
    gives:
      'Recovers ~280px above the fold and uses the second column. Phase cards become a sortable table.',
    costs: 'Still a centred column underneath. Does not change what the site is about.',
  },
  {
    slug: 'c',
    name: 'C · Compare-first',
    claim: 'The 32-team league table is the home page. Patriots pinned.',
    cost: 'Biggest product change, small data change — one pivoted query over rows the ETL already writes.',
    gives: 'Answers the real question — where New England sits — without a click.',
    costs: 'The team-first identity blurs into a league site.',
  },
] as const;

export default function ProtoIndex() {
  return (
    <div className="mx-auto max-w-[900px] px-6 py-12">
      <Eyebrow>Desktop redesign · three layout directions</Eyebrow>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tighter text-text">
        Pick a direction.
      </h1>
      <p className="mt-3 max-w-[60ch] text-base text-text-muted">
        Each link is the season-overview screen built three ways, at 1440px and up. Patriots numbers
        are the real 2026 values. The other 31 teams are fabricated so the league table has rows —
        nothing here is a data source.
      </p>
      <ul className="mt-8 divide-y divide-border border-y border-border">
        {DIRECTIONS.map((d) => (
          <li key={d.slug}>
            <Link
              href={`/proto/${d.slug}` as Route}
              className="block px-1 py-5 transition-colors hover:bg-surface"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-xl font-bold text-text">{d.name}</h2>
                <span className="font-mono text-2xs uppercase tracking-widest text-text-dim">
                  Open →
                </span>
              </div>
              <p className="mt-2 text-sm text-text-muted">{d.claim}</p>
              <dl className="mt-3 grid gap-x-6 gap-y-1 md:grid-cols-2">
                <Row term="Gives" desc={d.gives} tone="positive" />
                <Row term="Costs" desc={d.costs} tone="negative" />
              </dl>
              <p className="mt-2 font-mono text-2xs text-text-dim">{d.cost}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-text-muted">
        Direction B is built out:{' '}
        <Link
          href={'/proto/b/screens' as Route}
          className="text-text underline decoration-border-strong underline-offset-4 hover:decoration-text"
        >
          every screen and state →
        </Link>
      </p>
      <p className="mt-3 font-mono text-2xs uppercase tracking-widest text-text-dim">
        Use the Agentation panel, bottom right, to annotate anything on these screens.
      </p>
    </div>
  );
}

function Row({ term, desc, tone }: { term: string; desc: string; tone: 'positive' | 'negative' }) {
  return (
    <div className="flex gap-2">
      <dt
        className={`font-mono text-2xs uppercase tracking-widest ${
          tone === 'positive' ? 'text-positive' : 'text-negative'
        }`}
      >
        {term}
      </dt>
      <dd className="flex-1 text-xs text-text-muted">{desc}</dd>
    </div>
  );
}
