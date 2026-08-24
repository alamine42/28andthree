import Link from 'next/link';
import type { Route } from 'next';
import { PlayerAvatar } from './PlayerAvatar';
import type { ContributorCard } from '@/lib/data/contributors';
import { playerHref } from '@/lib/format/player-routes';

type Props = {
  card: ContributorCard;
  /** Past season in view — carried onto the card link (E11). */
  seasonQuery?: number | null;
};

export function TopContributorCard({ card, seasonQuery }: Props) {
  const href = hrefFor(card, seasonQuery);
  const testId = card.gsisId ? `contributor-card-${card.gsisId}` : 'contributor-card-unit';
  // Focus + hover styles sit on the actual focusable element (<a>) — putting
  // them on a `display:contents` wrapper hides them from keyboard users
  // (WCAG 2.4.7). Non-clickable variants render as a plain <div>.
  const shared =
    'flex flex-col items-start gap-3 bg-bg p-5 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive';

  const Body = (
    <>
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
    </>
  );

  if (href === '#') {
    return (
      <div data-testid={testId} className={shared}>
        {Body}
      </div>
    );
  }
  return (
    <Link href={href} data-testid={testId} className={shared}>
      {Body}
    </Link>
  );
}

function hrefFor(card: ContributorCard, seasonQuery?: number | null): Route | '#' {
  // Route ownership lives in lib/format/player-routes; 'unit' contributor
  // cards map onto the defense unit page.
  if (card.role !== 'qb' && card.role !== 'skill' && card.role !== 'unit') return '#';
  if (!card.gsisId && card.role !== 'unit') return '#';
  const href = playerHref(
    { role: card.role === 'unit' ? 'defense' : card.role, gsisId: card.gsisId ?? '' },
    seasonQuery,
  );
  return href ?? '#';
}
