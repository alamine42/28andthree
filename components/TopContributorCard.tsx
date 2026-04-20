import Link from 'next/link';
import type { Route } from 'next';
import { PlayerAvatar } from './PlayerAvatar';
import type { ContributorCard } from '@/lib/data/contributors';

type Props = {
  card: ContributorCard;
};

export function TopContributorCard({ card }: Props) {
  const href: Route | '#' = hrefFor(card);

  const Inner = (
    <div
      data-testid={card.gsisId ? `contributor-card-${card.gsisId}` : 'contributor-card-unit'}
      className="flex flex-col items-start gap-3 bg-bg p-5 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive"
    >
      <PlayerAvatar displayName={card.displayName} headshotUrl={card.headshotUrl} size={56} />
      <div className="flex flex-col gap-1">
        <p className="font-display text-lg font-bold tracking-tight text-text">
          {card.displayName}
        </p>
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          {card.position ?? card.primaryStatLabel}
        </p>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="font-mono text-xs text-text-muted">{card.primaryStatLabel}</p>
        <p className="font-display text-xl font-bold tabular-nums tracking-tighter text-text">
          {card.primaryStat}
        </p>
      </div>
    </div>
  );

  return href === '#' ? (
    Inner
  ) : (
    <Link href={href} className="contents">
      {Inner}
    </Link>
  );
}

function hrefFor(card: ContributorCard): Route | '#' {
  if (card.role === 'qb') return `/players/qb/${card.gsisId}` as Route;
  if (card.role === 'skill') return `/players/skill/${card.gsisId}` as Route;
  if (card.role === 'unit') return '/team/units/defense' as Route;
  return '#';
}
