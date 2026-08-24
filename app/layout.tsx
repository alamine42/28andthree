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
  // season-scoped page revalidates. getSeasonContext degrades to a
  // fallback season when the DB is unreachable, so builds never fail on
  // this call (code review pass 1).
  const ctx = await getSeasonContext();
  const seasons = browsableSeasons(ctx.season);
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable}`}
    >
      <body className="min-h-screen bg-bg text-text antialiased">
        <SandboxBanner />
        <div className="flex min-h-screen flex-col">
          <SiteHeader currentSeason={ctx.season} seasons={seasons} />
          <main className="mx-auto w-full max-w-content flex-1 px-4 md:px-6 lg:px-8">
            {children}
          </main>
          <SiteFooter />
        </div>
        <AgentationToolbar />
      </body>
    </html>
  );
}
