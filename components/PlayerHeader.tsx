import { PlayerAvatar } from './PlayerAvatar';
import type { PlayerIdentity } from '@/lib/data/player';

type Props = {
  player: PlayerIdentity;
  season: number;
  subtitle?: string;
};

export function PlayerHeader({ player, season, subtitle }: Props) {
  return (
    <header className="flex items-center gap-5" data-testid="player-header">
      <PlayerAvatar
        displayName={player.displayName}
        headshotUrl={player.headshotUrl}
        size={80}
      />
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold tracking-tightest text-text md:text-4xl">
          {player.displayName}
        </h1>
        <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
          {player.position ?? '—'}
          {player.team ? ` · ${player.team}` : null}
          {player.jerseyNumber != null ? ` · #${player.jerseyNumber}` : null}
          {` · ${season}`}
          {subtitle ? ` · ${subtitle}` : null}
        </p>
      </div>
    </header>
  );
}
