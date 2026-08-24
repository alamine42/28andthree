/** Blank-stats placeholder. Two situations share it (plan §2):
 * - upcoming: the preseason transition window — stats are coming.
 * - historical: a past season with no rows for this view — they are not.
 * The copy must not promise data that will never arrive (review CRITICAL).
 * Callout style per DESIGN.md. */
export function NoSeasonData({
  season,
  variant = 'upcoming',
  message,
}: {
  season: number;
  variant?: 'upcoming' | 'historical';
  message?: string;
}) {
  const copy =
    message ??
    (variant === 'historical'
      ? `No ${season} stats for this view.`
      : `No ${season} snaps yet. Stats populate after Week 1 of the regular season.`);
  return (
    <p
      data-testid="no-season-data"
      className="rounded-sm border-l-2 border-positive bg-surface px-4 py-3 text-sm text-text-muted"
    >
      {copy}
    </p>
  );
}
