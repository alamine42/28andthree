import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import type { ReactNode } from 'react';

// Studio shell. Top bar with brand + logout. Sidebar nav on desktop;
// horizontal scroll-tab nav on mobile. Pure DESIGN.md tokens — no decoration.

const NAV: ReadonlyArray<{ label: string; href: Route; abbr: string }> = [
  { label: 'Dashboard', href: '/admin' as Route, abbr: 'Home' },
  { label: 'Drafts', href: '/admin/drafts' as Route, abbr: 'Drafts' },
  { label: 'Backlog', href: '/admin/backlog' as Route, abbr: 'Backlog' },
  { label: 'Schedule', href: '/admin/schedule' as Route, abbr: 'Sched' },
  { label: 'Voice', href: '/admin/voice' as Route, abbr: 'Voice' },
  { label: 'Telemetry', href: '/admin/telemetry' as Route, abbr: 'Telem' },
];

async function logoutAction(): Promise<void> {
  'use server';
  const cookieStore = await cookies();
  cookieStore.delete('28t_admin_session');
  redirect('/admin/login' as Route);
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-bg/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
        <Link
          href={'/admin' as Route}
          className="whitespace-nowrap font-display text-base font-bold tracking-tighter text-text"
        >
          28 and Three / <span className="text-text-muted">studio</span>
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="font-mono text-2xs uppercase tracking-widest text-text-muted transition-colors hover:text-text"
          >
            Logout
          </button>
        </form>
      </header>

      {/* Mobile: horizontal-scroll tab strip below the header. Hidden on md+. */}
      <nav
        aria-label="Admin (mobile)"
        className="sticky top-12 z-30 flex overflow-x-auto border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80 md:hidden"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap px-4 py-3 font-mono text-2xs uppercase tracking-widest text-text-muted transition-colors hover:text-text"
          >
            {item.abbr}
          </Link>
        ))}
      </nav>

      <div className="flex">
        {/* Desktop: persistent sidebar. */}
        <nav
          aria-label="Admin"
          className="sticky top-12 hidden h-[calc(100vh-3rem)] w-44 shrink-0 flex-col border-r border-border py-4 md:flex"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-l-2 border-transparent px-4 py-2 font-mono text-2xs uppercase tracking-widest text-text-muted transition-colors hover:border-text hover:bg-surface hover:text-text"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
