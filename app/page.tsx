const UPCOMING = [
  { label: 'Team + phase pages', eta: 'Sprint 3' },
  { label: 'Player deep dives', eta: 'Sprint 4' },
  { label: 'Draft ROI', eta: 'Sprint 5' },
  { label: 'Coaching tendencies', eta: 'Sprint 5' },
] as const;

export default function HomePage() {
  return (
    <section className="flex flex-col gap-16 py-16 md:gap-24 md:py-24 lg:py-32">
      <div className="flex flex-col gap-5">
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Season starts soon
        </p>
        <h1 className="max-w-5xl font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display lg:text-hero">
          Something worth reading twice.
        </h1>
        <p className="max-w-prose text-base text-text-muted md:text-lg">
          Advanced analytics for the New England Patriots — team phases, player deep dives, draft
          ROI, and coaching tendencies. Built for fans who read the box score twice.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <h2 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Shipping this season
        </h2>
        <ul className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {UPCOMING.map((item) => (
            <li key={item.label} className="flex flex-col gap-1 bg-bg p-4 md:p-6">
              <span className="font-mono text-2xs uppercase tracking-widest text-text-dim">
                {item.eta}
              </span>
              <span className="text-base text-text">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
