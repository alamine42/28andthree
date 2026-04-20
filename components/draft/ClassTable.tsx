import Link from 'next/link';
import type { Route } from 'next';
import type { DraftRoiRow } from '@/lib/data/draft';
import { bucketForPosition } from '@/lib/format/position-bucket';
import { playerHref, roleFor } from '@/lib/format/player-routes';
import { GradeBadge } from './GradeBadge';

type Props = {
  draftSeason: number;
  rows: ReadonlyArray<DraftRoiRow>;
  summary: { hit: number; fair: number; miss: number; pending: number };
};

// "Unit-proxy" modifier applies to the non-skill buckets where grading is
// team-unit-level (review finding #4). Kept as a prop on the badge so the
// asterisk + tooltip are co-located with the grade.
const UNIT_PROXY_BUCKETS = new Set(['OL', 'DL', 'LB', 'DB']);

export function ClassTable({ draftSeason, rows, summary }: Props) {
  return (
    <section
      data-testid={`draft-class-${draftSeason}`}
      className="flex flex-col gap-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
        <h2 className="font-display text-2xl font-bold tracking-tightest text-text md:text-3xl">
          {draftSeason} class
        </h2>
        <p
          data-testid={`draft-class-summary-${draftSeason}`}
          className="font-mono text-2xs uppercase tracking-widest text-text-muted"
        >
          {summary.hit} HIT · {summary.fair} FAIR · {summary.miss} MISS
          {summary.pending > 0 ? ` · ${summary.pending} PENDING` : ''}
        </p>
      </header>

      <ul className="flex flex-col">
        {rows.map((r) => (
          <li
            key={`${r.draftSeason}-${r.pickOverall}`}
            data-testid={`draft-pick-${r.pickOverall}`}
            className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3 last:border-b-0 md:grid-cols-[3rem_minmax(0,2fr)_3rem_minmax(0,1fr)_auto]"
          >
            <span className="font-mono text-xs text-text-muted tabular-nums">
              #{r.pickOverall}
            </span>
            <span className="flex min-w-0 flex-col">
              {r.gsisId && r.position ? (
                <PlayerLink row={r} />
              ) : (
                <span className="truncate text-text-muted">
                  {r.tradedTo ? `Traded to ${r.tradedTo}` : 'Unassigned'}
                </span>
              )}
              <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
                {r.position ?? '—'}
                {r.tradedTo && r.gsisId ? ` · traded ${r.tradedTo}` : ''}
              </span>
            </span>
            <span className="hidden font-mono text-2xs uppercase tracking-widest text-text-muted md:inline">
              R{r.round}
            </span>
            <span className="hidden font-mono text-xs text-text-muted tabular-nums md:block">
              {formatValuePair(r)}
            </span>
            <GradeBadge
              grade={r.grade}
              unitProxy={
                r.position
                  ? UNIT_PROXY_BUCKETS.has(bucketForPosition(r.position) ?? '')
                  : false
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlayerLink({ row }: { row: DraftRoiRow }) {
  if (!row.gsisId) return <span>{row.displayName ?? '—'}</span>;
  const role = roleFor(row.position);
  const href = playerHref({ role, gsisId: row.gsisId });
  const label = row.displayName ?? row.gsisId;
  if (href === null) return <span className="truncate text-text">{label}</span>;
  return (
    <Link href={href as Route} className="truncate font-display text-base font-bold text-text hover:text-positive">
      {label}
    </Link>
  );
}

function formatValuePair(row: DraftRoiRow): string {
  const fmt = (v: number | null) => (v === null ? '—' : v.toFixed(1));
  return `${fmt(row.actualValue)} / ${fmt(row.expectedValue)}`;
}
