import type { ReactNode } from 'react';

// Sparse, copy-forward empty state. No illustrations, no icons —
// DESIGN.md anti-pattern is decorative imagery in admin UI. Just a clear
// sentence about what's missing and how to fix it.

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-sm border border-dashed border-border bg-surface px-4 py-6">
      <p className="font-mono text-xs text-text">{title}</p>
      {hint ? <p className="font-mono text-2xs text-text-muted">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
