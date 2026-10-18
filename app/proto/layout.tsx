import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { SANDBOX_ACTIVE } from '@/lib/sandbox';

// Layout-shape prototypes for the desktop redesign. Sandbox-only: these
// screens carry fabricated league data and must not be reachable in prod.
//
// The root layout wraps every route in a 1240px `<main>` with the site
// header and footer — the very constraints these prototypes exist to test.
// The style block below suppresses that chrome for /proto only, so the
// prototypes get the full viewport without restructuring app/layout.tsx
// into route groups for throwaway screens.
export default function ProtoLayout({ children }: { children: ReactNode }) {
  if (!SANDBOX_ACTIVE) notFound();
  return (
    <>
      {/* `!important` is load-bearing: the root layout sets the cap with
          Tailwind's `max-w-content` class, and a type-selector rule loses to
          a class on specificity. */}
      <style>{`
        body > div > header, body > div > footer { display: none !important; }
        body > div > main { max-width: none !important; padding: 0 !important; }
      `}</style>
      <div data-proto-root className="min-h-screen">
        {children}
      </div>
    </>
  );
}
