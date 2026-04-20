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
        {n} {kind} season-to-date. Below the {threshold}-{singularize(kind)} threshold;
        stats may swing game-to-game.
      </p>
    </aside>
  );
}

function singularize(word: string): string {
  // "carries" → "carry", "plays" → "play", "snaps" → "snap". Naive two-rule
  // handler — we only pass the 5 kinds below so we don't need full inflection.
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}
