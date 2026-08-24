'use client';

import { useMemo, useState } from 'react';
import type { RosterEntry } from '@/lib/data/players-hub';
import type { PlayerCategory } from '@/lib/format/player-routes';
import { RosterCard } from './RosterCard';
import { PlayerSearch } from './PlayerSearch';

type Props = {
  roster: ReadonlyArray<RosterEntry>;
  /** Past season in view — threaded into card + search links (E11). */
  seasonQuery?: number | null;
};

type Chip = { label: string; value: PlayerCategory | 'ALL' };

const CHIPS: ReadonlyArray<Chip> = [
  { label: 'All', value: 'ALL' },
  { label: 'QB', value: 'QB' },
  { label: 'RB', value: 'RB' },
  { label: 'WR+TE', value: 'WR+TE' },
  { label: 'OL', value: 'OL' },
  { label: 'DEF', value: 'DEF' },
  { label: 'ST', value: 'ST' },
];

export function RosterBrowser({ roster, seasonQuery }: Props) {
  const [category, setCategory] = useState<PlayerCategory | 'ALL'>('ALL');

  const countByCategory = useMemo(() => {
    const counts = new Map<PlayerCategory | 'ALL', number>([['ALL', roster.length]]);
    for (const p of roster) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return counts;
  }, [roster]);

  const visible = useMemo(() => {
    if (category === 'ALL') return roster;
    return roster.filter((p) => p.category === category);
  }, [roster, category]);

  return (
    <div className="flex flex-col gap-6">
      <PlayerSearch seasonQuery={seasonQuery} roster={roster} />

      <div
        role="group"
        aria-label="Filter by position"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
      >
        {CHIPS.map((chip) => {
          const count = countByCategory.get(chip.value) ?? 0;
          const active = category === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(chip.value)}
              className={
                'inline-flex min-h-[44px] items-center whitespace-nowrap rounded-sm border px-4 font-mono text-2xs uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive ' +
                (active
                  ? 'border-positive bg-surface text-text'
                  : 'border-border bg-bg text-text-muted hover:text-text')
              }
            >
              {chip.label} <span className="text-text-muted">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          No players in this position for the current roster.
        </p>
      ) : (
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <RosterCard seasonQuery={seasonQuery} key={p.gsisId} player={p} />
          ))}
        </div>
      )}
    </div>
  );
}
