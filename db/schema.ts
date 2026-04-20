import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { PHASES } from '@/lib/constants/phases';

// Single source of truth for ETL run statuses. Mirrored in etl/models.py
// as `Status`. The E2-00b drift check enforces sync going forward.
export type EtlStatus = 'running' | 'ok' | 'failed' | 'heartbeat';

export const ETL_STATUSES: readonly EtlStatus[] = ['running', 'ok', 'failed', 'heartbeat'];

// Postgres enum for phases. Adding a 13th value later requires a migration
// with ALTER TYPE … ADD VALUE outside a transaction (drizzle-kit handles this).
export const phaseEnum = pgEnum('phase_enum', PHASES);

// -----------------------------------------------------------------------------
// meta_refresh — ETL run log. One row per run.
// -----------------------------------------------------------------------------
export const metaRefresh = pgTable(
  'meta_refresh',
  {
    id: serial('id').primaryKey(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: varchar('status', { length: 20 }).$type<EtlStatus>().notNull(),
    season: integer('season'),
    week: integer('week'),
    sourceVersion: varchar('source_version', { length: 40 }),
    rowCounts: jsonb('row_counts').$type<Record<string, number>>(),
    errorText: text('error_text'),
  },
  (table) => [
    check(
      'meta_refresh_status_chk',
      sql`${table.status} IN ('running', 'ok', 'failed', 'heartbeat')`,
    ),
  ],
);

export type MetaRefresh = typeof metaRefresh.$inferSelect;
export type NewMetaRefresh = typeof metaRefresh.$inferInsert;

// -----------------------------------------------------------------------------
// games — one row per NFL game. nflverse game_id is globally unique.
// -----------------------------------------------------------------------------
export const games = pgTable(
  'games',
  {
    gameId: text('game_id').primaryKey(),
    season: integer('season').notNull(),
    week: smallint('week').notNull(),
    seasonType: varchar('season_type', { length: 4 }).notNull(),
    homeTeam: varchar('home_team', { length: 3 }).notNull(),
    awayTeam: varchar('away_team', { length: 3 }).notNull(),
    homeScore: smallint('home_score'),
    awayScore: smallint('away_score'),
    gameDate: date('game_date').notNull(),
    completed: boolean('completed').notNull().default(false),
    // Per-game offensive EPA/play. E3-15: renamed from posteam_epa/defteam_epa
    // (which were always null under E2). Populated at end of ETL by avg(epa)
    // over REG qualifying plays per team for that game — same garbage-play
    // filter as phase aggregations. Feeds the home-page Last-6-Games strip.
    homeOffenseEpaPerPlay: doublePrecision('home_offense_epa_per_play'),
    awayOffenseEpaPerPlay: doublePrecision('away_offense_epa_per_play'),
  },
  (table) => [
    check('games_season_type_chk', sql`${table.seasonType} IN ('REG', 'POST')`),
  ],
);

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

// -----------------------------------------------------------------------------
// plays — league-wide PBP 2020–2025. Composite PK (game_id, play_id) because
// nflverse play_id is per-game unique, not globally unique.
//
// Column tagging (see docs/plans/e2-data-ingest-plan.md §3.3):
//   E4-dep        needed by QB / skill / unit rollups
//   E5-dep        needed by coaching tendencies
//   E5-nfl4th-dep needed by the 4th-down model inputs
// Widened up front per review finding #1 to avoid 3–4 backfills mid-project.
// -----------------------------------------------------------------------------
export const plays = pgTable(
  'plays',
  {
    gameId: text('game_id').notNull().references(() => games.gameId),
    playId: integer('play_id').notNull(),
    season: integer('season').notNull(),
    week: smallint('week').notNull(),
    seasonType: varchar('season_type', { length: 4 }).notNull(),
    posteam: varchar('posteam', { length: 3 }),
    defteam: varchar('defteam', { length: 3 }),
    down: smallint('down'),
    ydstogo: smallint('ydstogo'),
    yardline100: smallint('yardline_100'),
    playType: varchar('play_type', { length: 16 }),
    yardsGained: smallint('yards_gained'),
    epa: doublePrecision('epa'),
    cpoe: doublePrecision('cpoe'),
    success: boolean('success'),
    wp: doublePrecision('wp'),
    qbDropback: boolean('qb_dropback'),
    qbKneel: boolean('qb_kneel'),
    qbSpike: boolean('qb_spike'),
    twoPointAttempt: boolean('two_point_attempt'),
    passAttempt: boolean('pass_attempt'),
    rushAttempt: boolean('rush_attempt'),
    passLength: varchar('pass_length', { length: 8 }),
    airYards: smallint('air_yards'),
    // Generated columns: computed at insert, no maintenance burden, indexable.
    isRedzone: boolean('is_redzone').generatedAlwaysAs(sql`yardline_100 <= 20`),
    isThirdDown: boolean('is_third_down').generatedAlwaysAs(sql`down = 3`),
    // Set during load (can't be generated because it depends on two columns with different null profiles).
    isExplosivePass: boolean('is_explosive_pass'),
    isExplosiveRun: boolean('is_explosive_run'),
    specialTeamsPlay: boolean('special_teams_play'),
    // E4-dep
    qbHit: boolean('qb_hit'),
    sack: boolean('sack'),
    wasPressure: boolean('was_pressure'),
    numberOfPassRushers: smallint('number_of_pass_rushers'),
    // E5-dep
    shotgun: boolean('shotgun'),
    noHuddle: boolean('no_huddle'),
    preSnapMotion: boolean('pre_snap_motion'),
    playAction: boolean('play_action'),
    personnelOffense: varchar('personnel_offense', { length: 16 }),
    personnelDefense: varchar('personnel_defense', { length: 16 }),
    defendersInBox: smallint('defenders_in_box'),
    // E5-nfl4th-dep
    scoreDifferential: smallint('score_differential'),
    gameSecondsRemaining: smallint('game_seconds_remaining'),
    posteamTimeoutsRemaining: smallint('posteam_timeouts_remaining'),
    defteamTimeoutsRemaining: smallint('defteam_timeouts_remaining'),
    roof: varchar('roof', { length: 12 }),
    surface: varchar('surface', { length: 16 }),
  },
  (table) => [
    primaryKey({ name: 'plays_pkey', columns: [table.gameId, table.playId] }),
    check('plays_season_type_chk', sql`${table.seasonType} IN ('REG', 'POST')`),
  ],
);

export type Play = typeof plays.$inferSelect;
export type NewPlay = typeof plays.$inferInsert;

// -----------------------------------------------------------------------------
// team_phase_weekly — one row per (team, season, week, phase).
// -----------------------------------------------------------------------------
export const teamPhaseWeekly = pgTable(
  'team_phase_weekly',
  {
    team: varchar('team', { length: 3 }).notNull(),
    season: integer('season').notNull(),
    week: smallint('week').notNull(),
    phase: phaseEnum('phase').notNull(),
    plays: integer('plays').notNull(),
    epaPerPlay: doublePrecision('epa_per_play'),
    successRate: doublePrecision('success_rate'),
    rank: smallint('rank'),
    percentile: doublePrecision('percentile'),
    insufficientSample: boolean('insufficient_sample').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('team_phase_weekly_unique').on(table.team, table.season, table.week, table.phase),
  ],
);

export type TeamPhaseWeekly = typeof teamPhaseWeekly.$inferSelect;
export type NewTeamPhaseWeekly = typeof teamPhaseWeekly.$inferInsert;

// -----------------------------------------------------------------------------
// team_phase_season — one row per (team, season, phase). Threshold plays < 30.
// -----------------------------------------------------------------------------
export const teamPhaseSeason = pgTable(
  'team_phase_season',
  {
    team: varchar('team', { length: 3 }).notNull(),
    season: integer('season').notNull(),
    phase: phaseEnum('phase').notNull(),
    plays: integer('plays').notNull(),
    epaPerPlay: doublePrecision('epa_per_play'),
    successRate: doublePrecision('success_rate'),
    rank: smallint('rank'),
    percentile: doublePrecision('percentile'),
    insufficientSample: boolean('insufficient_sample').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('team_phase_season_unique').on(table.team, table.season, table.phase),
  ],
);

export type TeamPhaseSeason = typeof teamPhaseSeason.$inferSelect;
export type NewTeamPhaseSeason = typeof teamPhaseSeason.$inferInsert;
