'use client';

import Link from 'next/link';
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
  const shared =
    'flex items-center gap-4 bg-bg p-5 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive';

  if (href === null) {
    return (
      <div data-testid={testId} className={shared} aria-disabled="true" title="Page coming soon">
        <RosterCardBody player={player} />
      </div>
    );
  }
  return (
    <Link href={href} data-testid={testId} className={shared}>
      <RosterCardBody player={player} />
    </Link>
  );
}
