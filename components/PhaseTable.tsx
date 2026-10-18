import Link from 'next/link';
import type { Route } from 'next';
import { Sparkline } from '@/components/charts/Sparkline';
import { MetricValue } from '@/components/numeric';
import { rankTier } from '@/lib/color/rank';
import { PHASES, type Phase } from '@/lib/constants/phases';
import type { PatsSparklines, PhaseSnapshot } from '@/lib/data/phases';
import { formatEpa, formatRank } from '@/lib/format/number';
import { phaseDisplayName } from '@/lib/format/phase';
import { withSeason } from '@/lib/season-view';

type Props = {
  snapshot: ReadonlyArray<PhaseSnapshot>;
  sparklines: PatsSparklines;
  /** Past season in view, appended to row links as ?season=. */
  seasonQuery?: number | null;
};

// E13 direction B. Replaces PhaseGrid: eleven equally-weighted padded cards
// became eleven dense rows. The grid cost a full screen of vertical space,
// left an orphan twelfth cell lit by the gap-px border background, and gave
// red-zone defence the same visual weight as the headline rank. Rows fit the
// same data in roughly half the height, align the ranks and EPA values into
// scannable columns, and add a league-position marker that a bare ordinal
// cannot carry.
//
// Each row is ONE link spanning the full width, laid out with CSS grid rather
// than a <table>. That matters for more than tidiness: the card this replaces
// wrapped the phase name *and* its rank, and the E2E suite reaches the rank
// through `getByTestId('phase-card-<slug>').locator('[data-numeric]')`. A real
// table puts the rank in a sibling <td>, outside the link, which silently
// breaks that lookup and leaves only the name clickable. One row-wide link
// keeps the contract, keeps the whole row a single tap target, and keeps the
// columns aligned.

// `overall` is the hero stat at the top of the page; repeating it here
// double-counts it against the eleven phase-specific ranks.
const TABLE_PHASES = PHASES.filter((p) => p !== 'overall');

// Shared column track, so the header labels line up with every row.
//
// Phones keep name, rank, EPA and the sparkline — the card this replaced
// showed all four, and dropping two of them would have made the overview
// strictly less useful on the device most people read it on. Only the
// league-position bar waits for sm: it is the one column that needs real
// width to mean anything, and it is the only one with no equivalent on
// the old card.
const COLUMNS =
  'grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 sm:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_5rem_4.5rem] sm:gap-x-4';

export function PhaseTable({ snapshot, sparklines, seasonQuery }: Props) {
  const byPhase = new Map<Phase, PhaseSnapshot>(snapshot.map((s) => [s.phase, s]));

  return (
    <section id="phases" className="flex scroll-mt-20 flex-col gap-3" data-testid="phase-grid">
      <h2 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        League rank across phases
      </h2>

      <div
        aria-hidden="true"
        className={`${COLUMNS} border-b border-border-strong px-3 py-2 font-mono text-2xs uppercase tracking-widest text-text-muted`}
      >
        <span>Phase</span>
        <span className="text-right">Rank</span>
        <span className="text-right">EPA/play</span>
        <span className="text-right">Trend</span>
        <span className="hidden text-right sm:block">League</span>
      </div>

      <ul className="flex flex-col">
        {TABLE_PHASES.map((phase) => {
          const s = byPhase.get(phase);
          const rank = s?.rank ?? null;
          const tier = rankTier(rank);
          const values = (sparklines.get(phase) ?? []).map((p) => p.value);
          const display = phaseDisplayName(phase);
          return (
            <li key={phase} className="border-b border-border">
              <Link
                href={withSeason(`/phases/${phase}`, seasonQuery) as Route}
                data-testid={`phase-card-${phase}`}
                className={`${COLUMNS} min-h-[44px] px-3 py-3 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive`}
              >
                <span className="min-w-0 truncate text-sm text-text">{display}</span>

                <span className="flex items-baseline justify-end gap-2">
                  <RankCell rank={rank} />
                  {s?.insufficientSample ? (
                    <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
                      n &lt; 30
                    </span>
                  ) : null}
                </span>

                <MetricValue
                  value={s?.epaPerPlay ?? null}
                  format={formatEpa}
                  className="text-right text-xs text-text sm:text-sm"
                />

                <span className="flex justify-end">
                  {values.length > 0 ? (
                    <Sparkline
                      values={values}
                      tier={tier}
                      title={`${display} weekly trend, last ${values.length} weeks`}
                      width={72}
                      height={18}
                    />
                  ) : null}
                </span>

                <span className="hidden sm:block">
                  <RankBar rank={rank} label={display} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Compact tier-coloured rank, the row-density counterpart to the
 * display-sized RankNumber. Unlike RankNumber this does colour the
 * bottom-third tier: at 13px among ten other ranks the colour is the only
 * thing that makes a weak phase findable, and it is not the alarmist
 * 56px-cranberry the display size would be. */
function RankCell({ rank }: { rank: number | null }) {
  const tier = rankTier(rank);
  const color =
    tier === 'positive'
      ? 'text-positive'
      : tier === 'negative'
        ? 'text-negative'
        : 'text-text-muted';
  return (
    <span data-numeric="true" data-tier={tier} className={`font-mono text-sm tabular-nums ${color}`}>
      {formatRank(rank)}
    </span>
  );
}

/** Position on the 32-team line. The ordinal says "30th"; this says how far
 * down the league that actually sits, without a second number. */
function RankBar({ rank, label }: { rank: number | null; label: string }) {
  if (rank == null) return null;
  const tier = rankTier(rank);
  const fill =
    tier === 'positive' ? 'bg-positive' : tier === 'negative' ? 'bg-negative' : 'bg-chart-neutral';
  const pct = ((rank - 1) / 31) * 100;
  return (
    <span
      className="relative block h-1 w-full bg-border"
      role="img"
      aria-label={`${label}: ${formatRank(rank)} of 32`}
    >
      <span
        className={`absolute top-0 h-1 ${fill}`}
        style={{ left: `calc(${pct}% - 2px)`, width: '4px' }}
      />
    </span>
  );
}
