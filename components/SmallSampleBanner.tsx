type Props = {
  kind: 'dropbacks' | 'routes' | 'snaps' | 'targets' | 'carries';
  n: number;
  threshold?: number;
};

const DEFAULT_THRESHOLD = 100;

/** DESIGN.md §Components callout style: --surface bg + --positive left border.
 * Triggered by the DAL when the player has fewer than `threshold` opportunity
 * units in the current season. SPEC §3.5a specifies 100 dropbacks for QB. */
export function SmallSampleBanner({ kind, n, threshold = DEFAULT_THRESHOLD }: Props) {
  if (n >= threshold) return null;
  return (
    <aside
      role="note"
      className="flex flex-col gap-1 rounded-sm border-l-2 border-positive bg-surface px-4 py-3"
    >
      <p className="font-mono text-2xs uppercase tracking-widest text-positive">
        Small sample
      </p>
      <p className="text-sm text-text">
        {n} {kind} season-to-date. Below the {threshold}-{kind.replace(/s$/, '')} threshold;
        stats may swing game-to-game.
      </p>
    </aside>
  );
}
