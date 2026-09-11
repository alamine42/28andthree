import type { SchedulePhase } from '@/lib/schedule/phase';

/** Days before the next-season opener at which the site enters the
 * preseason transition state. Covers the NFL preseason (Hall of Fame game
 * ~6 weeks out through Week 1) without flipping in May when the schedule
 * first lands. */
export const PRESEASON_WINDOW_DAYS = 45;

export type SeasonContext = {
  /** Season every stats page should display. */
  season: number;
  /** True in the preseason window: the next season's schedule is loaded
   * but no regular-season snaps exist yet. Pages render the new season
   * with empty stats plus the site-wide SeasonNotice. */
  awaitingFirstGame: boolean;
  /** Days until the new season's opener; null outside the transition. */
  kickoffInDays: number | null;
};

/** Pure decision core for the preseason transition. The DB wrapper in
 * lib/data/current-season.ts feeds it; unit tests exercise it directly.
 *
 * Two shapes of the transition:
 * - Preseason window: offseason phase, opener within PRESEASON_WINDOW_DAYS.
 *   kickoffInDays drives countdown copy.
 * - Week 1 lag: the new season's games have started (phase left offseason)
 *   but the ETL has not loaded any snaps yet. No countdown — kickoff
 *   already happened.
 */
export function resolveSeasonContext(input: {
  statsSeason: number;
  maxScheduledSeason: number | null;
  phase: SchedulePhase;
  daysUntilNextGame: number | null;
}): SeasonContext {
  const { statsSeason, maxScheduledSeason, phase, daysUntilNextGame } = input;
  if (maxScheduledSeason != null && maxScheduledSeason > statsSeason) {
    if (phase !== 'offseason') {
      return {
        season: maxScheduledSeason,
        awaitingFirstGame: true,
        kickoffInDays: null,
      };
    }
    if (daysUntilNextGame != null && daysUntilNextGame <= PRESEASON_WINDOW_DAYS) {
      return {
        season: maxScheduledSeason,
        awaitingFirstGame: true,
        kickoffInDays: daysUntilNextGame,
      };
    }
  }
  return { season: statsSeason, awaitingFirstGame: false, kickoffInDays: null };
}

/** The refresh cadence, stated once. The ETL runs Tuesday morning ET and
 * loads whatever nflverse has published, so a week's stats appear the
 * Tuesday after that week's last game (Monday night) is final.
 * See .github/workflows/etl.yml. */
export const WEEKLY_CADENCE_COPY =
  "Each week's stats populate on Tuesday, once every game that week is final.";

/** Copy for the awaitingFirstGame notice. Two states, two openers:
 * - Preseason (kickoffInDays != null): no snap has been played.
 * - Week 1 lag (kickoffInDays == null): games have been played but the
 *   Tuesday ETL has not loaded them. Saying "haven't taken a snap" here is
 *   simply false, which is what this split exists to prevent. */
export function seasonNoticeCopy(ctx: {
  season: number;
  kickoffInDays: number | null;
}): string {
  const opener =
    ctx.kickoffInDays != null
      ? `The ${ctx.season} Patriots haven't taken a regular-season snap yet.`
      : `No ${ctx.season} stats are loaded yet.`;
  return `${opener} ${WEEKLY_CADENCE_COPY}`;
}
