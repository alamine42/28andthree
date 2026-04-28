CREATE TABLE "authoring_backlog" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"content_type" text,
	"priority" smallint DEFAULT 2 NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"used_in_draft_id" text,
	"scheduled_for_slot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authoring_backlog_status_chk" CHECK ("authoring_backlog"."status" IN ('pending','scheduled','used','archived')),
	CONSTRAINT "authoring_backlog_priority_chk" CHECK ("authoring_backlog"."priority" BETWEEN 0 AND 4)
);
--> statement-breakpoint
CREATE TABLE "authoring_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"title" text,
	"slug" text NOT NULL,
	"markdown_content" text NOT NULL,
	"content_sha256" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"beehiiv_post_id" text,
	"beehiiv_post_url" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"exported_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejected_reason" text,
	"factcheck_status" text DEFAULT 'pending' NOT NULL,
	"factcheck_findings" jsonb,
	"source_data_hash" text,
	"cost_usd" double precision,
	"metadata" jsonb,
	CONSTRAINT "authoring_drafts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "authoring_drafts_status_chk" CHECK ("authoring_drafts"."status" IN ('draft','approved','exported','published','rejected','archived')),
	CONSTRAINT "authoring_drafts_factcheck_chk" CHECK ("authoring_drafts"."factcheck_status" IN ('pending','pass','fail'))
);
--> statement-breakpoint
CREATE TABLE "authoring_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"draft_id" text,
	"content_type" text NOT NULL,
	"trigger" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"cache_write_tokens" integer,
	"cost_usd" double precision,
	"prompt_cache_hit" boolean,
	"factcheck_status" text,
	"duration_ms" integer,
	"error_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authoring_runs_trigger_chk" CHECK ("authoring_runs"."trigger" IN ('cli','cron','studio_button','regenerate_section'))
);
--> statement-breakpoint
CREATE TABLE "authoring_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"context_key" text,
	"draft_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_text" text,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "authoring_schedules_status_chk" CHECK ("authoring_schedules"."status" IN ('queued','running','completed','failed','skipped'))
);
--> statement-breakpoint
ALTER TABLE "authoring_backlog" ADD CONSTRAINT "authoring_backlog_used_in_draft_id_authoring_drafts_id_fk" FOREIGN KEY ("used_in_draft_id") REFERENCES "public"."authoring_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authoring_runs" ADD CONSTRAINT "authoring_runs_draft_id_authoring_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."authoring_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authoring_schedules" ADD CONSTRAINT "authoring_schedules_draft_id_authoring_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."authoring_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "authoring_backlog_status_idx" ON "authoring_backlog" USING btree ("status");--> statement-breakpoint
CREATE INDEX "authoring_backlog_priority_idx" ON "authoring_backlog" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "authoring_drafts_status_idx" ON "authoring_drafts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "authoring_drafts_type_generated_idx" ON "authoring_drafts" USING btree ("content_type","generated_at");--> statement-breakpoint
CREATE INDEX "authoring_runs_created_idx" ON "authoring_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "authoring_runs_type_created_idx" ON "authoring_runs" USING btree ("content_type","created_at");--> statement-breakpoint
CREATE INDEX "authoring_schedules_sched_status_idx" ON "authoring_schedules" USING btree ("scheduled_at","status");