'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Suspense, useEffect, useId, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { SeasonSwitcher, SeasonSwitcherFallback } from '@/components/SeasonSwitcher';
import { parseSeasonParam } from '@/lib/season-view';

// Top nav links for the header. Team = home; Players = E7 hub; Draft + Coaching
// = E5 pages. Phases has no index page — links to the phase grid section on
// the home page via #phases anchor (component PhaseGrid carries the id).
// The season param rides every nav link while a past season is active —
// pages that are season-agnostic (Draft, Status) simply ignore it, so the
// context survives a detour and is still there when the visitor returns
// to a season-scoped page. (User decision, prototype round 3.)
type NavLink = { label: string; href: string; seasonAware: boolean };
const NAV_LINKS: ReadonlyArray<NavLink> = [
  { label: 'Team', href: '/', seasonAware: true },
  { label: 'Phases', href: '/#phases', seasonAware: true },
  { label: 'Players', href: '/players', seasonAware: true },
  { label: 'Draft', href: '/draft-roi', seasonAware: true },
  { label: 'Coaching', href: '/coaching', seasonAware: true },
];

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

/** Append ?season= to season-aware links while a past season is active, so
 * the context follows the visitor across pages. Hash links keep the hash
 * after the query. */
function decorate(href: string, seasonAware: boolean, season: string | null): Route {
  if (!seasonAware || season == null) return href as Route;
  const [path, hash] = href.split('#');
  return `${path}?season=${season}${hash ? `#${hash}` : ''}` as Route;
}

function useActiveSeasonParam(seasons: number[], current: number): string | null {
  const searchParams = useSearchParams();
  // Same predicate as the SeasonSwitcher pill — format + browsable-list
  // membership + not-current. Without the membership check the nav can
  // decorate with a calendar-year season the pill rejects (Jan–Aug), the
  // split-brain chrome from code review pass 2.
  const parsed = parseSeasonParam(searchParams.get('season'));
  return parsed != null && parsed !== current && seasons.includes(parsed)
    ? String(parsed)
    : null;
}

function DesktopNav({ seasons, current }: { seasons: number[]; current: number }) {
  const season = useActiveSeasonParam(seasons, current);
  return (
    <>
      {NAV_LINKS.map((link) => (
        <Link
          key={link.label}
          href={decorate(link.href, link.seasonAware, season)}
          className="font-mono text-2xs uppercase tracking-widest text-text-muted transition-colors hover:text-text focus-visible:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-positive"
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}

function MobileNavList({
  onNavigate,
  seasons,
  current,
}: {
  onNavigate: () => void;
  seasons: number[];
  current: number;
}) {
  const season = useActiveSeasonParam(seasons, current);
  return (
    <>
      {NAV_LINKS.map((link) => (
        <li key={link.label} className="border-b border-border last:border-b-0">
          <Link
            href={decorate(link.href, link.seasonAware, season)}
            onClick={onNavigate}
            className="flex min-h-[44px] items-center font-mono text-2xs uppercase tracking-widest text-text-muted transition-colors hover:text-text focus-visible:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-positive"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </>
  );
}

export function SiteHeader({
  currentSeason,
  seasons,
}: {
  currentSeason: number;
  seasons: number[];
}) {
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

        <div className="flex items-center gap-3 md:gap-5">
          <nav aria-label="Primary" className="hidden items-center gap-5 md:flex lg:gap-7">
            <Suspense fallback={<DesktopNavFallback />}>
              <DesktopNav seasons={seasons} current={currentSeason} />
            </Suspense>
          </nav>

          <Suspense fallback={<SeasonSwitcherFallback current={currentSeason} />}>
            <SeasonSwitcher current={currentSeason} seasons={seasons} />
          </Suspense>

          <button
            type="button"
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={open}
            aria-controls={panelId}
            data-testid="mobile-nav-toggle"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-positive md:hidden"
          >
            {open ? <CloseIcon /> : <HamburgerIcon />}
          </button>
        </div>
      </div>

      <nav
        id={panelId}
        aria-label="Primary mobile"
        data-testid="mobile-nav-panel"
        hidden={!open}
        className="border-t border-border bg-bg md:hidden"
      >
        <ul className="mx-auto flex w-full max-w-content flex-col px-4">
          <Suspense fallback={null}>
            <MobileNavList onNavigate={() => setOpen(false)} seasons={seasons} current={currentSeason} />
          </Suspense>
        </ul>
      </nav>
    </header>
  );
}

function DesktopNavFallback() {
  return (
    <>
      {NAV_LINKS.map((link) => (
        <Link
          key={link.label}
          href={link.href as Route}
          className="font-mono text-2xs uppercase tracking-widest text-text-muted transition-colors hover:text-text focus-visible:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-positive"
        >
          {link.label}
        </Link>
      ))}
    </>
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
