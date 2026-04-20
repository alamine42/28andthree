import { getCurrentRosterSeason, getPatsRoster } from '@/lib/data/players-hub';
import { RosterBrowser } from '@/components/players/RosterBrowser';

export const revalidate = 3600;

export default async function PlayersHubPage() {
  const season = await getCurrentRosterSeason('NE');
  const roster = season != null ? await getPatsRoster(season, 'NE') : [];

  return (
    <section className="flex flex-col gap-10 py-12 md:gap-14 md:py-16">
      <header className="flex flex-col gap-4">
        <p
          className="font-mono text-2xs uppercase tracking-widest text-text-muted"
          data-testid="players-eyebrow"
        >
          {season != null ? `${season} SEASON · CURRENT ROSTER` : 'ROSTER · AWAITING DATA'}
        </p>
        <h1 className="max-w-4xl font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display">
          Patriots, the whole roster.
        </h1>
        <p className="max-w-prose text-base text-text-muted md:text-lg">
          Every player on the current-season roster. Click through to a deep
          dive for quarterbacks, running backs, receivers, and tight ends.
          Offensive- and defensive-line + secondary cards link to their unit
          pages.
        </p>
      </header>

      {roster.length === 0 ? (
        <p className="max-w-prose text-sm text-text-muted">
          Roster data unavailable — check back after the next ETL run.
        </p>
      ) : (
        <RosterBrowser roster={roster} />
      )}
    </section>
  );
}
