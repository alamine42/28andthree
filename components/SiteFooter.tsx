// Disclaimer text matches DESIGN.md §Footer verbatim. Do not modify without
// updating DESIGN.md and the e1.spec.ts assertion that reads it back.
const DISCLAIMER =
  '28 and Three — Independent fan project. Not affiliated with, endorsed by, or sponsored by the New England Patriots, the NFL, or any of its teams.';

type FooterProps = {
  lastRefreshIso?: string;
};

export function SiteFooter({ lastRefreshIso }: FooterProps = {}) {
  const lastRefreshDisplay = lastRefreshIso
    ? new Date(lastRefreshIso).toLocaleString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
        timeZoneName: 'short',
      })
    : 'never';

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
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="live-dot inline-block h-1.5 w-1.5 rounded-pill bg-positive"
            />
            <span>Last refresh: {lastRefreshDisplay}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
