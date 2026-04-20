'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { usePathname } from 'next/navigation';

// Top nav links for the header. Placeholder hrefs; real routes land in E5+.
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
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const pathname = usePathname();

  // Auto-close on route change so the panel doesn't linger after navigation.
  useEffect(() => setOpen(false), [pathname]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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

        <button
          type="button"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          aria-controls={panelId}
          data-testid="mobile-nav-toggle"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-positive md:hidden"
        >
          {open ? <CloseIcon /> : <HamburgerIcon />}
        </button>
      </div>

      <nav
        id={panelId}
        aria-label="Primary mobile"
        data-testid="mobile-nav-panel"
        hidden={!open}
        className="border-t border-border bg-bg md:hidden"
      >
        <ul className="mx-auto flex w-full max-w-content flex-col px-4">
          {NAV_LINKS.map((link) => (
            <li key={link.label} className="border-b border-border last:border-b-0">
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                className="block py-3 font-mono text-2xs uppercase tracking-widest text-text-muted transition-colors hover:text-text focus-visible:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-positive"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function HamburgerIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
