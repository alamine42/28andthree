-- Hand-written follow-on migration for E2 plays indexes. drizzle-kit's schema
-- builder doesn't emit partial indexes; rather than bend the TS schema to force
-- drizzle's hand, we keep 0002 clean and layer indexes here.
--
-- Created CONCURRENTLY so future re-runs against non-empty tables don't block.
-- The migrator role must run each statement outside a transaction; drizzle-kit
-- migrate wraps each file in a txn by default, so this file must be run via
-- `drizzle-kit push` OR its CONCURRENTLY keyword dropped for the initial empty
-- backfill. Initial load is into an empty table, so we use plain CREATE INDEX
-- here. Re-running is idempotent via IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS "plays_offense_idx" ON "plays" ("season", "week", "posteam");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plays_defense_idx" ON "plays" ("season", "week", "defteam");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plays_special_teams_idx" ON "plays" ("season", "week") WHERE "special_teams_play" = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plays_redzone_idx" ON "plays" ("season", "week") WHERE "is_redzone" = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plays_third_down_idx" ON "plays" ("season", "week") WHERE "is_third_down" = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_season_completed_idx" ON "games" ("season", "completed");
