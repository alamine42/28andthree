import type { DraftRoiRow } from '@/lib/data/draft';
import { bucketForPosition } from '@/lib/format/position-bucket';
import { playerHref, roleFor } from '@/lib/format/player-routes';
import { SeasonCarryLink } from '@/components/SeasonCarryLink';
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
      id={`class-${draftSeason}`}
      data-testid={`draft-class-${draftSeason}`}
      className="flex scroll-mt-24 flex-col gap-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border-strong pb-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-2xl font-bold tracking-tightest text-text md:text-3xl">
            {draftSeason} class
          </h2>
          <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
            {rows.length} {rows.length === 1 ? 'PICK' : 'PICKS'}
          </p>
        </div>
        <p
          data-testid={`draft-class-summary-${draftSeason}`}
          className="flex items-center gap-2 font-mono text-2xs uppercase tracking-widest"
        >
          <span className={summary.hit === 0 ? 'text-text-muted' : 'text-positive'}>
            {summary.hit} HIT
          </span>
          <span className="text-text-muted">·</span>
          <span className="text-text-muted">{summary.fair} FAIR</span>
          <span className="text-text-muted">·</span>
          <span className={summary.miss === 0 ? 'text-text-muted' : 'text-text'}>
            {summary.miss} MISS
          </span>
          {summary.pending > 0 ? (
            <>
              <span className="text-text-muted">·</span>
              <span className="text-text-muted">{summary.pending} PENDING</span>
            </>
          ) : null}
        </p>
      </header>

      <ul className="flex flex-col">
        {rows.map((r) => (
          <PickRow key={`${r.draftSeason}-${r.pickOverall}`} row={r} />
        ))}
      </ul>
    </section>
  );
}

function PickRow({ row: r }: { row: DraftRoiRow }) {
  const bucket = r.position ? bucketForPosition(r.position) : null;
  const unitProxy = bucket ? UNIT_PROXY_BUCKETS.has(bucket) : false;
  const ratio = computeRatio(r.actualValue, r.expectedValue);
  const ratioTitle =
    ratio !== null && Math.abs(ratio) > 9.99
      ? `Exact ratio ${ratio.toFixed(2)} (display clamped)`
      : 'Actual value \u00F7 Slot-expected value';
  return (
    <li
      data-testid={`draft-pick-${r.pickOverall}`}
      className={`grid items-center gap-3 border-b border-border py-3 last:border-b-0 transition-colors hover:bg-surface ${ROW_GRID}`}
    >
      {/* Column 1: pick # — always visible; includes round on mobile */}
      <span className="flex flex-col gap-0.5 font-mono text-xs text-text-muted tabular-nums">
        <span className="text-text">#{r.pickOverall}</span>
        <span className="text-2xs uppercase tracking-widest text-text-muted md:hidden">
          R{r.round}
        </span>
      </span>

      {/* Column 2: player name + position */}
      <span className="flex min-w-0 flex-col">
        {r.gsisId && r.position ? (
          <PlayerLink row={r} />
        ) : (
          <span className="truncate text-text-muted">
            {r.tradedTo ? `Traded to ${r.tradedTo}` : 'Unassigned'}
          </span>
        )}
        <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          {r.position ?? '\u2014'}
          {r.tradedTo && r.gsisId ? ` · traded ${r.tradedTo}` : ''}
        </span>
      </span>

      {/* Column 3 (desktop only): round */}
      <span className="hidden font-mono text-2xs uppercase tracking-widest text-text-muted md:inline">
        R{r.round}
      </span>

      {/* Column 4 (desktop only): actual / expected pair */}
      <span
        className="hidden font-mono text-xs text-text-muted tabular-nums md:block"
        title="Actual value / Slot-expected value"
      >
        {formatValuePair(r)}
      </span>

      {/* Column 5: ratio — compact on all breakpoints */}
      <span
        data-numeric="true"
        className={`font-mono text-xs tabular-nums ${ratioToneClass(ratio)} justify-self-end`}
        title={ratioTitle}
      >
        {formatRatio(ratio)}
      </span>

      {/* Column 6: grade badge */}
      <GradeBadge grade={r.grade} unitProxy={unitProxy} />
    </li>
  );
}

// 6-col on desktop, 4-col on mobile (round folded into col 1; value pair hidden).
const ROW_GRID =
  'grid-cols-[3.25rem_minmax(0,1fr)_3rem_auto] md:grid-cols-[3.25rem_minmax(0,2fr)_2.5rem_minmax(0,1fr)_3.5rem_auto]';

function PlayerLink({ row }: { row: DraftRoiRow }) {
  if (!row.gsisId) return <span>{row.displayName ?? '\u2014'}</span>;
  const role = roleFor(row.position);
  const href = playerHref({ role, gsisId: row.gsisId });
  const label = row.displayName ?? row.gsisId;
  if (href === null) return <span className="truncate text-text">{label}</span>;
  // SeasonCarryLink keeps an active historical context through the draft
  // detour (code review pass 2) without making this static page dynamic.
  return (
    <SeasonCarryLink
      href={href}
      className="truncate font-display text-base font-bold text-text transition-colors hover:text-positive focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive"
    >
      {label}
    </SeasonCarryLink>
  );
}

function formatValuePair(row: DraftRoiRow): string {
  const fmt = (v: number | null) => (v === null ? '\u2014' : v.toFixed(1));
  return `${fmt(row.actualValue)} / ${fmt(row.expectedValue)}`;
}

function computeRatio(
  actual: number | null,
  expected: number | null,
): number | null {
  if (actual === null || expected === null) return null;
  if (expected === 0) return null;
  return actual / expected;
}

function formatRatio(ratio: number | null): string {
  if (ratio === null) return '\u2014';
  // Clamp extreme ratios so column width stays stable on rookie outliers;
  // title attr carries the exact value when clamped.
  const clamped = Math.max(-9.99, Math.min(9.99, ratio));
  const sign = ratio < 0 ? '\u2212' : '';
  const prefix = Math.abs(ratio) > 9.99 ? '>' : '';
  return `${prefix}${sign}${Math.abs(clamped).toFixed(2)}\u00D7`;
}

function ratioToneClass(ratio: number | null): string {
  // Positive ratios (HIT range) get the green tint — passes AA on both bg
  // and surface. MISS ratios stay on --text rather than --negative even
  // though --negative now passes AA (see DESIGN.md 2026-04-26). The MISS
  // signal is carried by the adjacent GradeBadge + the summary header
  // count; the ratio cell shows the exact magnitude in bone for column
  // scannability. Same routing pattern as numeric.tsx.
  if (ratio === null) return 'text-text-muted';
  if (ratio >= 1.25) return 'text-positive';
  return 'text-text';
}
