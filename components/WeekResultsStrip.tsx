import { MetricValue } from '@/components/numeric';
import { formatEpa } from '@/lib/format/number';
import type { GameResult } from '@/lib/data/team';

type Props = {
  games: ReadonlyArray<GameResult>;
};

/** Last-6-games strip. Oldest on the left, most recent on the right, so
 * the reader's eye lands on "what just happened" at the end of the row. */
export function WeekResultsStrip({ games }: Props) {
  if (games.length === 0) return null;
  // Reverse so oldest is first in DOM order.
  const ordered = [...games].reverse();

  return (
    <section className="flex flex-col gap-3" data-testid="week-results">
      <h2 className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        Last {games.length} games
      </h2>
      <ol className="grid gap-px overflow-hidden rounded-md border border-border bg-border grid-cols-3 sm:grid-cols-6">
        {ordered.map((g) => <Cell key={g.gameId} game={g} />)}
      </ol>
    </section>
  );
}

function Cell({ game }: { game: GameResult }) {
  const { opponent, isHome, teamScore, oppScore, teamEpaPerPlay, oppEpaPerPlay, week } = game;
  const result = resultCode(teamScore, oppScore);
  const resultClass =
    result === 'W' ? 'text-positive' :
    result === 'L' ? 'text-negative' :
    'text-text-muted';
  const epaDiff =
    teamEpaPerPlay != null && oppEpaPerPlay != null
      ? teamEpaPerPlay - oppEpaPerPlay
      : null;

  return (
    <li className="flex flex-col gap-1.5 bg-bg p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Wk {week}
        </span>
        <span className={`font-mono text-sm font-bold ${resultClass}`}>{result}</span>
      </div>
      <p className="font-mono text-sm tabular-nums text-text">
        {isHome ? '' : '@ '}
        {opponent}
        {' '}
        <span className="text-text-muted">
          {teamScore ?? '—'}-{oppScore ?? '—'}
        </span>
      </p>
      <p className="font-mono text-2xs text-text-muted">
        <MetricValue value={epaDiff} format={formatEpa} />
        <span className="ml-1 text-text-muted">EPA diff</span>
      </p>
    </li>
  );
}

function resultCode(team: number | null, opp: number | null): 'W' | 'L' | 'T' | '—' {
  if (team == null || opp == null) return '—';
  if (team > opp) return 'W';
  if (team < opp) return 'L';
  return 'T';
}
