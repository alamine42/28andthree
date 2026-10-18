import type { ReactNode } from 'react';
import { rankTier } from '@/lib/color/rank';
import { formatEpa, formatRank, formatSignedInt } from '@/lib/format/number';
import { phaseDisplayName } from '@/lib/format/phase';
import { Sparkline } from '@/components/charts/Sparkline';
import { Delta, MetricValue, RankNumber } from '@/components/numeric';
import { league, games, phases, team, SEASON, type ProtoPhase } from '@/lib/proto/data';

/** Prototype banner. Every /proto screen carries one: the league table below
 * the Patriots row is fabricated and must never read as real. */
export function ProtoBanner({ variant }: { variant: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-accent-dim bg-surface-2 px-4 py-2 font-mono text-2xs uppercase tracking-widest text-text-muted">
      <span className="text-text">Prototype · {variant}</span>
      <span>Patriots numbers are real {SEASON}</span>
      <span className="text-negative">Other 31 teams are fabricated</span>
      <a href="/proto" className="ml-auto underline underline-offset-2 hover:text-text">
        All directions
      </a>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">{children}</p>;
}

/** Rank as a compact mono cell, tier-colored. Table-density counterpart to
 * RankNumber, which is display-sized. */
export function RankCell({ rank }: { rank: number }) {
  const tier = rankTier(rank);
  const color =
    tier === 'positive'
      ? 'text-positive'
      : tier === 'negative'
        ? 'text-negative'
        : 'text-text-muted';
  return (
    <span data-numeric="true" className={`font-mono tabular-nums ${color}`}>
      {formatRank(rank)}
    </span>
  );
}

/** The three headline numbers, as a horizontal strip. Shared by all three
 * directions — only the chrome around it changes. */
export function ContextStats({ dense = false }: { dense?: boolean }) {
  const size = dense ? 'text-xl' : 'text-2xl';
  return (
    <>
      <StatSlot label="Overall rank">
        <RankNumber rank={team.rank} className={`${size} leading-none`} />
        <Delta value={team.rankDeltaVsPrevSeason} className="ml-2 text-2xs" />
      </StatSlot>
      <StatSlot label="Record">
        <span className="font-display text-xl font-bold tabular-nums text-text">
          {team.wins}-{team.losses}
        </span>
        <span className="ml-2 font-mono text-2xs text-text-muted">
          {formatSignedInt(team.pointDiff)} pt diff
        </span>
      </StatSlot>
      <StatSlot label="EPA / play">
        <MetricValue value={team.epa} format={formatEpa} className={`${size} text-text`} />
      </StatSlot>
      <StatSlot label="Week">
        <span className="font-display text-xl font-bold tabular-nums text-text">{team.week}</span>
        <span className="ml-2 font-mono text-2xs text-text-muted">of 18</span>
      </StatSlot>
    </>
  );
}

function StatSlot({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Eyebrow>{label}</Eyebrow>
      <div className="flex items-baseline">{children}</div>
    </div>
  );
}

/** Phases as a dense table instead of 11 padded cards. Used by B and C. */
export function PhaseTable({ rows = phases }: { rows?: ProtoPhase[] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-border-strong text-left">
          <Th>Phase</Th>
          <Th align="right">Rank</Th>
          <Th align="right">EPA/play</Th>
          <Th align="right">Trend</Th>
          <Th align="right">League</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => {
          const tier = rankTier(p.rank);
          return (
            <tr key={p.phase} className="border-b border-border hover:bg-surface">
              <td className="px-4 py-3 text-sm text-text">{phaseDisplayName(p.phase)}</td>
              <td className="px-4 py-3 text-right">
                <RankCell rank={p.rank} />
              </td>
              <td className="px-4 py-3 text-right">
                <MetricValue value={p.epa} format={formatEpa} className="text-sm text-text" />
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end">
                  <Sparkline
                    values={p.spark}
                    tier={tier}
                    title={`${phaseDisplayName(p.phase)} weekly trend`}
                    width={72}
                    height={18}
                  />
                </div>
              </td>
              <td className="px-4 py-3">
                <RankBar rank={p.rank} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`px-4 py-2 font-mono text-2xs font-normal uppercase tracking-widest text-text-muted ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  );
}

/** Where the team sits on the 32-team line. A positional signal a rank
 * number alone does not give at a glance. */
export function RankBar({ rank }: { rank: number }) {
  const tier = rankTier(rank);
  const fill =
    tier === 'positive' ? 'bg-positive' : tier === 'negative' ? 'bg-negative' : 'bg-chart-neutral';
  const pct = ((rank - 1) / 31) * 100;
  return (
    <div className="relative h-1 w-full min-w-[80px] bg-border" aria-hidden="true">
      <div
        className={`absolute top-0 h-1 w-1 ${fill}`}
        style={{ left: `calc(${pct}% - 2px)`, width: '4px' }}
      />
    </div>
  );
}

/** Last five results as a tight list. Rail-friendly. */
export function ResultsList() {
  return (
    <ul className="divide-y divide-border">
      {games.map((g) => {
        const won = g.teamScore > g.oppScore;
        return (
          <li key={g.week} className="flex items-center gap-3 py-2">
            <span className="w-10 font-mono text-2xs uppercase tracking-widest text-text-muted">
              Wk {g.week}
            </span>
            <span
              className={`font-mono text-2xs font-bold ${won ? 'text-positive' : 'text-negative'}`}
            >
              {won ? 'W' : 'L'}
            </span>
            <span className="flex-1 font-mono text-xs text-text">
              {g.isHome ? '' : '@ '}
              {g.opponent} {g.teamScore}-{g.oppScore}
            </span>
            <MetricValue
              value={g.epaDiff}
              format={formatEpa}
              className="text-2xs text-text-muted"
            />
          </li>
        );
      })}
    </ul>
  );
}

/** The 32-team league table. The point of direction C; a secondary panel in B. */
export function LeagueTable({ compact = false }: { compact?: boolean }) {
  return (
    <table className="w-full border-collapse">
      <thead className="sticky top-0 bg-bg">
        <tr className="border-b border-border-strong text-left">
          <Th align="right">#</Th>
          <Th>Team</Th>
          <Th align="right">Rec</Th>
          <Th align="right">EPA</Th>
          <Th align="right">Pass O</Th>
          <Th align="right">Rush O</Th>
          <Th align="right">Pass D</Th>
          <Th align="right">Run D</Th>
          {compact ? null : (
            <>
              <Th align="right">3rd O</Th>
              <Th align="right">Expl</Th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {league.map((r) => {
          const isNE = r.team === 'NE';
          return (
            <tr
              key={r.team}
              className={`border-b border-border ${
                isNE
                  ? 'bg-surface-2 outline outline-1 -outline-offset-1 outline-positive-dim'
                  : 'hover:bg-surface'
              }`}
            >
              <td className="px-3 py-2 text-right font-mono text-2xs tabular-nums text-text-muted">
                {r.rank}
              </td>
              <td className="px-3 py-2">
                <span className={`font-mono text-xs ${isNE ? 'text-positive' : 'text-text'}`}>
                  {r.team}
                </span>
                <span className="ml-2 hidden text-xs text-text-dim lg:inline">{r.name}</span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-2xs tabular-nums text-text-muted">
                {r.record}
              </td>
              <td className="px-3 py-2 text-right">
                <MetricValue value={r.epa} format={formatEpa} className="text-xs text-text" />
              </td>
              <td className="px-3 py-2 text-right text-xs">
                <RankCell rank={r.passOff} />
              </td>
              <td className="px-3 py-2 text-right text-xs">
                <RankCell rank={r.rushOff} />
              </td>
              <td className="px-3 py-2 text-right text-xs">
                <RankCell rank={r.passDef} />
              </td>
              <td className="px-3 py-2 text-right text-xs">
                <RankCell rank={r.runDef} />
              </td>
              {compact ? null : (
                <>
                  <td className="px-3 py-2 text-right text-xs">
                    <RankCell rank={r.thirdOff} />
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    <RankCell rank={r.explosive} />
                  </td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function SectionHead({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2">
      <Eyebrow>{children}</Eyebrow>
      {note ? <span className="font-mono text-2xs text-text-dim">{note}</span> : null}
    </div>
  );
}
