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
      className="whitespace-nowrap font-display text-lg font-bold tracking-tighter text-text transition-colors hover:text-text md:text-xl"
      aria-label="28 and Three, home"
    >
      28 <em className="not-italic font-medium italic text-positive">and</em> Three
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/60">
      <div className="mx-auto flex h-14 w-full max-w-content items-center justify-between px-4 md:h-16 md:px-6 lg:px-8">
        <Wordmark />
        <nav aria-label="Primary" className="hidden items-center gap-5 md:flex lg:gap-7">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="font-mono text-2xs uppercase tracking-widest text-text-muted transition-colors hover:text-text focus-visible:text-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-positive"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
