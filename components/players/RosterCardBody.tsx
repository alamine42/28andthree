import { PlayerAvatar } from '@/components/PlayerAvatar';
import type { RosterEntry } from '@/lib/data/players-hub';

// Shared visual body for the grid card and the listbox option. Keeping the
// presentation in one place lets the two wrappers differ only in semantics:
// the grid card is a <Link>, the listbox option is a non-focusable <li>
// (plan §3.4, review finding #3).
export function RosterCardBody({ player }: { player: RosterEntry }) {
  return (
    <>
      <PlayerAvatar
        displayName={player.displayName}
        headshotUrl={player.headshotUrl}
        size={56}
      />
      <div className="flex flex-col gap-0.5">
        <p className="font-display text-base font-bold leading-tight tracking-tight text-text md:text-lg">
          {player.displayName}
        </p>
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          {formatMeta(player.position, player.jerseyNumber)}
        </p>
      </div>
    </>
  );
}

function formatMeta(position: string | null, jersey: number | null): string {
  const pos = position?.trim().toUpperCase();
  if (pos && jersey != null) return `${pos} · #${jersey}`;
  if (pos) return pos;
  if (jersey != null) return `#${jersey}`;
  return '';
}
