CREATE TABLE "players" (
	"gsis_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"position" varchar(3),
	"current_team" varchar(3),
	"current_jersey_number" smallint,
	"rookie_year" smallint,
	"headshot_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qb_season" (
	"gsis_id" text NOT NULL,
	"season" integer NOT NULL,
	"team" varchar(3) NOT NULL,
	"games_played" smallint NOT NULL,
	"primary_starter_games" smallint NOT NULL,
	"dropbacks" integer NOT NULL,
	"attempts" integer NOT NULL,
	"completions" integer NOT NULL,
	"yards" integer NOT NULL,
	"epa_per_dropback" double precision,
	"cpoe" double precision,
	"adot" double precision,
	"success_rate" double precision,
	"pressure_rate" double precision,
	"clean_pocket_epa_per_dropback" double precision,
	"pressured_epa_per_dropback" double precision,
	"deep_epa_per_attempt" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qb_weekly" (
	"gsis_id" text NOT NULL,
	"game_id" text NOT NULL,
	"season" integer NOT NULL,
	"week" smallint NOT NULL,
	"team" varchar(3) NOT NULL,
	"dropbacks" smallint NOT NULL,
	"attempts" smallint NOT NULL,
	"completions" smallint NOT NULL,
	"yards" smallint NOT NULL,
	"epa_per_dropback" double precision,
	"cpoe" double precision,
	"adot" double precision,
	"success_rate" double precision,
	"pressure_rate" double precision,
	"pressured_dropbacks" smallint,
	"clean_pocket_epa_per_dropback" double precision,
	"pressured_epa_per_dropback" double precision,
	"deep_attempts" smallint,
	"deep_completions" smallint,
	"deep_epa_per_attempt" double precision,
	"primary_starter" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster_snapshots" (
	"gsis_id" text NOT NULL,
	"season" integer NOT NULL,
	"team" varchar(3) NOT NULL,
	"jersey_number" smallint,
	"position" varchar(3),
	"display_name" text NOT NULL,
	"headshot_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_season" (
	"gsis_id" text NOT NULL,
	"season" integer NOT NULL,
	"team" varchar(3) NOT NULL,
	"position" varchar(3) NOT NULL,
	"games_played" smallint NOT NULL,
	"targets" integer,
	"receptions" integer,
	"yards_receiving" integer,
	"yac_total" integer,
	"yac_per_reception" double precision,
	"routes" integer,
	"target_share" double precision,
	"adot_on_targets" double precision,
	"redzone_targets" integer,
	"redzone_receptions" integer,
	"carries" integer,
	"yards_rushing" integer,
	"ypc" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_weekly" (
	"gsis_id" text NOT NULL,
	"game_id" text NOT NULL,
	"season" integer NOT NULL,
	"week" smallint NOT NULL,
	"team" varchar(3) NOT NULL,
	"position" varchar(3) NOT NULL,
	"targets" smallint,
	"receptions" smallint,
	"yards_receiving" smallint,
	"yac_total" smallint,
	"yac_per_reception" double precision,
	"routes" smallint,
	"target_share" double precision,
	"adot_on_targets" double precision,
	"redzone_targets" smallint,
	"redzone_receptions" smallint,
	"carries" smallint,
	"yards_rushing" smallint,
	"ypc" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_defense_season" (
	"team" varchar(3) NOT NULL,
	"season" integer NOT NULL,
	"pressure_rate" double precision,
	"coverage_epa_allowed" double precision,
	"run_stop_rate" double precision,
	"explosive_plays_allowed" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_defense_weekly" (
	"team" varchar(3) NOT NULL,
	"season" integer NOT NULL,
	"week" smallint NOT NULL,
	"pressure_rate" double precision,
	"coverage_epa_allowed" double precision,
	"run_stop_rate" double precision,
	"explosive_plays_allowed" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_dl_season" (
	"team" varchar(3) NOT NULL,
	"season" integer NOT NULL,
	"pressures_generated" integer,
	"pass_rush_win_rate" double precision,
	"run_stop_rate" double precision,
	"sack_rate" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_dl_weekly" (
	"team" varchar(3) NOT NULL,
	"season" integer NOT NULL,
	"week" smallint NOT NULL,
	"pressures_generated" smallint,
	"pass_rush_win_rate" double precision,
	"run_stop_rate" double precision,
	"sack_rate" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_ol_season" (
	"team" varchar(3) NOT NULL,
	"season" integer NOT NULL,
	"pass_block_win_rate" double precision,
	"run_block_rate" double precision,
	"pressures_allowed" integer,
	"epa_on_dropbacks" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_ol_weekly" (
	"team" varchar(3) NOT NULL,
	"season" integer NOT NULL,
	"week" smallint NOT NULL,
	"pass_block_win_rate" double precision,
	"run_block_rate" double precision,
	"pressures_allowed" smallint,
	"epa_on_dropbacks" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "participation_coverage" double precision;--> statement-breakpoint
ALTER TABLE "plays" ADD COLUMN "passer_player_id" text;--> statement-breakpoint
ALTER TABLE "plays" ADD COLUMN "passer_player_name" text;--> statement-breakpoint
ALTER TABLE "plays" ADD COLUMN "receiver_player_id" text;--> statement-breakpoint
ALTER TABLE "plays" ADD COLUMN "receiver_player_name" text;--> statement-breakpoint
ALTER TABLE "plays" ADD COLUMN "rusher_player_id" text;--> statement-breakpoint
ALTER TABLE "plays" ADD COLUMN "rusher_player_name" text;--> statement-breakpoint
ALTER TABLE "plays" ADD COLUMN "yards_after_catch" smallint;--> statement-breakpoint
ALTER TABLE "qb_season" ADD CONSTRAINT "qb_season_gsis_id_players_gsis_id_fk" FOREIGN KEY ("gsis_id") REFERENCES "public"."players"("gsis_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qb_weekly" ADD CONSTRAINT "qb_weekly_gsis_id_players_gsis_id_fk" FOREIGN KEY ("gsis_id") REFERENCES "public"."players"("gsis_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qb_weekly" ADD CONSTRAINT "qb_weekly_game_id_games_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("game_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_snapshots" ADD CONSTRAINT "roster_snapshots_gsis_id_players_gsis_id_fk" FOREIGN KEY ("gsis_id") REFERENCES "public"."players"("gsis_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_season" ADD CONSTRAINT "skill_season_gsis_id_players_gsis_id_fk" FOREIGN KEY ("gsis_id") REFERENCES "public"."players"("gsis_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_weekly" ADD CONSTRAINT "skill_weekly_gsis_id_players_gsis_id_fk" FOREIGN KEY ("gsis_id") REFERENCES "public"."players"("gsis_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_weekly" ADD CONSTRAINT "skill_weekly_game_id_games_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("game_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "qb_season_unique" ON "qb_season" USING btree ("gsis_id","season","team");--> statement-breakpoint
CREATE UNIQUE INDEX "qb_weekly_unique" ON "qb_weekly" USING btree ("gsis_id","game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roster_snapshots_unique" ON "roster_snapshots" USING btree ("gsis_id","season","team");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_season_unique" ON "skill_season" USING btree ("gsis_id","season","team");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_weekly_unique" ON "skill_weekly" USING btree ("gsis_id","game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_defense_season_unique" ON "team_defense_season" USING btree ("team","season");--> statement-breakpoint
CREATE UNIQUE INDEX "team_defense_weekly_unique" ON "team_defense_weekly" USING btree ("team","season","week");--> statement-breakpoint
CREATE UNIQUE INDEX "team_dl_season_unique" ON "team_dl_season" USING btree ("team","season");--> statement-breakpoint
CREATE UNIQUE INDEX "team_dl_weekly_unique" ON "team_dl_weekly" USING btree ("team","season","week");--> statement-breakpoint
CREATE UNIQUE INDEX "team_ol_season_unique" ON "team_ol_season" USING btree ("team","season");--> statement-breakpoint
CREATE UNIQUE INDEX "team_ol_weekly_unique" ON "team_ol_weekly" USING btree ("team","season","week");