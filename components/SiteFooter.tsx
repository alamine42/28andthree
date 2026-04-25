import { getSchedulePhase } from '@/lib/schedule/phase';

// Disclaimer text matches DESIGN.md §Footer verbatim. Do not modify without
// updating DESIGN.md and the e1.spec.ts assertion that reads it back.
const DISCLAIMER =
  '28 and Three — Independent fan project. Not affiliated with, endorsed by, or sponsored by the New England Patriots, the NFL, or any of its teams.';

const NEXT_REFRESH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'America/New_York',
});

type FooterProps = {
  lastRefreshIso?: string;
};

export async function SiteFooter({ lastRefreshIso }: FooterProps = {}) {
  const snap = await getSchedulePhase();
  const isOffseason = snap.phase === 'offseason';

  const lastRefreshDisplay = lastRefreshIso
    ? new Date(lastRefreshIso).toLocaleString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
        timeZoneName: 'short',
      })
    : 'never';

  // Offseason: rephrase the freshness indicator + dim the live dot. Stops
  // implying staleness when the data is intentionally frozen until the
  // next ETL run after kickoff. When the next-season schedule isn't out
  // yet we say so explicitly — "Last refresh: never" reads as broken.
  const refreshLine = !isOffseason
    ? `Last refresh: ${lastRefreshDisplay}`
    : snap.nextGameDate
      ? `Next refresh after ${formatNextGameDate(snap.nextGameDate)} kickoff`
      : 'Offseason — next refresh after kickoff';
  const dotClassName = isOffseason
    ? 'inline-block h-1.5 w-1.5 rounded-pill bg-text-dim'
    : 'live-dot inline-block h-1.5 w-1.5 rounded-pill bg-positive';

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-content flex-col gap-3 px-4 py-6 md:px-6 lg:px-8">
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">{DISCLAIMER}</p>
        <div className="flex flex-col gap-2 font-mono text-2xs uppercase tracking-widest text-text-muted md:flex-row md:items-center md:justify-between">
          <span>
            Data:{' '}
            <a
              href="https://github.com/nflverse"
              className="text-text-muted hover:text-text"
              rel="noopener noreferrer"
              target="_blank"
            >
              nflverse
            </a>
            {' · '}model inputs: nflfastR &amp; nfl4th{' · '}
            <a
              href="/methodology"
              className="text-text-muted hover:text-text"
              data-testid="footer-methodology-link"
            >
              Methodology
            </a>
          </span>
          <span className="flex items-center gap-2" data-testid="footer-refresh-line">
            <span aria-hidden="true" className={dotClassName} />
            <span>{refreshLine}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

function formatNextGameDate(iso: string): string {
  // iso is YYYY-MM-DD in America/New_York from getSchedulePhase. Render as
  // "Sep 3" without re-parsing through Date (which would shift by tz).
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  // Construct a UTC date at noon — formatter pins to America/New_York,
  // and noon UTC stays on the same calendar day there year-round.
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return NEXT_REFRESH_FORMATTER.format(d);
}
