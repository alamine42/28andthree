'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useId, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { isSeasonScopedPath, parseSeasonParam } from '@/lib/season-view';

// E11-08: header season switcher (plan §2). A disclosure containing a
// list of real links — open-in-new-tab works, semantics are plain
// navigation (no ARIA listbox contract), Escape closes with focus
// returned to the pill. The pill turns green-bordered while a valid past
// season is in view; junk params are treated as absent (review CRITICAL:
// one strict validator everywhere). A pending state covers the first hit
// on a historical URL, which can be an on-demand ISR render.

type Props = {
  current: number;
  seasons: number[];
};

export function SeasonSwitcher({ current, seasons }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const parsed = parseSeasonParam(searchParams.get('season'));
  const season = parsed != null && seasons.includes(parsed) && parsed !== current ? parsed : current;
  const historical = season !== current;

  // The switcher acts on the page you are on; on a season-agnostic page
  // it targets the home page instead of appending an inert param
  // (plan §3.4 — no dead interaction).
  const targetPath = isSeasonScopedPath(pathname) ? pathname : '/';

  // Navigation landed — clear the pending state and close the menu.
  useEffect(() => {
    setPending(false);
    setOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        pillRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  function hrefFor(s: number): Route {
    return (s === current ? targetPath : `${targetPath}?season=${s}`) as Route;
  }

  function onLinkClick(e: React.MouseEvent) {
    // New-tab/window gestures: let the browser handle it, keep the menu
    // state untouched so the current page stays as-is.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    setOpen(false);
    setPending(true);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={pillRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-busy={pending || undefined}
        aria-label={`Season ${season}. Change season`}
        data-testid="season-switcher"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-sm border px-2 font-mono text-2xs uppercase tracking-widest transition-colors hover:border-text hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-positive ${
        historical ? 'border-positive text-text' : 'border-border-strong text-text-muted'
        } ${pending ? 'cursor-progress opacity-60' : ''}`}
      >
        <span className="tabular-nums">{season}</span>
        <Caret open={open} />
      </button>
      {open ? (
        <nav
          id={menuId}
          aria-label="Season"
          data-testid="season-switcher-menu"
          className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-border-strong bg-surface-2 shadow-lg"
        >
          <ul>
            {seasons.map((s) => (
              <li key={s} className="border-b border-border last:border-b-0">
                <Link
                  href={hrefFor(s)}
                  aria-current={s === season ? 'true' : undefined}
                  onClick={onLinkClick}
                  className={`flex min-h-[40px] w-full items-center justify-between px-3 font-mono text-2xs uppercase tracking-widest transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-positive ${
                    s === season ? 'text-text' : 'text-text-muted'
                  }`}
                >
                  <span className="tabular-nums">{s}</span>
                  <span className={s === current ? 'text-positive' : 'text-text-dim'}>
                    {s === current ? 'CURRENT' : 'FINAL'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

/** Static stand-in rendered while the Suspense boundary resolves — same
 * footprint as the live pill so the header never layout-shifts. */
export function SeasonSwitcherFallback({ current }: { current: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex min-h-[32px] items-center gap-1.5 rounded-sm border border-border-strong px-2 font-mono text-2xs uppercase tracking-widest text-text-muted"
    >
      <span className="tabular-nums">{current}</span>
      <Caret open={false} />
    </span>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 6"
      width="10"
      height="6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M1 1l4 4 4-4" />
    </svg>
  );
}
