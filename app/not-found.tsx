import Link from 'next/link';
import type { Metadata } from 'next';
import { DataRail } from '@/components/DataRail';
import { PageHead, PageShell, RailBlock } from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'Not found',
  description: 'The page you asked for isn\u2019t here.',
  robots: { index: false, follow: false },
};

export default function NotFoundPage() {
  return (
    <PageShell rail={<NotFoundRail />}>
      <section data-testid="not-found" className="flex flex-col gap-8 md:gap-12">
        <PageHead
          eyebrow="404 · Not found"
          title="Play not in the book."
          lede="That URL doesn't resolve. Either the link is stale, the page was renamed, or the slug has a typo."
        />

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
    </PageShell>
  );
}

/** Why a URL stops resolving on this site, specifically. Generic 404 copy
 * cannot tell a reader that a departed player's clean URL 404s while the
 * season-scoped one still works — and that is the case people hit. */
function NotFoundRail() {
  return (
    <>
      <RailBlock title="Common causes">
        <ul className="space-y-2 text-xs text-text-muted">
          <li>A phase slug that no longer exists.</li>
          <li>
            A player who left the roster — their clean URL 404s, but the season-scoped one still
            resolves.
          </li>
          <li>A season before 2020, which the data does not cover.</li>
        </ul>
      </RailBlock>
      <DataRail />
    </>
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
