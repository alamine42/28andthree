import { SectionHead } from '../../_components/shared';
import { BShell, DataRail, PageHead, RailBlock, RailRow } from '../_shell';
import { AwaitingEtl } from '../_states';

// Screen 6 — coaching, in the awaiting-ETL state it is actually in today.
// This is the state most worth getting right in direction B: with the hero
// gone, an empty screen has nothing to hide behind, so the shell has to
// make the wait legible rather than merely short.
export default function BCoaching() {
  return (
    <BShell active="Coaching" screen="Coaching · awaiting ETL" rail={<Rail />}>
      <PageHead
        eyebrow="2026 season · coaching tendencies"
        title="The tendencies that decide games."
        lede="Play-call splits, situational rates, score-state pressure, and the 4th-down ledger."
      />

      <AwaitingEtl
        title="Coaching data — awaiting ETL"
        body="The weekly coaching-tendency rollups have not been computed yet. Once the ingest runs you'll see per-coach play-call splits, situational rates, score-state pass rate, personnel groupings, and a 4th-down ledger against the nfl4th model."
        next="Next ETL: Tuesday 14:00 UTC · docs/runbook.md#etl-rollback"
      />

      {/* The sections that will fill, named while empty. An empty screen
          that lists what is coming is a different experience from an empty
          screen that only apologises. */}
      <section className="mt-8">
        <SectionHead note="empty until the ingest runs">What lands here</SectionHead>
        <ul className="divide-y divide-border border-y border-border">
          {[
            ['Play-call mix', 'Pass and run rate by down, distance and personnel'],
            ['Situational grid', 'Red zone, 3rd and long, two-minute'],
            ['Score state', 'Pass rate when leading, tied and trailing'],
            ['4th-down ledger', 'Every decision against the nfl4th recommendation'],
            ['Personnel', 'Snap share by grouping'],
          ].map(([name, detail]) => (
            <li key={name} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
              <span className="w-40 text-sm text-text">{name}</span>
              <span className="flex-1 text-xs text-text-muted">{detail}</span>
              <span className="font-mono text-2xs uppercase tracking-widest text-text-dim">
                Pending
              </span>
            </li>
          ))}
        </ul>
      </section>
    </BShell>
  );
}

function Rail() {
  return (
    <>
      <RailBlock title="Coordinators" note="2026">
        <dl className="space-y-2">
          <RailRow label="Head coach" value="Mike Vrabel" />
          <RailRow label="Offense" value="Josh McDaniels" />
          <RailRow label="Defense" value="Terrell Williams" />
        </dl>
        <p className="mt-2 font-mono text-2xs text-text-dim">
          A mid-season change splits every tendency into date-range rows, one per coach.
        </p>
      </RailBlock>
      <RailBlock title="Methodology">
        <p className="border-l-2 border-positive bg-surface px-3 py-2 text-xs text-text-muted">
          4th-down recommendations come from Ben Baldwin&rsquo;s nfl4th model, computed in the ETL.
        </p>
      </RailBlock>
      <DataRail />
    </>
  );
}
