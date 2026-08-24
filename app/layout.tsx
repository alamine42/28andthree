import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AgentationToolbar } from '@/components/sandbox/AgentationToolbar';
import { SandboxBanner } from '@/components/sandbox/SandboxBanner';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getSeasonContext } from '@/lib/data/current-season';
import { EARLIEST_SEASON } from '@/lib/season-view';
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
  const ctx = await getSeasonContext();
  const seasons: number[] = [];
  for (let s = ctx.season; s >= EARLIEST_SEASON; s--) seasons.push(s);
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
