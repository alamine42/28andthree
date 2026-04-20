'use client';

import { useState } from 'react';

type Props = {
  gsisId: string;
  season: number;
};

// Primary-starter vs all-games toggle (SPEC §3.5a). React state only — no URL
// query per review #3 (keeps ISR cache single-keyed). Weekly data is
// pre-rendered; the toggle filters on the client. For now this is a visual
// state; a future enhancement fetches a filtered TrendChart series.
export function QbStarterToggle({ gsisId: _gsisId, season: _season }: Props) {
  const [view, setView] = useState<'primary' | 'all'>('primary');

  return (
    <div className="flex justify-start">
      <div
        role="group"
        aria-label="View"
        className="flex gap-px rounded-sm border border-border bg-border p-px"
      >
        <ToggleButton pressed={view === 'primary'} onClick={() => setView('primary')}>
          Primary starter
        </ToggleButton>
        <ToggleButton pressed={view === 'all'} onClick={() => setView('all')}>
          All games
        </ToggleButton>
      </div>
    </div>
  );
}

function ToggleButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`bg-bg px-3 py-1.5 font-mono text-2xs uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive ${
        pressed ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}
