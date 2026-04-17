import { Geist, Geist_Mono } from 'next/font/google';

// next/font/google inlines font files at build time — no runtime CDN requests.
// E1 ships Geist + Geist Mono. Cabinet Grotesk Bold for the wordmark will land
// when /public/fonts/CabinetGrotesk-Bold.woff2 is populated (see E1-02b handoff
// note in beads). Until then, Geist carries both the display and body roles.
//
// When Cabinet Grotesk arrives:
//  1. Drop WOFF2s into /public/fonts/
//  2. Replace the `display` export below with next/font/local pointing at them
//  3. Update the test expectation in tests/e2e/e1.spec.ts if needed

export const geistSans = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

// Alias Geist as the display font for now. Swap to Cabinet Grotesk via
// next/font/local when the WOFF2s are in place.
export const display = {
  variable: '--font-display',
  className: geistSans.className,
};
