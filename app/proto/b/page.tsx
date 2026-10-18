import { formatSignedInt } from '@/lib/format/number';
import { SEASON, team } from '@/lib/proto/data';
import {
  ContextStats,
  LeagueTable,
  PhaseTable,
  ResultsList,
  SectionHead,
} from '../_components/shared';
import { BShell, DataRail, PageHead, RailBlock, RailRow } from './_shell';

// Screen 1 — season overview. The home page.
export default function BOverview() {
  return (
    <BShell active="Team" screen="Season overview" rail={<Rail />}>
      <PageHead
        eyebrow={`${SEASON} season · in progress · week ${team.week}`}
        title="New England, 2026 in one page."
        lede="League rank across every phase of play, weekly trend, and the 32-team field."
      />

      <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-y border-border py-4 md:grid-cols-4">
        <ContextStats />
      </div>

      <section className="mt-8">
        <SectionHead note="sort by any column">League rank across phases</SectionHead>
        <div className="overflow-x-auto">
          <PhaseTable />
        </div>
      </section>

      <section className="mt-8">
        <SectionHead note="32 teams">Where that puts New England</SectionHead>
        <div className="max-h-[380px] overflow-auto border border-border">
          <LeagueTable compact />
        </div>
      </section>
    </BShell>
  );
}

function Rail() {
  return (
    <>
      <RailBlock title="Results" note="last 5">
        <ResultsList />
      </RailBlock>
      <RailBlock title="Season">
        <dl className="space-y-2">
          <RailRow label="Record" value={`${team.wins}-${team.losses}`} />
          <RailRow label="Point diff" value={formatSignedInt(team.pointDiff)} />
          <RailRow label="Rank vs 2025" value="11th ← 2nd" />
          <RailRow label="Games left" value="13" />
        </dl>
      </RailBlock>
      <DataRail />
    </>
  );
}
