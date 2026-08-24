import { getSeasonContext } from '@/lib/data/current-season';

/** Site-wide preseason notice. Renders only in the transition window:
 * the new season's schedule is loaded but no regular-season snaps exist.
 * Callout style per DESIGN.md — surface bg, 2px positive left border. */
export async function SeasonNotice() {
  const ctx = await getSeasonContext();
  if (!ctx.awaitingFirstGame) return null;
  return (
    <aside
      role="status"
      data-testid="season-notice"
      className="mt-6 rounded-sm border-l-2 border-positive bg-surface px-4 py-3"
    >
      <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        {ctx.season} season
        {ctx.kickoffInDays != null ? (
          <>
            {' · kickoff in '}
            <span className="text-text">{ctx.kickoffInDays}</span>
            {' days'}
          </>
        ) : null}
      </p>
      <p className="mt-1 text-sm text-text-muted">
        {/* Explicit {' '} — the JSX transform dropped the plain space
            between the expression and this text node. */}
        The {ctx.season}{' '}
        Patriots haven&apos;t taken a regular-season snap yet. Stats
        populate after Week 1.
      </p>
    </aside>
  );
}
