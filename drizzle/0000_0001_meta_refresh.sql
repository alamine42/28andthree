CREATE TABLE "meta_refresh" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" varchar(20) NOT NULL,
	"season" integer,
	"week" integer,
	"source_version" varchar(40),
	"row_counts" jsonb,
	"error_text" text
);
