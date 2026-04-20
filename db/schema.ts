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
    // E4-00a: fraction of plays in this game tagged with participation data
    // (offense_players/defense_players arrays, was_pressure, etc.). Below
    // 0.80 → player pages hide pressure/route modules behind a banner.
    participationCoverage: doublePrecision('participation_coverage'),
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
    personnelOffense: varchar('personnel_offense', { length: 96 }),
    personnelDefense: varchar('personnel_defense', { length: 96 }),
    defendersInBox: smallint('defenders_in_box'),
    // E5-nfl4th-dep
    scoreDifferential: smallint('score_differential'),
    gameSecondsRemaining: smallint('game_seconds_remaining'),
    posteamTimeoutsRemaining: smallint('posteam_timeouts_remaining'),
    defteamTimeoutsRemaining: smallint('defteam_timeouts_remaining'),
    roof: varchar('roof', { length: 12 }),
    surface: varchar('surface', { length: 16 }),
    // E4-dep: player IDs + names. Lets QB / skill / unit rollups join
    // plays → players by gsis_id. nflverse player_id fields are stable
    // across seasons (gsis format, "00-0039166" etc.).
    passerPlayerId: text('passer_player_id'),
    passerPlayerName: text('passer_player_name'),
    receiverPlayerId: text('receiver_player_id'),
    receiverPlayerName: text('receiver_player_name'),
    rusherPlayerId: text('rusher_player_id'),
    rusherPlayerName: text('rusher_player_name'),
    yardsAfterCatch: smallint('yards_after_catch'),
    completePass: boolean('complete_pass'),
    incompletePass: boolean('incomplete_pass'),
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

// =============================================================================
// E4 — Player Deep Dives
// =============================================================================

// -----------------------------------------------------------------------------
// players — one row per player, current-identity metadata. Historical-identity
// snapshots live in roster_snapshots so a 2020 page can render 2020 jersey.
// -----------------------------------------------------------------------------
export const players = pgTable('players', {
  gsisId: text('gsis_id').primaryKey(),
  displayName: text('display_name').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  position: varchar('position', { length: 3 }),
  currentTeam: varchar('current_team', { length: 3 }),
  currentJerseyNumber: smallint('current_jersey_number'),
  rookieYear: smallint('rookie_year'),
  headshotUrl: text('headshot_url'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;

// -----------------------------------------------------------------------------
// roster_snapshots — per-season roster identity (E4-00b).
// getPlayer(gsisId, season?) prefers these rows so historical pages render
// the player's identity *at the time*, not their current one.
// -----------------------------------------------------------------------------
export const rosterSnapshots = pgTable(
  'roster_snapshots',
  {
    gsisId: text('gsis_id').notNull().references(() => players.gsisId),
    season: integer('season').notNull(),
    team: varchar('team', { length: 3 }).notNull(),
    jerseyNumber: smallint('jersey_number'),
    position: varchar('position', { length: 3 }),
    displayName: text('display_name').notNull(),
    headshotUrl: text('headshot_url'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('roster_snapshots_unique').on(table.gsisId, table.season, table.team),
  ],
);

export type RosterSnapshot = typeof rosterSnapshots.$inferSelect;
export type NewRosterSnapshot = typeof rosterSnapshots.$inferInsert;

// -----------------------------------------------------------------------------
// qb_weekly — per-QB per-game aggregates. Keyed on (gsis_id, game_id) per
// adversarial review #4: mid-week trades are naturally handled (game_id is
// unique even if both teams played in the same week).
// -----------------------------------------------------------------------------
export const qbWeekly = pgTable(
  'qb_weekly',
  {
    gsisId: text('gsis_id').notNull().references(() => players.gsisId),
    gameId: text('game_id').notNull().references(() => games.gameId),
    season: integer('season').notNull(),
    week: smallint('week').notNull(),
    team: varchar('team', { length: 3 }).notNull(),
    dropbacks: smallint('dropbacks').notNull(),
    attempts: smallint('attempts').notNull(),
    completions: smallint('completions').notNull(),
    yards: smallint('yards').notNull(),
    epaPerDropback: doublePrecision('epa_per_dropback'),
    cpoe: doublePrecision('cpoe'),
    adot: doublePrecision('adot'),
    successRate: doublePrecision('success_rate'),
    // Pressure-derived fields are NULL when participation coverage < 0.80
    pressureRate: doublePrecision('pressure_rate'),
    pressuredDropbacks: smallint('pressured_dropbacks'),
    cleanPocketEpaPerDropback: doublePrecision('clean_pocket_epa_per_dropback'),
    pressuredEpaPerDropback: doublePrecision('pressured_epa_per_dropback'),
    deepAttempts: smallint('deep_attempts'),
    deepCompletions: smallint('deep_completions'),
    deepEpaPerAttempt: doublePrecision('deep_epa_per_attempt'),
    // E4-03: set via deterministic rule — >50% of team dropbacks, or max
    // dropbacks as tiebreaker. Exactly one row per (game_id, team).
    primaryStarter: boolean('primary_starter').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('qb_weekly_unique').on(table.gsisId, table.gameId),
  ],
);

export type QbWeekly = typeof qbWeekly.$inferSelect;

// -----------------------------------------------------------------------------
// qb_season — QB season-to-date rollup.
// -----------------------------------------------------------------------------
export const qbSeason = pgTable(
  'qb_season',
  {
    gsisId: text('gsis_id').notNull().references(() => players.gsisId),
    season: integer('season').notNull(),
    team: varchar('team', { length: 3 }).notNull(),
    gamesPlayed: smallint('games_played').notNull(),
    primaryStarterGames: smallint('primary_starter_games').notNull(),
    dropbacks: integer('dropbacks').notNull(),
    attempts: integer('attempts').notNull(),
    completions: integer('completions').notNull(),
    yards: integer('yards').notNull(),
    epaPerDropback: doublePrecision('epa_per_dropback'),
    cpoe: doublePrecision('cpoe'),
    adot: doublePrecision('adot'),
    successRate: doublePrecision('success_rate'),
    pressureRate: doublePrecision('pressure_rate'),
    cleanPocketEpaPerDropback: doublePrecision('clean_pocket_epa_per_dropback'),
    pressuredEpaPerDropback: doublePrecision('pressured_epa_per_dropback'),
    deepEpaPerAttempt: doublePrecision('deep_epa_per_attempt'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('qb_season_unique').on(table.gsisId, table.season, table.team),
  ],
);

export type QbSeason = typeof qbSeason.$inferSelect;

// -----------------------------------------------------------------------------
// skill_weekly — WR/RB/TE per-game. Position-specific columns are NULL when
// they don't conceptually apply (review #3: NULL = N/A, 0 = actual zero).
// -----------------------------------------------------------------------------
export const skillWeekly = pgTable(
  'skill_weekly',
  {
    gsisId: text('gsis_id').notNull().references(() => players.gsisId),
    gameId: text('game_id').notNull().references(() => games.gameId),
    season: integer('season').notNull(),
    week: smallint('week').notNull(),
    team: varchar('team', { length: 3 }).notNull(),
    position: varchar('position', { length: 3 }).notNull(),
    targets: smallint('targets'),
    receptions: smallint('receptions'),
    yardsReceiving: smallint('yards_receiving'),
    yacTotal: smallint('yac_total'),
    yacPerReception: doublePrecision('yac_per_reception'),
    routes: smallint('routes'),
    targetShare: doublePrecision('target_share'),
    adotOnTargets: doublePrecision('adot_on_targets'),
    redzoneTargets: smallint('redzone_targets'),
    redzoneReceptions: smallint('redzone_receptions'),
    // RB-specific; NULL for WR/TE
    carries: smallint('carries'),
    yardsRushing: smallint('yards_rushing'),
    ypc: doublePrecision('ypc'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('skill_weekly_unique').on(table.gsisId, table.gameId),
  ],
);

export type SkillWeekly = typeof skillWeekly.$inferSelect;

// -----------------------------------------------------------------------------
// skill_season — season rollup.
// -----------------------------------------------------------------------------
export const skillSeason = pgTable(
  'skill_season',
  {
    gsisId: text('gsis_id').notNull().references(() => players.gsisId),
    season: integer('season').notNull(),
    team: varchar('team', { length: 3 }).notNull(),
    position: varchar('position', { length: 3 }).notNull(),
    gamesPlayed: smallint('games_played').notNull(),
    targets: integer('targets'),
    receptions: integer('receptions'),
    yardsReceiving: integer('yards_receiving'),
    yacTotal: integer('yac_total'),
    yacPerReception: doublePrecision('yac_per_reception'),
    routes: integer('routes'),
    targetShare: doublePrecision('target_share'),
    adotOnTargets: doublePrecision('adot_on_targets'),
    redzoneTargets: integer('redzone_targets'),
    redzoneReceptions: integer('redzone_receptions'),
    carries: integer('carries'),
    yardsRushing: integer('yards_rushing'),
    ypc: doublePrecision('ypc'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('skill_season_unique').on(table.gsisId, table.season, table.team),
  ],
);

export type SkillSeason = typeof skillSeason.$inferSelect;

// -----------------------------------------------------------------------------
// Unit rollups — typed tables per unit (review #8 rejected JSONB blob).
// -----------------------------------------------------------------------------
export const teamDefenseWeekly = pgTable(
  'team_defense_weekly',
  {
    team: varchar('team', { length: 3 }).notNull(),
    season: integer('season').notNull(),
    week: smallint('week').notNull(),
    pressureRate: doublePrecision('pressure_rate'),
    coverageEpaAllowed: doublePrecision('coverage_epa_allowed'),
    runStopRate: doublePrecision('run_stop_rate'),
    explosivePlaysAllowed: smallint('explosive_plays_allowed'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('team_defense_weekly_unique').on(table.team, table.season, table.week)],
);

export const teamDefenseSeason = pgTable(
  'team_defense_season',
  {
    team: varchar('team', { length: 3 }).notNull(),
    season: integer('season').notNull(),
    pressureRate: doublePrecision('pressure_rate'),
    coverageEpaAllowed: doublePrecision('coverage_epa_allowed'),
    runStopRate: doublePrecision('run_stop_rate'),
    explosivePlaysAllowed: integer('explosive_plays_allowed'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('team_defense_season_unique').on(table.team, table.season)],
);

export const teamOlWeekly = pgTable(
  'team_ol_weekly',
  {
    team: varchar('team', { length: 3 }).notNull(),
    season: integer('season').notNull(),
    week: smallint('week').notNull(),
    passBlockWinRate: doublePrecision('pass_block_win_rate'),
    runBlockRate: doublePrecision('run_block_rate'),
    pressuresAllowed: smallint('pressures_allowed'),
    epaOnDropbacks: doublePrecision('epa_on_dropbacks'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('team_ol_weekly_unique').on(table.team, table.season, table.week)],
);

export const teamOlSeason = pgTable(
  'team_ol_season',
  {
    team: varchar('team', { length: 3 }).notNull(),
    season: integer('season').notNull(),
    passBlockWinRate: doublePrecision('pass_block_win_rate'),
    runBlockRate: doublePrecision('run_block_rate'),
    pressuresAllowed: integer('pressures_allowed'),
    epaOnDropbacks: doublePrecision('epa_on_dropbacks'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('team_ol_season_unique').on(table.team, table.season)],
);

export const teamDlWeekly = pgTable(
  'team_dl_weekly',
  {
    team: varchar('team', { length: 3 }).notNull(),
    season: integer('season').notNull(),
    week: smallint('week').notNull(),
    pressuresGenerated: smallint('pressures_generated'),
    passRushWinRate: doublePrecision('pass_rush_win_rate'),
    runStopRate: doublePrecision('run_stop_rate'),
    sackRate: doublePrecision('sack_rate'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('team_dl_weekly_unique').on(table.team, table.season, table.week)],
);

export const teamDlSeason = pgTable(
  'team_dl_season',
  {
    team: varchar('team', { length: 3 }).notNull(),
    season: integer('season').notNull(),
    pressuresGenerated: integer('pressures_generated'),
    passRushWinRate: doublePrecision('pass_rush_win_rate'),
    runStopRate: doublePrecision('run_stop_rate'),
    sackRate: doublePrecision('sack_rate'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('team_dl_season_unique').on(table.team, table.season)],
);
