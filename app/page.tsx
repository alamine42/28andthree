export default function HomePage() {
  return (
    <section className="flex min-h-[60vh] flex-col items-start justify-center gap-4 py-24">
      <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
        Season starts soon
      </p>
      <h1 className="font-display text-3xl font-bold tracking-tighter text-text md:text-display">
        Something worth reading twice.
      </h1>
      <p className="max-w-prose text-base text-text-muted">
        Advanced analytics for the New England Patriots — team phases, player deep dives, draft
        ROI, and coaching tendencies. Built for fans who read the box score twice.
      </p>
    </section>
  );
}
