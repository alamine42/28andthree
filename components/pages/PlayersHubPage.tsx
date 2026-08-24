import { getCurrentRosterSeason, getPatsRoster } from '@/lib/data/players-hub';
import { getSeasonContext } from '@/lib/data/current-season';
import { HistoricalMarker } from '@/components/HistoricalMarker';
import { RosterBrowser } from '@/components/players/RosterBrowser';
import { SeasonNotice } from '@/components/SeasonNotice';

// E11: shared players-hub template. Historical roster is a real feature —
// roster_snapshots hold every season (plan §2, §3.4). The current view
// keeps getCurrentRosterSeason (roster max), which stays correct through
// the preseason transition window (review finding #8 in players-hub DAL).

export async function PlayersHubPage({
  season,
  historical,
}: {
  /** Historical: the requested past season. Current: null → resolve from
   * the roster tables. */
  season: number | null;
  historical: boolean;
}) {
  const ctx = await getSeasonContext();
  const rosterSeason = historical ? season : await getCurrentRosterSeason('NE');
  const roster = rosterSeason != null ? await getPatsRoster(rosterSeason, 'NE') : [];

  return (
    <section className="flex flex-col gap-10 py-12 md:gap-14 md:py-16">
      {historical ? null : <SeasonNotice />}
      <header className="flex flex-col gap-4">
        <p
          className="font-mono text-2xs uppercase tracking-widest text-text-muted"
          data-testid="players-eyebrow"
        >
          {rosterSeason != null ? (
            <>
              <span className="tabular-nums">{rosterSeason}</span> SEASON ·{' '}
              {historical ? 'ROSTER' : 'CURRENT ROSTER'}
            </>
          ) : (
            'ROSTER · AWAITING DATA'
          )}
        </p>
        {historical && rosterSeason != null ? (
          <HistoricalMarker season={rosterSeason} current={ctx.season} />
        ) : null}
        <h1 className="max-w-4xl font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display">
          Patriots, the whole roster.
        </h1>
        <p className="max-w-prose text-base text-text-muted md:text-lg">
          {historical && rosterSeason != null
            ? `Every player on the ${rosterSeason} roster. Click through to a deep dive for quarterbacks, running backs, receivers, and tight ends.`
            : 'Every player on the current-season roster. Click through to a deep dive for quarterbacks, running backs, receivers, and tight ends. Offensive- and defensive-line + secondary cards link to their unit pages.'}
        </p>
      </header>

      {roster.length === 0 ? (
        <p className="max-w-prose text-sm text-text-muted">
          {historical
            ? `No roster snapshots recorded for ${season}.`
            : 'Roster data unavailable — check back after the next ETL run.'}
        </p>
      ) : (
        <RosterBrowser
          roster={roster}
          seasonQuery={historical ? rosterSeason : null}
        />
      )}
    </section>
  );
}
