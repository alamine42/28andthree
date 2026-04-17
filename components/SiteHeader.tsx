import Link from 'next/link';

// Top nav links for the header. Placeholder hrefs; real routes land in E3+.
const NAV_LINKS = [
  { label: 'Team', href: '/' },
  { label: 'Phases', href: '/' },
  { label: 'Players', href: '/' },
  { label: 'Draft', href: '/' },
  { label: 'Coaching', href: '/' },
] as const;

function Wordmark() {
  return (
    <Link
      href="/"
      data-testid="wordmark"
      className="font-display text-xl font-bold tracking-tighter text-text"
      aria-label="28 and Three, home"
    >
      28 <em className="not-italic font-medium italic text-positive">and</em> Three
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between px-4 md:px-6 lg:px-8">
        <Wordmark />
        <nav aria-label="Primary" className="flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="font-mono text-2xs uppercase tracking-widest text-text-muted transition-colors hover:text-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
