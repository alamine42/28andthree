CREATE TABLE "coaching_tendencies_weekly" (
	"team" varchar(3) NOT NULL,
	"season" smallint NOT NULL,
	"week" smallint NOT NULL,
	"coach_role" varchar(3) NOT NULL,
	"coach_id" text,
	"coach_name" text NOT NULL,
	"pass_rate_1_short" double precision,
	"pass_rate_1_mid" double precision,
	"pass_rate_1_long" double precision,
	"pass_rate_2_short" double precision,
	"pass_rate_2_mid" double precision,
	"pass_rate_2_long" double precision,
	"pass_rate_3_short" double precision,
	"pass_rate_3_mid" double precision,
	"pass_rate_3_long" double precision,
	"shotgun_rate" double precision,
	"play_action_rate" double precision,
	"motion_rate" double precision,
	"no_huddle_rate" double precision,
	"score_leading_big_pass_rate" double precision,
	"score_leading_small_pass_rate" double precision,
	"score_tied_pass_rate" double precision,
	"score_trailing_small_pass_rate" double precision,
	"score_trailing_big_pass_rate" double precision,
	"seconds_per_snap" double precision,
	"personnel_top_groups" jsonb,
	"blitz_rate" double precision,
	"fourth_down_decisions" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coaching_tendencies_weekly_team_season_week_coach_role_pk" PRIMARY KEY("team","season","week","coach_role"),
	CONSTRAINT "coach_role_chk" CHECK ("coaching_tendencies_weekly"."coach_role" IN ('HC', 'OC', 'DC'))
);
--> statement-breakpoint
CREATE TABLE "draft_expected_value" (
	"pick_overall" smallint NOT NULL,
	"position_bucket" varchar(10) NOT NULL,
	"expected_value" double precision NOT NULL,
	"fit_version" smallint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_expected_value_pick_overall_position_bucket_pk" PRIMARY KEY("pick_overall","position_bucket")
);
--> statement-breakpoint
CREATE TABLE "draft_outcomes_historical" (
	"draft_season" smallint NOT NULL,
	"pick_overall" smallint NOT NULL,
	"gsis_id" text,
	"position" varchar(3),
	"team" varchar(3),
	"career_epa" double precision,
	"career_seasons" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_outcomes_historical_draft_season_pick_overall_pk" PRIMARY KEY("draft_season","pick_overall")
);
--> statement-breakpoint
CREATE TABLE "draft_picks" (
	"draft_season" smallint NOT NULL,
	"round" smallint NOT NULL,
	"pick_overall" smallint NOT NULL,
	"gsis_id" text,
	"position" varchar(3),
	"traded_to" varchar(3),
	"player_name" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_picks_draft_season_pick_overall_pk" PRIMARY KEY("draft_season","pick_overall")
);
--> statement-breakpoint
ALTER TABLE "plays" ALTER COLUMN "personnel_offense" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "plays" ALTER COLUMN "personnel_defense" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "skill_season" ADD COLUMN "epa_receiving" double precision;--> statement-breakpoint
ALTER TABLE "skill_season" ADD COLUMN "epa_rushing" double precision;--> statement-breakpoint
ALTER TABLE "skill_weekly" ADD COLUMN "epa_receiving" double precision;--> statement-breakpoint
ALTER TABLE "skill_weekly" ADD COLUMN "epa_rushing" double precision;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_gsis_id_players_gsis_id_fk" FOREIGN KEY ("gsis_id") REFERENCES "public"."players"("gsis_id") ON DELETE no action ON UPDATE no action;