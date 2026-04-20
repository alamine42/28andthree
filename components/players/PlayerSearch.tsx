'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useId, useMemo, useState } from 'react';
import type { RosterEntry } from '@/lib/data/players-hub';
import { playerHref } from '@/lib/format/player-routes';
import { RosterCardBody } from './RosterCardBody';

type Props = {
  roster: ReadonlyArray<RosterEntry>;
};

const MIN_QUERY = 2;
const MAX_RESULTS = 8;

// WAI-ARIA 1.2 combobox. `role="combobox"` lives on the <input> itself (the
// refactored 1.2 pattern), not a wrapper div — review finding #1. Focus stays
// on the input; listbox options use aria-activedescendant virtual focus so
// their <li> elements carry no tabindex (review finding #3). Pointer clicks
// on an option call preventDefault on mousedown so the input doesn't blur
// before the click resolves (review finding #12).
export function PlayerSearch({ roster }: Props) {
  const router = useRouter();
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < MIN_QUERY) return [];
    // Exclude 'special' role entries: clicking them would be a silent no-op
    // (playerHref returns null for ST until a unit page exists). The ST chip
    // in the grid still surfaces them for browsing; search is for reaching a
    // destination, so leaving a dead-end match in the listbox is worse UX
    // than omitting them. Review pass-1 finding #2.
    return roster
      .filter((p) => p.role !== 'special')
      .filter((p) => p.displayName.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [roster, query]);

  const navigate = useCallback(
    (player: RosterEntry) => {
      const href = playerHref(player);
      if (href === null) return; // special-teams: no destination yet
      setOpen(false);
      setActiveIdx(null);
      router.push(href);
    },
    [router],
  );

  const clampedActive = activeIdx != null && matches[activeIdx] ? activeIdx : null;

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (matches.length === 0) return;
      setOpen(true);
      setActiveIdx((prev) => (prev == null ? 0 : Math.min(prev + 1, matches.length - 1)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (matches.length === 0) return;
      // Symmetric with ArrowDown — opens the listbox if it was collapsed
      // (e.g., after Escape) so aria-activedescendant points at a rendered
      // option. Review pass-1 finding #1.
      setOpen(true);
      setActiveIdx((prev) => (prev == null ? matches.length - 1 : Math.max(prev - 1, 0)));
      return;
    }
    if (e.key === 'Enter') {
      if (matches.length === 0) return;
      e.preventDefault();
      const pick = clampedActive != null ? matches[clampedActive] : matches[0];
      if (pick) navigate(pick);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (open) {
        setOpen(false);
        setActiveIdx(null);
      } else {
        setQuery('');
      }
      return;
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);
    setActiveIdx(null);
    setOpen(value.trim().length >= MIN_QUERY);
  };

  const showEmptyState = query.trim().length >= MIN_QUERY && matches.length === 0;
  // aria-expanded must mirror the actual popup state (review pass-1
  // finding #4): the popup isn't rendered when matches is empty, so
  // reporting true would be a lie to assistive tech.
  const popupOpen = open && matches.length > 0;

  return (
    <div className="relative w-full max-w-md">
      <input
        type="text"
        role="combobox"
        aria-label="Search players"
        aria-expanded={popupOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          clampedActive != null ? optionId(listboxId, matches[clampedActive]!.gsisId) : undefined
        }
        placeholder="Search players…"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => {
          if (query.trim().length >= MIN_QUERY) setOpen(true);
        }}
        onBlur={(e) => {
          // Close only when focus leaves the whole combobox, not when it
          // shifts to a listbox option click (whose mousedown already fired
          // preventDefault to keep us focused).
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
            setOpen(false);
            setActiveIdx(null);
          }
        }}
        className="w-full rounded-sm border border-border bg-bg px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted focus-visible:border-positive focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive"
      />

      {/* Conditionally render the listbox rather than using the `hidden`
          attribute — Tailwind's `flex` display class would otherwise win
          specificity over the UA `[hidden] { display: none }` rule and keep
          the element visible. Unmounting also avoids stale aria-activedescendant
          references pointing to nodes that are no longer focusable targets. */}
      {popupOpen ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 flex flex-col gap-px rounded-sm border border-border bg-border shadow-lg"
        >
          {matches.map((p, i) => (
            <li
              key={p.gsisId}
              id={optionId(listboxId, p.gsisId)}
              role="option"
              aria-selected={clampedActive === i}
              data-testid={`roster-option-${p.gsisId}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => navigate(p)}
              onMouseEnter={() => setActiveIdx(i)}
              className={
                'flex cursor-pointer items-center gap-3 bg-bg p-3 ' +
                (clampedActive === i ? 'bg-surface' : '')
              }
            >
              <RosterCardBody player={p} />
            </li>
          ))}
        </ul>
      ) : null}

      {showEmptyState ? (
        <p
          role="status"
          className="mt-2 font-mono text-2xs uppercase tracking-widest text-text-muted"
        >
          No players match &quot;{query.trim()}&quot;.
        </p>
      ) : null}
    </div>
  );
}

function optionId(listboxId: string, gsisId: string): string {
  return `${listboxId}-opt-${gsisId}`;
}
