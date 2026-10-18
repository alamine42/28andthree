import { MetricValue } from '@/components/numeric';
import { formatEpa } from '@/lib/format/number';
import type { GameResult } from '@/lib/data/team';

type Props = {
  games: ReadonlyArray<GameResult>;
};

// E13 direction B. The rail counterpart to WeekResultsStrip: same games,
// one per row instead of a six-across strip, most recent first. The strip
// reads left-to-right and needs the full page width; in a 320px rail the
// vertical list is the only form that fits, and "what just happened"
// belongs at the top of a column rather than the end of a row.
export function WeekResultsList({ games }: Props) {
  if (games.length === 0) return null;

  return (
    <ol className="divide-y divide-border" data-testid="week-results">
      {games.map((g) => {
        const result = resultCode(g.teamScore, g.oppScore);
        const resultClass =
          result === 'W' ? 'text-positive' : result === 'L' ? 'text-negative' : 'text-text-muted';
        const epaDiff =
          g.teamEpaPerPlay != null && g.oppEpaPerPlay != null
            ? g.teamEpaPerPlay - g.oppEpaPerPlay
            : null;
        return (
          <li key={g.gameId} className="flex items-center gap-3 py-2">
            <span className="w-10 shrink-0 font-mono text-2xs uppercase tracking-widest text-text-muted">
              Wk {g.week}
            </span>
            <span className={`w-3 shrink-0 font-mono text-2xs font-bold ${resultClass}`}>
              {result}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-xs tabular-nums text-text">
              {g.isHome ? '' : '@ '}
              {g.opponent}{' '}
              <span className="text-text-muted">
                {g.teamScore ?? '—'}-{g.oppScore ?? '—'}
              </span>
            </span>
            <MetricValue
              value={epaDiff}
              format={formatEpa}
              className="shrink-0 text-2xs text-text-muted"
            />
          </li>
        );
      })}
    </ol>
  );
}

function resultCode(team: number | null, opp: number | null): 'W' | 'L' | 'T' | '—' {
  if (team == null || opp == null) return '—';
  if (team > opp) return 'W';
  if (team < opp) return 'L';
  return 'T';
}
