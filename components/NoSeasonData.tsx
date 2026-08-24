/** Blank-stats placeholder for the preseason transition window. Pages
 * render it in place of season-scoped stat blocks while the new season
 * has no snaps. Callout style per DESIGN.md. */
export function NoSeasonData({ season }: { season: number }) {
  return (
    <p
      data-testid="no-season-data"
      className="rounded-sm border-l-2 border-positive bg-surface px-4 py-3 text-sm text-text-muted"
    >
      No {season} snaps yet. Stats populate after Week 1 of the regular
      season.
    </p>
  );
}
