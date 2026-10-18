import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AgentationToolbar } from '@/components/sandbox/AgentationToolbar';
import { SandboxBanner } from '@/components/sandbox/SandboxBanner';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getSeasonContext } from '@/lib/data/current-season';
import { browsableSeasons } from '@/lib/season-view';
import { display, geistMono, geistSans } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '28 and Three — New England Patriots analytics',
    template: '%s · 28 and Three',
  },
  description:
    'Advanced analytics for the New England Patriots: team EPA across phases, player deep dives, draft ROI, coaching tendencies. Built for fans who read the box score twice.',
  applicationName: '28 and Three',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://28andthree.com'),
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Season list for the header switcher. Fully static renders (404 page)
  // bake the list at build with the DB fallback — accepted: the header on
  // an error page carrying last deploy's list is harmless, and every
  // season-scoped page revalidates. getSeasonContext catches DB errors
  // and degrades to a fallback season, so neither builds nor renders can
  // fail on this call (code review passes 1+2).
  const ctx = await getSeasonContext();
  const seasons = browsableSeasons(ctx.season);
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${display.variable}`}>
      <body className="min-h-screen bg-bg text-text antialiased">
        <SandboxBanner />
        <div className="flex min-h-screen flex-col">
          <SiteHeader currentSeason={ctx.season} seasons={seasons} />
          {/* E13: width and gutter moved into PageShell / ProseShell so a
              data page can run to 1600px with a rail while an editorial
              page stays at the 1240px prose measure. */}
          <main className="w-full flex-1">{children}</main>
          <SiteFooter />
        </div>
        <AgentationToolbar />
      </body>
    </html>
  );
}
