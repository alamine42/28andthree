import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { SEASON } from '@/lib/proto/data';
import { Eyebrow, ProtoBanner } from '../_components/shared';

// Direction B's shell, shared by every screen so the chrome is identical
// across the set. Three things define it:
//   1. The top nav and the editorial voice survive unchanged.
//   2. No hero on data pages — eyebrow, one display line, one lede line.
//   3. A 320px right rail takes the secondary content that used to stack
//      below the fold, and the content cap goes 1240 → 1600 so the rail is
//      additive rather than a squeeze on the main column.

/** Nav wired to the prototype screens, so the flow between them is real. */
const PROTO_NAV = [
  { label: 'Team', href: '/proto/b' },
  { label: 'Phases', href: '/proto/b/phase' },
  { label: 'Players', href: '/proto/b/players' },
  { label: 'Draft', href: '/proto/b/draft' },
  { label: 'Coaching', href: '/proto/b/coaching' },
  { label: 'Trends', href: '/proto/b/trends' },
] as const;

export function BShell({
  active,
  children,
  rail,
  screen,
}: {
  active: string;
  children: ReactNode;
  rail: ReactNode;
  /** Shown in the prototype banner so a screenshot says which screen it is. */
  screen: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <ProtoBanner variant={`B · ${screen}`} />
      <TopNav active={active} />
      <div className="mx-auto w-full max-w-[1600px] flex-1 px-6 py-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0">{children}</main>
          <aside className="flex flex-col gap-8">{rail}</aside>
        </div>
      </div>
    </div>
  );
}

function TopNav({ active }: { active: string }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-8 px-6 py-4">
        <Link
          href={'/proto/b' as Route}
          className="font-display text-lg font-bold tracking-tighter text-text"
        >
          28 <em className="not-italic text-positive">and</em> Three
        </Link>
        <nav className="hidden gap-6 md:flex">
          {PROTO_NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href as Route}
              className={`font-mono text-2xs uppercase tracking-widest ${
                item.label === active ? 'text-text' : 'text-text-muted hover:text-text'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto inline-flex items-center gap-1 border border-border-strong px-2 py-1 font-mono text-2xs text-text">
          {SEASON} ▾
        </span>
      </div>
    </header>
  );
}

/** The page head that replaces the hero. Compare with the live site, where
 * a 56px display line plus a three-line paragraph costs ~280px before the
 * first number. This is the whole of it. */
export function PageHead({
  eyebrow,
  title,
  lede,
  marker,
  breadcrumb,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  /** Historical chip or small-sample caution — state that must stay visible. */
  marker?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {breadcrumb}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tighter text-text">
            {title}
          </h1>
        </div>
        {lede ? <p className="max-w-[46ch] text-sm text-text-muted">{lede}</p> : null}
      </div>
      {marker ? <div className="mt-3">{marker}</div> : null}
    </div>
  );
}

export function Breadcrumb({
  trail,
  current,
}: {
  trail: { label: string; href: string }[];
  current: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-3 flex items-center font-mono text-2xs uppercase tracking-widest text-text-muted"
    >
      {trail.map((t) => (
        <span key={t.href} className="flex items-center">
          <Link
            href={t.href as Route}
            className="underline decoration-border-strong underline-offset-4 hover:text-text hover:decoration-text"
          >
            {t.label}
          </Link>
          <span className="mx-2">/</span>
        </span>
      ))}
      <span className="text-text">{current}</span>
    </nav>
  );
}

/** Rail block. Every rail item is a heading plus a tight body — the rail is
 * for reference, never for primary reading. */
export function RailBlock({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between border-b border-border pb-2">
        <Eyebrow>{title}</Eyebrow>
        {note ? <span className="font-mono text-2xs text-text-dim">{note}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function RailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 font-mono text-2xs">
      <dt className="uppercase tracking-widest text-text-muted">{label}</dt>
      <dd className="tabular-nums text-text">{value}</dd>
    </div>
  );
}

/** Data-freshness block. Appears in the rail on every screen: the live site
 * buries this in the footer, where a reader checking whether a number is
 * current has to scroll past everything to find out. */
export function DataRail() {
  return (
    <RailBlock title="Data">
      <dl className="space-y-2">
        <RailRow label="Last refresh" value="Tue 10:06 AM ET" />
        <RailRow label="Next ETL" value="Tue 14:00 UTC" />
        <RailRow label="Source" value="nflverse" />
      </dl>
      <Link
        href={'/methodology' as Route}
        className="mt-3 inline-block border-l-2 border-positive bg-surface px-3 py-2 text-xs text-text-muted hover:text-text"
      >
        How these numbers are computed →
      </Link>
    </RailBlock>
  );
}
