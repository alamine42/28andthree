'use client';

import Link from 'next/link';
import { useId } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import type { RosterEntry } from '@/lib/data/players-hub';
import { playerHref } from '@/lib/format/player-routes';

type Props = {
  roster: ReadonlyArray<RosterEntry>;
  seasonQuery?: number | null;
};

// E13 direction B. Replaces the four-across card grid. Every card was an
// identical padded tile carrying a name, a position and an avatar that is
// an empty circle for most of the roster; at 184 players that is a long
// scroll of near-identical boxes. Rows put position and number into
// aligned columns, which is what scanning a roster actually needs, and fit
// roughly twice as many players on screen.
//
// Row links keep the `roster-card-<gsisId>` test id the E2E suite targets,
// and the special-teams inert case keeps its accessible caption.
export function RosterTable({ roster, seasonQuery }: Props) {
  return (
    <div className="overflow-x-auto">
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
          {roster.map((player) => (
            <Row key={player.gsisId} player={player} seasonQuery={seasonQuery} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ player, seasonQuery }: { player: RosterEntry; seasonQuery?: number | null }) {
  const href = playerHref(player, seasonQuery);
  const testId = `roster-card-${player.gsisId}`;
  const captionId = useId();
  const position = player.position?.trim().toUpperCase() ?? '';

  const cells = (
    <>
      <td className="px-3 py-2.5 font-mono text-2xs uppercase tracking-widest text-text-muted">
        {position}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-text-muted">
        {player.jerseyNumber ?? '—'}
      </td>
    </>
  );

  if (href === null) {
    // Special teams has no destination page yet. The caption is visible and
    // referenced by aria-describedby so both sighted and screen-reader
    // users learn the row is intentionally inert.
    return (
      <tr
        data-testid={testId}
        aria-disabled="true"
        aria-describedby={captionId}
        className="border-b border-border"
      >
        <td className="px-3 py-2.5">
          <span className="flex items-center gap-3 text-sm text-text-muted">
            <PlayerAvatar
              displayName={player.displayName}
              headshotUrl={player.headshotUrl}
              size={24}
            />
            {player.displayName}
          </span>
        </td>
        {cells}
        <td
          id={captionId}
          className="px-3 py-2.5 text-right font-mono text-2xs uppercase tracking-widest text-text-muted"
        >
          Page coming soon
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border hover:bg-surface">
      <td className="p-0">
        <Link
          href={href}
          data-testid={testId}
          className="flex min-h-[44px] items-center gap-3 px-3 py-2.5 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive"
        >
          <PlayerAvatar
            displayName={player.displayName}
            headshotUrl={player.headshotUrl}
            size={24}
          />
          {player.displayName}
        </Link>
      </td>
      {cells}
      <td className="px-3 py-2.5 text-right font-mono text-2xs uppercase tracking-widest text-text-muted">
        {player.category === 'QB' || player.category === 'RB' || player.category === 'WR+TE'
          ? 'Deep dive'
          : 'Unit page'}
      </td>
    </tr>
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
