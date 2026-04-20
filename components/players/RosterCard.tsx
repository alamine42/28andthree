'use client';

import Link from 'next/link';
import { useId } from 'react';
import { playerHref } from '@/lib/format/player-routes';
import type { RosterEntry } from '@/lib/data/players-hub';
import { RosterCardBody } from './RosterCardBody';

// Grid-view card. Renders a <Link> for every role that has a destination,
// and a plain <div> for `special` (no /team/units/special-teams page yet —
// review finding #7). Focus styles sit on the actual focusable element to
// avoid the display:contents trap we already hit once in
// `docs/solutions/gotchas/display-contents-hides-focus-rings.md`.
export function RosterCard({ player }: { player: RosterEntry }) {
  const href = playerHref(player);
  const testId = `roster-card-${player.gsisId}`;
  const base = 'flex items-center gap-4 bg-bg p-5 transition-colors';
  const clickable =
    ' hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive';

  if (href === null) {
    // Non-clickable card for special-teams (no deep-dive page yet). Emits a
    // visible caption + aria-describedby so both sighted users and screen
    // readers learn the tile is intentionally inert — tooltip alone was
    // inaccessible (codex review pass-1 finding #3).
    return <InertCard player={player} testId={testId} className={base} />;
  }
  return (
    <Link href={href} data-testid={testId} className={base + clickable}>
      <RosterCardBody player={player} />
    </Link>
  );
}

function InertCard({
  player,
  testId,
  className,
}: {
  player: RosterEntry;
  testId: string;
  className: string;
}) {
  const captionId = useId();
  return (
    <div
      data-testid={testId}
      className={className}
      aria-disabled="true"
      aria-describedby={captionId}
    >
      <RosterCardBody player={player} />
      <span
        id={captionId}
        className="ml-auto font-mono text-2xs uppercase tracking-widest text-text-muted"
      >
        Page coming soon
      </span>
    </div>
  );
}
