import { Delta, MetricValue, RankNumber } from '@/components/numeric';
import { formatEpa, formatSignedInt } from '@/lib/format/number';
import type { TeamSeasonOverview } from '@/lib/data/team';

type Props = {
  overview: TeamSeasonOverview;
};

/** 3-cell hairline-divided hero. Overall rank / record / EPA per play.
 * Handles week-1-of-season gracefully — rank + delta render as em-dash
 * when the season rollup isn't available yet (review finding #7). */
export function HeroStats({ overview }: Props) {
  const { season, record, pointDiff, currentSeasonRank, currentSeasonEpa, prevSeasonRank } = overview;
  const rankDelta =
    currentSeasonRank != null && prevSeasonRank != null
      ? prevSeasonRank - currentSeasonRank
      : null;
  const prevSeason = season - 1;
  const showDelta = rankDelta != null && rankDelta !== 0;

  return (
    <dl
      className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-3"
      data-testid="hero-stats"
    >
      <Cell label="Overall rank">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <RankNumber
            rank={currentSeasonRank}
            className="text-3xl leading-none md:text-display"
          />
          <span
            data-testid="hero-overall-rank-delta"
            className="flex items-baseline gap-1.5"
            title={
              currentSeasonRank == null
                ? 'Season rank available after week 3'
                : prevSeasonRank == null
                  ? `No ${prevSeason} season data`
                  : undefined
            }
          >
            <Delta value={rankDelta} />
            {showDelta ? (
              <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">
                vs {prevSeason}
              </span>
            ) : null}
          </span>
        </div>
      </Cell>

      <Cell label="Record">
        <p className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-3xl">
          <MetricValue
            value={`${record.wins}-${record.losses}${record.ties > 0 ? `-${record.ties}` : ''}`}
            format={(v) => String(v ?? '\u2014')}
          />
        </p>
        <p className="font-mono text-2xs text-text-muted">
          Point diff <MetricValue value={pointDiff} format={formatSignedInt} />
        </p>
      </Cell>

      <Cell label="EPA / play (overall)">
        <p className="font-display text-3xl font-bold tabular-nums tracking-tighter text-text md:text-3xl">
          <MetricValue value={currentSeasonEpa} format={formatEpa} />
        </p>
      </Cell>
    </dl>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 bg-bg p-4 md:p-5">
      <dt className="font-mono text-2xs uppercase tracking-widest text-text-muted">{label}</dt>
      <dd className="flex flex-col gap-1">{children}</dd>
    </div>
  );
}
