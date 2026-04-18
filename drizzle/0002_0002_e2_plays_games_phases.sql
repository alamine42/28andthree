CREATE TYPE "public"."phase_enum" AS ENUM('pass_offense', 'rush_offense', 'overall_offense', 'pass_defense', 'run_defense', 'redzone_offense', 'redzone_defense', 'third_down_offense', 'third_down_defense', 'explosive_offense', 'explosive_defense', 'special_teams');--> statement-breakpoint
CREATE TABLE "games" (
	"game_id" text PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"week" smallint NOT NULL,
	"season_type" varchar(4) NOT NULL,
	"home_team" varchar(3) NOT NULL,
	"away_team" varchar(3) NOT NULL,
	"home_score" smallint,
	"away_score" smallint,
	"game_date" date NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"posteam_epa" double precision,
	"defteam_epa" double precision,
	CONSTRAINT "games_season_type_chk" CHECK ("games"."season_type" IN ('REG', 'POST'))
);
--> statement-breakpoint
CREATE TABLE "plays" (
	"game_id" text NOT NULL,
	"play_id" integer NOT NULL,
	"season" integer NOT NULL,
	"week" smallint NOT NULL,
	"season_type" varchar(4) NOT NULL,
	"posteam" varchar(3),
	"defteam" varchar(3),
	"down" smallint,
	"ydstogo" smallint,
	"yardline_100" smallint,
	"play_type" varchar(16),
	"yards_gained" smallint,
	"epa" double precision,
	"cpoe" double precision,
	"success" boolean,
	"wp" double precision,
	"qb_dropback" boolean,
	"qb_kneel" boolean,
	"qb_spike" boolean,
	"two_point_attempt" boolean,
	"pass_attempt" boolean,
	"rush_attempt" boolean,
	"pass_length" varchar(8),
	"air_yards" smallint,
	"is_redzone" boolean GENERATED ALWAYS AS (yardline_100 <= 20) STORED,
	"is_third_down" boolean GENERATED ALWAYS AS (down = 3) STORED,
	"is_explosive_pass" boolean,
	"is_explosive_run" boolean,
	"special_teams_play" boolean,
	"qb_hit" boolean,
	"sack" boolean,
	"was_pressure" boolean,
	"number_of_pass_rushers" smallint,
	"shotgun" boolean,
	"no_huddle" boolean,
	"pre_snap_motion" boolean,
	"play_action" boolean,
	"personnel_offense" varchar(16),
	"personnel_defense" varchar(16),
	"defenders_in_box" smallint,
	"score_differential" smallint,
	"game_seconds_remaining" smallint,
	"posteam_timeouts_remaining" smallint,
	"defteam_timeouts_remaining" smallint,
	"roof" varchar(12),
	"surface" varchar(16),
	CONSTRAINT "plays_pkey" PRIMARY KEY("game_id","play_id"),
	CONSTRAINT "plays_season_type_chk" CHECK ("plays"."season_type" IN ('REG', 'POST'))
);
--> statement-breakpoint
CREATE TABLE "team_phase_season" (
	"team" varchar(3) NOT NULL,
	"season" integer NOT NULL,
	"phase" "phase_enum" NOT NULL,
	"plays" integer NOT NULL,
	"epa_per_play" double precision,
	"success_rate" double precision,
	"rank" smallint,
	"percentile" double precision,
	"insufficient_sample" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_phase_weekly" (
	"team" varchar(3) NOT NULL,
	"season" integer NOT NULL,
	"week" smallint NOT NULL,
	"phase" "phase_enum" NOT NULL,
	"plays" integer NOT NULL,
	"epa_per_play" double precision,
	"success_rate" double precision,
	"rank" smallint,
	"percentile" double precision,
	"insufficient_sample" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_game_id_games_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("game_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_phase_season_unique" ON "team_phase_season" USING btree ("team","season","phase");--> statement-breakpoint
CREATE UNIQUE INDEX "team_phase_weekly_unique" ON "team_phase_weekly" USING btree ("team","season","week","phase");