// Primary header navigation. Lives here rather than in SiteHeader so the
// e2e specs can assert against the same list the header renders — two tests
// hardcoded a count of 5, and both went red the moment E12 added Trends.
// Same pattern as lib/constants/phases.ts and units.ts.
//
// The season param rides every nav link while a past season is active —
// pages that are season-agnostic (Draft, Status) simply ignore it, so the
// context survives a detour and is still there when the visitor returns
// to a season-scoped page. (User decision, prototype round 3.)

export type NavLink = { label: string; href: string; seasonAware: boolean };

// Team = home; Players = E7 hub; Draft + Coaching = E5 pages. Phases has no
// index page — it links to the phase grid section on the home page via the
// #phases anchor (PhaseGrid carries the id).
export const NAV_LINKS: ReadonlyArray<NavLink> = [
  { label: 'Team', href: '/', seasonAware: true },
  { label: 'Phases', href: '/#phases', seasonAware: true },
  { label: 'Players', href: '/players', seasonAware: true },
  { label: 'Draft', href: '/draft-roi', seasonAware: true },
  { label: 'Coaching', href: '/coaching', seasonAware: true },
  // E12: season-agnostic (shows every season at once) but still carries the
  // param so a detour from a historical page returns to it, same as Draft.
  { label: 'Trends', href: '/trends', seasonAware: true },
];
