import Link from 'next/link';
import type { Route } from 'next';
import { BShell, DataRail, PageHead, RailBlock } from '../_shell';

// State 5 — 404. The live 404 keeps the full editorial hero and three
// recovery cards. In direction B the head shrinks like every other screen
// and the recovery routes become a list, so the page says what went wrong
// and where to go in one screen rather than one and a half.
const RECOVERY = [
  { label: 'Season overview', href: '/proto/b', detail: 'Phase ranks, record, weekly trend' },
  { label: 'Roster hub', href: '/proto/b/players', detail: 'QB, skill, units' },
  { label: 'Draft ROI', href: '/proto/b/draft', detail: 'Six classes, slot-expected value' },
  { label: 'Methodology', href: '/methodology', detail: 'Data sources, phase definitions' },
];

export default function BNotFound() {
  return (
    <BShell active="Team" screen="404" rail={<Rail />}>
      <PageHead
        eyebrow="404 · not found"
        title="Play not in the book."
        lede="That URL doesn't resolve. Either the link is stale, the page was renamed, or the slug has a typo."
      />

      <ul className="divide-y divide-border border-y border-border">
        {RECOVERY.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href as Route}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 hover:bg-surface"
            >
              <span className="w-44 text-sm text-text">{r.label}</span>
              <span className="flex-1 text-xs text-text-muted">{r.detail}</span>
              <span className="font-mono text-2xs uppercase tracking-widest text-text-dim">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </BShell>
  );
}

function Rail() {
  return (
    <>
      <RailBlock title="Common causes">
        <ul className="space-y-2 text-xs text-text-muted">
          <li>A phase slug that no longer exists.</li>
          <li>
            A player who left the roster — their clean URL 404s; the season-scoped one still
            resolves.
          </li>
          <li>A season before 2020, which the data does not cover.</li>
        </ul>
      </RailBlock>
      <DataRail />
    </>
  );
}
