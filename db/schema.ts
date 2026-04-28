import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
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
    personnelOffense: varchar('personnel_offense', { length: 128 }),
    personnelDefense: varchar('personnel_defense', { length: 128 }),
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
    // E4-follow (39d.19): nflverse participation arrays — gsis IDs of every
    // player on the field for the play, by side. Source for defender
    // leaderboards on /phases/<defensive>. NULL when participation coverage
    // is missing (older games or schema-drift release of nflverse).
    offensePlayers: text('offense_players').array(),
    defensePlayers: text('defense_players').array(),
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
    // E5-04a: per-player EPA attribution so Draft ROI grading has a real
    // actual-value to compare against slot-EV. Summed in the skill rollup
    // transform over plays where the player was the receiver / rusher.
    epaReceiving: doublePrecision('epa_receiving'),
    epaRushing: doublePrecision('epa_rushing'),
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
    // E5-04a: season-summed EPA for Draft ROI grading.
    epaReceiving: doublePrecision('epa_receiving'),
    epaRushing: doublePrecision('epa_rushing'),
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

// =============================================================================
// E5: Pats Differentiators — draft ROI + coaching tendencies
// =============================================================================

// -----------------------------------------------------------------------------
// draft_picks — Pats picks 2021..current. gsis_id nullable for trade-out
// slots where the pick was traded away (no resulting NE player).
// See docs/plans/e5-pats-differentiators-plan.md §3.1 + review finding #5.
// -----------------------------------------------------------------------------
export const draftPicks = pgTable(
  'draft_picks',
  {
    draftSeason: smallint('draft_season').notNull(),
    round: smallint('round').notNull(),
    pickOverall: smallint('pick_overall').notNull(),
    gsisId: text('gsis_id').references(() => players.gsisId), // nullable (trade-out)
    position: varchar('position', { length: 3 }),             // nullable (trade-out)
    tradedTo: varchar('traded_to', { length: 3 }),            // NULL when the Pats kept the pick
    playerName: text('player_name'),                          // display name cached at seed time
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.draftSeason, table.pickOverall] }),
  ],
);

export type DraftPick = typeof draftPicks.$inferSelect;

// -----------------------------------------------------------------------------
// draft_outcomes_historical — league-wide draft results 2015–2024 used to
// fit the slot-expected-value curve. `career_epa` is NULL when the player's
// career ended before our PBP window (pre-2020); `career_seasons` is the
// longevity-proxy fallback in that case.
// -----------------------------------------------------------------------------
export const draftOutcomesHistorical = pgTable(
  'draft_outcomes_historical',
  {
    draftSeason: smallint('draft_season').notNull(),
    pickOverall: smallint('pick_overall').notNull(),
    gsisId: text('gsis_id'),                                  // nullable when feed can't resolve
    position: varchar('position', { length: 3 }),
    team: varchar('team', { length: 3 }),                     // team that drafted
    careerEpa: doublePrecision('career_epa'),                 // nullable
    careerSeasons: smallint('career_seasons'),                // longevity proxy
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.draftSeason, table.pickOverall] }),
  ],
);

// -----------------------------------------------------------------------------
// draft_expected_value — the fitted slot-EV curve. One row per
// (slot, position_bucket); emits ~260 slots × 6 buckets = 1,560 rows.
// PK composite per review finding #1.
// -----------------------------------------------------------------------------
export const draftExpectedValue = pgTable(
  'draft_expected_value',
  {
    pickOverall: smallint('pick_overall').notNull(),
    positionBucket: varchar('position_bucket', { length: 10 }).notNull(), // QB | OFF_SKILL | OL | DL | LB | DB
    expectedValue: doublePrecision('expected_value').notNull(),
    fitVersion: smallint('fit_version').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.pickOverall, table.positionBucket] }),
  ],
);

export type DraftExpectedValue = typeof draftExpectedValue.$inferSelect;

// -----------------------------------------------------------------------------
// coaching_tendencies_weekly — one row per (team, season, week, coach_role).
// Wide table; all metric columns nullable because different roles report
// different subsets (HC/OC: offensive metrics; DC: blitz + defensive).
// See plan §3.1.
// -----------------------------------------------------------------------------
export const coachingTendenciesWeekly = pgTable(
  'coaching_tendencies_weekly',
  {
    team: varchar('team', { length: 3 }).notNull(),
    season: smallint('season').notNull(),
    week: smallint('week').notNull(),
    coachRole: varchar('coach_role', { length: 3 }).notNull(), // HC | OC | DC
    coachId: text('coach_id'),                                  // stable id from nflreadpy; nullable
    coachName: text('coach_name').notNull(),                    // display fallback
    // Down × distance-bucket pass rates (6 cells)
    passRate1Short: doublePrecision('pass_rate_1_short'),
    passRate1Mid: doublePrecision('pass_rate_1_mid'),
    passRate1Long: doublePrecision('pass_rate_1_long'),
    passRate2Short: doublePrecision('pass_rate_2_short'),
    passRate2Mid: doublePrecision('pass_rate_2_mid'),
    passRate2Long: doublePrecision('pass_rate_2_long'),
    passRate3Short: doublePrecision('pass_rate_3_short'),
    passRate3Mid: doublePrecision('pass_rate_3_mid'),
    passRate3Long: doublePrecision('pass_rate_3_long'),
    // Situational
    shotgunRate: doublePrecision('shotgun_rate'),
    playActionRate: doublePrecision('play_action_rate'),
    motionRate: doublePrecision('motion_rate'),
    noHuddleRate: doublePrecision('no_huddle_rate'),
    // Score-state pass rates (5 cells)
    scoreLeadingBigPassRate: doublePrecision('score_leading_big_pass_rate'),
    scoreLeadingSmallPassRate: doublePrecision('score_leading_small_pass_rate'),
    scoreTiedPassRate: doublePrecision('score_tied_pass_rate'),
    scoreTrailingSmallPassRate: doublePrecision('score_trailing_small_pass_rate'),
    scoreTrailingBigPassRate: doublePrecision('score_trailing_big_pass_rate'),
    // Tempo + personnel
    secondsPerSnap: doublePrecision('seconds_per_snap'),
    personnelTopGroups: jsonb('personnel_top_groups'), // [{grouping: '11', share: 0.64}, ...]
    // Defensive-only
    blitzRate: doublePrecision('blitz_rate'),          // NULL for HC/OC rows
    // 4th-down (Pats only; league context via a reference line)
    fourthDownDecisions: jsonb('fourth_down_decisions'), // [{week, wpBoostGo, wentForIt, goRecommended, result}, ...]
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.team, table.season, table.week, table.coachRole] }),
    check('coach_role_chk', sql`${table.coachRole} IN ('HC', 'OC', 'DC')`),
  ],
);

export type CoachingTendencyWeekly = typeof coachingTendenciesWeekly.$inferSelect;


// =============================================================================
// E10b — AI Authoring Studio (lnv plan §3.2)
// =============================================================================
//
// Four tables underlying the authoring pipeline + studio UI:
//   - authoring_drafts:     drafts (DB-only persistence per codex CRITICAL #1)
//   - authoring_backlog:    topic queue feeding scheduled slots
//   - authoring_schedules:  deterministic upcoming generations (Wed preview, Sun recap)
//   - authoring_runs:       per-LLM-call telemetry (cost, tokens, cache hits, factcheck)
//
// State machines mirrored in TS-side enums below + DB CHECK constraints. The two
// must stay in sync; the e10b/L0-22 test gate verifies.

export const AUTHORING_DRAFT_STATUSES = [
  'draft',
  'approved',
  'exported',  // sent to Beehiiv as draft post; awaiting send confirmation
  'published',
  'rejected',
  'archived',
] as const;
export type AuthoringDraftStatus = (typeof AUTHORING_DRAFT_STATUSES)[number];

export const AUTHORING_BACKLOG_STATUSES = ['pending', 'scheduled', 'used', 'archived'] as const;
export type AuthoringBacklogStatus = (typeof AUTHORING_BACKLOG_STATUSES)[number];

export const AUTHORING_SCHEDULE_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'skipped',
] as const;
export type AuthoringScheduleStatus = (typeof AUTHORING_SCHEDULE_STATUSES)[number];

export const AUTHORING_FACTCHECK_STATUSES = ['pending', 'pass', 'fail'] as const;
export type AuthoringFactcheckStatus = (typeof AUTHORING_FACTCHECK_STATUSES)[number];

export const AUTHORING_TRIGGERS = ['cli', 'cron', 'studio_button', 'regenerate_section'] as const;
export type AuthoringTrigger = (typeof AUTHORING_TRIGGERS)[number];

// -----------------------------------------------------------------------------
// authoring_drafts — one row per generated piece. Markdown lives in the row
// (codex CRITICAL #1 fix; Vercel filesystem is read-only/ephemeral). The
// content_sha256 is a cache key for concurrent-edit detection (409 on conflict).
// -----------------------------------------------------------------------------
export const authoringDrafts = pgTable(
  'authoring_drafts',
  {
    id: text('id').primaryKey(),
    contentType: text('content_type').notNull(),
    title: text('title'),
    slug: text('slug').notNull().unique(),
    markdownContent: text('markdown_content').notNull(),
    contentSha256: text('content_sha256'),
    status: text('status').notNull().default('draft').$type<AuthoringDraftStatus>(),
    beehiivPostId: text('beehiiv_post_id'),
    beehiivPostUrl: text('beehiiv_post_url'),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    exportedAt: timestamp('exported_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectedReason: text('rejected_reason'),
    factcheckStatus: text('factcheck_status')
      .notNull()
      .default('pending')
      .$type<AuthoringFactcheckStatus>(),
    factcheckFindings: jsonb('factcheck_findings'),
    sourceDataHash: text('source_data_hash'),
    costUsd: doublePrecision('cost_usd'),
    metadata: jsonb('metadata'),
  },
  (table) => [
    check(
      'authoring_drafts_status_chk',
      sql`${table.status} IN ('draft','approved','exported','published','rejected','archived')`,
    ),
    check(
      'authoring_drafts_factcheck_chk',
      sql`${table.factcheckStatus} IN ('pending','pass','fail')`,
    ),
    index('authoring_drafts_status_idx').on(table.status),
    index('authoring_drafts_type_generated_idx').on(table.contentType, table.generatedAt),
  ],
);

export type AuthoringDraft = typeof authoringDrafts.$inferSelect;
export type NewAuthoringDraft = typeof authoringDrafts.$inferInsert;

// -----------------------------------------------------------------------------
// authoring_backlog — topic queue. Each row is an idea/topic that may become
// content. State flows pending → scheduled → used → archived.
// -----------------------------------------------------------------------------
export const authoringBacklog = pgTable(
  'authoring_backlog',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    notes: text('notes'),
    contentType: text('content_type'),
    priority: smallint('priority').notNull().default(2),
    source: text('source').notNull(),
    status: text('status').notNull().default('pending').$type<AuthoringBacklogStatus>(),
    usedInDraftId: text('used_in_draft_id').references(() => authoringDrafts.id),
    scheduledForSlot: text('scheduled_for_slot'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'authoring_backlog_status_chk',
      sql`${table.status} IN ('pending','scheduled','used','archived')`,
    ),
    check(
      'authoring_backlog_priority_chk',
      sql`${table.priority} BETWEEN 0 AND 4`,
    ),
    index('authoring_backlog_status_idx').on(table.status),
    index('authoring_backlog_priority_idx').on(table.priority),
  ],
);

export type AuthoringBacklog = typeof authoringBacklog.$inferSelect;
export type NewAuthoringBacklog = typeof authoringBacklog.$inferInsert;

// -----------------------------------------------------------------------------
// authoring_schedules — deterministic upcoming generations driven by E9
// ScheduleSnapshot. Cron tick reads queued rows where scheduled_at <= now().
// -----------------------------------------------------------------------------
export const authoringSchedules = pgTable(
  'authoring_schedules',
  {
    id: text('id').primaryKey(),
    contentType: text('content_type').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    contextKey: text('context_key'),
    draftId: text('draft_id').references(() => authoringDrafts.id),
    status: text('status').notNull().default('queued').$type<AuthoringScheduleStatus>(),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorText: text('error_text'),
    attempts: smallint('attempts').notNull().default(0),
    metadata: jsonb('metadata'),
  },
  (table) => [
    check(
      'authoring_schedules_status_chk',
      sql`${table.status} IN ('queued','running','completed','failed','skipped')`,
    ),
    index('authoring_schedules_sched_status_idx').on(table.scheduledAt, table.status),
  ],
);

export type AuthoringSchedule = typeof authoringSchedules.$inferSelect;
export type NewAuthoringSchedule = typeof authoringSchedules.$inferInsert;

// -----------------------------------------------------------------------------
// authoring_runs — per-LLM-call telemetry. Each generateDraft() invocation
// writes one row, regardless of trigger (cli/cron/studio_button).
// Heartbeat rows have draft_id=null and trigger='cron'.
// -----------------------------------------------------------------------------
export const authoringRuns = pgTable(
  'authoring_runs',
  {
    id: serial('id').primaryKey(),
    draftId: text('draft_id').references(() => authoringDrafts.id),
    contentType: text('content_type').notNull(),
    trigger: text('trigger').notNull().$type<AuthoringTrigger>(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cacheReadTokens: integer('cache_read_tokens'),
    cacheWriteTokens: integer('cache_write_tokens'),
    costUsd: doublePrecision('cost_usd'),
    promptCacheHit: boolean('prompt_cache_hit'),
    factcheckStatus: text('factcheck_status').$type<AuthoringFactcheckStatus | null>(),
    durationMs: integer('duration_ms'),
    errorText: text('error_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'authoring_runs_trigger_chk',
      sql`${table.trigger} IN ('cli','cron','studio_button','regenerate_section')`,
    ),
    check(
      'authoring_runs_factcheck_chk',
      sql`${table.factcheckStatus} IS NULL OR ${table.factcheckStatus} IN ('pending','pass','fail')`,
    ),
    index('authoring_runs_created_idx').on(table.createdAt),
    index('authoring_runs_type_created_idx').on(table.contentType, table.createdAt),
  ],
);

export type AuthoringRun = typeof authoringRuns.$inferSelect;
export type NewAuthoringRun = typeof authoringRuns.$inferInsert;
