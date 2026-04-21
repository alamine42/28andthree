import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Not found',
  description: 'The page you asked for isn\u2019t here.',
  robots: { index: false, follow: false },
};

export default function NotFoundPage() {
  return (
    <section
      data-testid="not-found"
      className="flex flex-col gap-12 py-16 md:gap-16 md:py-24"
    >
      <header className="flex flex-col gap-5">
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          404 &middot; Not found
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display">
          Play not in the book.
        </h1>
        <p className="max-w-prose text-base text-text-muted md:text-lg">
          That URL doesn&rsquo;t resolve to anything on 28 and Three. Either
          you followed a stale link, the page got renamed, or the slug has a
          typo.
        </p>
      </header>

      <nav
        aria-label="Pick a landing spot"
        className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-3"
      >
        <NavCard
          href="/"
          eyebrow="Team"
          title="Season overview"
          caption="Phase ranks, record, weekly trend"
        />
        <NavCard
          href="/players"
          eyebrow="Players"
          title="Roster hub"
          caption="QB, skill, units"
        />
        <NavCard
          href="/methodology"
          eyebrow="Methodology"
          title="How it works"
          caption="Data sources, phase defs, grades"
        />
      </nav>
    </section>
  );
}

function NavCard({
  href,
  eyebrow,
  title,
  caption,
}: {
  href: '/' | '/players' | '/methodology';
  eyebrow: string;
  title: string;
  caption: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] flex-col gap-2 bg-bg p-6 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive md:p-8"
    >
      <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        {eyebrow}
      </span>
      <span className="font-display text-xl font-bold leading-tight tracking-tightest text-text md:text-2xl">
        {title}
      </span>
      <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        {caption}
      </span>
    </Link>
  );
}
