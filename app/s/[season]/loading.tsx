// E11: first hit on a historical page can be an on-demand ISR render
// (seconds). This skeleton gives sub-navigation into the /s tree an
// immediate response — the header pill's pending state covers switcher
// clicks, this covers card/nav/link entries. Minimal per DESIGN.md: no
// spinners, no shimmer, just the page rhythm in border tones.
export default function HistoricalLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading season"
      className="flex flex-col gap-10 py-8 md:gap-[60px] md:py-12"
    >
      <div className="flex flex-col gap-3">
        <div className="h-3 w-40 rounded-sm bg-surface-2" />
        <div className="h-8 w-72 max-w-full rounded-sm bg-surface-2 md:h-10" />
        <div className="h-3 w-56 max-w-full rounded-sm bg-surface" />
      </div>
      <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3 bg-bg p-6 md:p-8">
            <div className="h-3 w-24 rounded-sm bg-surface-2" />
            <div className="h-9 w-20 rounded-sm bg-surface" />
          </div>
        ))}
      </div>
    </section>
  );
}
