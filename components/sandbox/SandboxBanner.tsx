import { SANDBOX_ACTIVE } from '@/lib/sandbox';

// Top-of-page banner that renders only when sandbox mode is active.
// Rendered from RootLayout so every page picks it up. When sandbox is
// off (prod), SANDBOX_ACTIVE is false and this returns null — the
// empty-stub alias also erases the module from the bundle.
export function SandboxBanner() {
  if (!SANDBOX_ACTIVE) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-sandbox-banner
      className="sticky top-0 z-50 w-full border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-amber-200"
    >
      Sandbox mode — fixture data, not production
    </div>
  );
}
