import Link from 'next/link';
import type { Route } from 'next';
import { getCurrentRosterSeason, getPatsRoster } from '@/lib/data/players-hub';
import { DataRailLive } from '@/components/DataRailLive';
import { HistoricalMarker } from '@/components/HistoricalMarker';
import { NoSeasonData } from '@/components/NoSeasonData';
import { PageHead, PageShell, RailBlock, RailRow } from '@/components/PageShell';
import { RosterBrowser } from '@/components/players/RosterBrowser';
import { SeasonNotice } from '@/components/SeasonNotice';
import type { RosterEntry } from '@/lib/data/players-hub';
import { UNIT_DISPLAY_NAMES, UNIT_SLUGS } from '@/lib/constants/units';

// E11: shared players-hub template. Historical roster is a real feature —
// roster_snapshots hold every season (plan §2, §3.4). The current view
// keeps getCurrentRosterSeason (roster max), which stays correct through
// the preseason transition window (review finding #8 in players-hub DAL).

export async function PlayersHubPage(
  props: { historical: true; season: number } | { historical: false; season: null },
) {
  const { season, historical } = props;
  const rosterSeason = historical ? season : await getCurrentRosterSeason('NE');
  const roster = rosterSeason != null ? await getPatsRoster(rosterSeason, 'NE') : [];

  return (
    <PageShell rail={<Rail roster={roster} />}>
      <section className="flex flex-col gap-8 md:gap-10">
        {historical ? null : <SeasonNotice />}
        <div>
          <PageHead
            testId="players-eyebrow"
            eyebrow={
              rosterSeason != null ? (
                <>
                  <span className="tabular-nums">{rosterSeason}</span> SEASON ·{' '}
                  {historical ? 'ROSTER' : 'CURRENT ROSTER'}
                </>
              ) : (
                'ROSTER · AWAITING DATA'
              )
            }
            title="Patriots, the whole roster."
            lede={
              historical && rosterSeason != null
                ? `Every player on the ${rosterSeason} roster. Skill positions open a deep dive.`
                : 'Skill positions open a deep dive. Line and secondary rows open their unit page.'
            }
            marker={
              historical && rosterSeason != null ? (
                <HistoricalMarker season={rosterSeason} backHref="/players" />
              ) : null
            }
          />
        </div>

        {roster.length === 0 ? (
          <NoSeasonData
            season={season ?? 0}
            variant={historical ? 'historical' : 'upcoming'}
            message={
              historical
                ? `No roster snapshots recorded for ${season}.`
                : 'Roster data unavailable — check back after the next ETL run.'
            }
          />
        ) : (
          <RosterBrowser roster={roster} seasonQuery={historical ? rosterSeason : null} />
        )}
      </section>
    </PageShell>
  );
}

/** Rail: the shape of the roster, and the units that have no per-player
 * page. The filter chips imply these counts; the rail states them. */
function Rail({ roster }: { roster: ReadonlyArray<RosterEntry> }) {
  const counts = new Map<string, number>();
  for (const p of roster) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  const rows: Array<[string, string]> = [
    ['Quarterback', 'QB'],
    ['Running back', 'RB'],
    ['Receiver / TE', 'WR+TE'],
    ['Offensive line', 'OL'],
    ['Defense', 'DEF'],
    ['Special teams', 'ST'],
  ];

  return (
    <>
      <RailBlock title="By position" note={`${roster.length} total`}>
        <dl className="space-y-2">
          {rows.map(([label, key]) => (
            <RailRow key={key} label={label} value={String(counts.get(key) ?? 0)} />
          ))}
        </dl>
      </RailBlock>
      <RailBlock title="Unit pages" note="no deep dive">
        <ul className="divide-y divide-border">
          {UNIT_LINKS.map((u) => (
            <li key={u.slug}>
              <Link
                href={u.href as Route}
                className="flex min-h-[44px] items-center py-2 text-xs text-text-muted transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive"
              >
                {u.label} →
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 font-mono text-2xs text-text-muted">
          Line and secondary play is measured as a unit, not per player.
        </p>
      </RailBlock>
      <DataRailLive />
    </>
  );
}

// Derived from the slug constant so a rail link cannot drift from a real
// route — the hand-written list had a /team/units/secondary that does not
// exist.
const UNIT_LINKS = UNIT_SLUGS.map((slug) => ({
  slug,
  label: UNIT_DISPLAY_NAMES[slug],
  href: `/team/units/${slug}`,
}));
