import type { ReactNode } from 'react';

// Page-header pattern reused across admin routes. Mono uppercase eyebrow
// over Cabinet Grotesk H1, matches DESIGN.md content conventions.

export function PageHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1 border-b border-border pb-3">
      {eyebrow ? (
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          {eyebrow}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-display text-xl font-bold tracking-tighter text-text md:text-2xl">
          {title}
        </h1>
        {meta ? (
          <div className="font-mono text-2xs uppercase tracking-widest text-text-muted">
            {meta}
          </div>
        ) : null}
      </div>
    </header>
  );
}
