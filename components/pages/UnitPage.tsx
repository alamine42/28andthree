import Link from 'next/link';
import type { Route } from 'next';
import { UNIT_DISPLAY_NAMES, type UnitSlug } from '@/lib/constants/units';
import { getDefenseUnit, getDlUnit, getOlUnit } from '@/lib/data/units';
import { HistoricalMarker } from '@/components/HistoricalMarker';
import { SeasonNotice } from '@/components/SeasonNotice';
import { MetricCell } from '@/components/StatCell';
import { formatEpa, formatPercent } from '@/lib/format/number';

// E11: shared unit template. Clean route renders current season; the
// /s/[season] wrapper renders past seasons. Cells are null-safe (em-dash)
// so seasons without unit rows render blank, never crash. Plan §3.4.

const TEAM = 'NE' as const;

export async function UnitPage({
  unit,
  season,
  historical,
}: {
  unit: UnitSlug;
  season: number;
  historical: boolean;
}) {
  const display = UNIT_DISPLAY_NAMES[unit];

  return (
    <section className="flex flex-col gap-16 py-12 md:gap-[120px] md:py-16">
      {historical ? null : <SeasonNotice />}
      <nav
        aria-label="Breadcrumb"
        className="font-mono text-2xs uppercase tracking-widest text-text-muted"
      >
        <Link
          href={(historical ? `/?season=${season}` : '/') as Route}
          className="inline-flex min-h-[44px] items-center underline underline-offset-4 decoration-border-strong hover:decoration-text hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive"
        >
          Season overview
        </Link>
        <span className="mx-2 text-text-muted">/</span>{' '}
        Team units <span className="mx-2 text-text-muted">/</span>
        <span className="text-text">{display}</span>
      </nav>

      <header className="flex flex-col gap-3">
        {historical ? (
          <HistoricalMarker season={season} backHref={`/team/units/${unit}`} />
        ) : null}
        <h1 className="font-display text-3xl font-bold tracking-tightest text-text md:text-display">
          {display} unit
        </h1>
        <p className="font-mono text-xs text-text-muted">
          Team-level aggregates · <span className="tabular-nums">{season}</span> regular
          season · New England
        </p>
      </header>

      {await renderUnit(unit, season)}

      <MethodologyCallout unit={unit} />
    </section>
  );
}

async function renderUnit(unit: UnitSlug, season: number) {
  if (unit === 'defense') {
    const stats = await getDefenseUnit(TEAM, season);
    return (
      <dl
        className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-4"
        data-testid="unit-hero"
      >
        <MetricCell label="Pressure rate" value={stats?.pressureRate ?? null} format={formatPercent} />
        <MetricCell label="Coverage EPA allowed" value={stats?.coverageEpaAllowed ?? null} format={formatEpa} />
        <MetricCell label="Run stop rate" value={stats?.runStopRate ?? null} format={formatPercent} />
        <MetricCell
          label="Explosives allowed"
          value={stats?.explosivePlaysAllowed ?? null}
          format={(v) => (v == null ? '—' : String(v))}
        />
      </dl>
    );
  }
  if (unit === 'offensive-line') {
    const stats = await getOlUnit(TEAM, season);
    return (
      <dl
        className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-4"
        data-testid="unit-hero"
      >
        <MetricCell label="Pass block win %" value={stats?.passBlockWinRate ?? null} format={formatPercent} />
        <MetricCell label="Run block rate" value={stats?.runBlockRate ?? null} format={formatPercent} />
        <MetricCell
          label="Pressures allowed"
          value={stats?.pressuresAllowed ?? null}
          format={(v) => (v == null ? '—' : String(v))}
        />
        <MetricCell label="EPA on dropbacks" value={stats?.epaOnDropbacks ?? null} format={formatEpa} />
      </dl>
    );
  }
  // unit === 'defensive-line'
  const stats = await getDlUnit(TEAM, season);
  return (
    <dl
      className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-4"
      data-testid="unit-hero"
    >
      <MetricCell
        label="Pressures generated"
        value={stats?.pressuresGenerated ?? null}
        format={(v) => (v == null ? '—' : String(v))}
      />
      <MetricCell label="Pass rush win %" value={stats?.passRushWinRate ?? null} format={formatPercent} />
      <MetricCell label="Run stop rate" value={stats?.runStopRate ?? null} format={formatPercent} />
      <MetricCell label="Sack rate" value={stats?.sackRate ?? null} format={formatPercent} />
    </dl>
  );
}


function MethodologyCallout({ unit }: { unit: UnitSlug }) {
  // Per SPEC §3.3 the defense page must prominently disclose that individual
  // defender ratings are deferred. Keep the callout on OL + DL too for
  // symmetry + methodology transparency (proxy win rates noted).
  const defenseNote = unit === 'defense';
  return (
    <aside className="flex flex-col gap-2 rounded-sm border-l-2 border-positive bg-surface px-4 py-3">
      <p className="font-mono text-2xs uppercase tracking-widest text-positive">Methodology</p>
      {defenseNote ? (
        <p className="max-w-prose text-sm text-text">
          Individual defender ratings are deferred for v1 — participation data from public
          nflverse sources is insufficient to produce reliable per-player numbers without PFF
          grades (not in scope). Better to ship nothing than ship bad defensive numbers.
        </p>
      ) : (
        <p className="max-w-prose text-sm text-text">
          Pass-block and pass-rush &quot;win&quot; rates use nflverse pressure flags as a proxy —
          they align with but are not identical to ESPN&apos;s win-rate stat. Run-block and run-stop
          rates use the 3-yard / 2-yard yardage thresholds.
        </p>
      )}
    </aside>
  );
}
