import { type Phase } from '@/lib/constants/phases';

// Display names for rendering phase headings and card titles. Terse per
// DESIGN.md §Content — "Pass offense" not "Passing Offense (team)".
export const PHASE_DISPLAY_NAMES: Record<Phase, string> = {
  pass_offense: 'Pass offense',
  rush_offense: 'Rush offense',
  overall: 'Overall',
  pass_defense: 'Pass defense',
  run_defense: 'Run defense',
  redzone_offense: 'Red zone offense',
  redzone_defense: 'Red zone defense',
  third_down_offense: '3rd down offense',
  third_down_defense: '3rd down defense',
  explosive_offense: 'Explosive (O)',
  explosive_defense: 'Explosive (D)',
  special_teams: 'Special teams',
};

/** Resolve a slug to a display name; pass through unknown input so a missing
 * entry surfaces visually instead of disappearing. */
export function phaseDisplayName(slug: Phase | string): string {
  return PHASE_DISPLAY_NAMES[slug as Phase] ?? slug;
}
