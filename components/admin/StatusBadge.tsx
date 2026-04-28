import type { AuthoringDraftStatus, AuthoringFactcheckStatus } from '@/db/schema';

// Status indicator pill: dot + uppercase label, mono. Inherits DESIGN.md
// pattern from public-site /status page: color carried by the dot, label in
// muted text.

const DRAFT_TONE: Record<AuthoringDraftStatus, string> = {
  draft: 'bg-text-muted',
  approved: 'bg-positive',
  exported: 'bg-text-dim',
  published: 'bg-positive',
  rejected: 'bg-negative',
  archived: 'bg-text-dim',
};

const FACTCHECK_TONE: Record<AuthoringFactcheckStatus, string> = {
  pass: 'bg-positive',
  fail: 'bg-negative',
  pending: 'bg-text-dim',
};

export function DraftStatusBadge({ status }: { status: AuthoringDraftStatus }) {
  return <Badge dot={DRAFT_TONE[status]} label={status} />;
}

export function FactcheckBadge({ status }: { status: AuthoringFactcheckStatus }) {
  return <Badge dot={FACTCHECK_TONE[status]} label={`factcheck: ${status}`} />;
}

function Badge({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-2xs uppercase tracking-widest text-text-muted">
      <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-pill ${dot}`} />
      {label}
    </span>
  );
}
