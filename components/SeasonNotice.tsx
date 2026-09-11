import { getSeasonContext } from '@/lib/data/current-season';
import { seasonNoticeCopy } from '@/lib/logic/season-context';

/** Awaiting-data notice. Renders in the transition window: the new
 * season's schedule is loaded but no snaps are in the DB yet — either
 * because kickoff has not happened or because the Tuesday ETL has not run
 * since it did. seasonNoticeCopy picks the wording for the two cases. E11:
 * rendered by the season-scoped page templates when !historical (plan
 * §3.5), server-side — no client guard, no hydration flash. Callout style
 * per DESIGN.md — surface bg, 2px positive left border. */
export async function SeasonNotice() {
  const ctx = await getSeasonContext();
  if (!ctx.awaitingFirstGame) return null;
  return (
    <aside
      role="status"
      data-testid="season-notice"
      className="rounded-sm border-l-2 border-positive bg-surface px-4 py-3"
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
        {seasonNoticeCopy(ctx)}
      </p>
    </aside>
  );
}
