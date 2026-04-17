import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable}`}
    >
      <body className="min-h-screen bg-bg text-text antialiased">
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="mx-auto w-full max-w-content flex-1 px-4 md:px-6 lg:px-8">
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
