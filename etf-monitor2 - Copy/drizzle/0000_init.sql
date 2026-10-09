CREATE TABLE "etfs" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"bvb_url" text NOT NULL,
	"adapter_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "etfs_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "field_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"adapter_key" text NOT NULL,
	"field_key" text NOT NULL,
	"label_ro" text NOT NULL,
	"label_en" text NOT NULL,
	"unit" text,
	CONSTRAINT "field_catalog_adapter_key_field_key_unique" UNIQUE("adapter_key","field_key")
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"etfs_processed" integer DEFAULT 0 NOT NULL,
	"errors_count" integer DEFAULT 0 NOT NULL,
	"log" text
);
--> statement-breakpoint
CREATE TABLE "report_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"field_key" text NOT NULL,
	"numeric_value" numeric,
	"raw_value" text,
	CONSTRAINT "report_values_report_id_field_key_unique" UNIQUE("report_id","field_key")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"etf_id" integer NOT NULL,
	"report_date" date NOT NULL,
	"source_url" text,
	"fetched_at" timestamp with time zone,
	"status" text NOT NULL,
	"error_message" text,
	CONSTRAINT "reports_etf_id_report_date_unique" UNIQUE("etf_id","report_date")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"ai_provider" text,
	"ai_model" text,
	"cron_hour_utc" integer,
	"default_locale" text DEFAULT 'ro' NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "tracked_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"etf_id" integer NOT NULL,
	"field_key" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tracked_fields_etf_id_field_key_unique" UNIQUE("etf_id","field_key")
);
--> statement-breakpoint
ALTER TABLE "report_values" ADD CONSTRAINT "report_values_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_etf_id_etfs_id_fk" FOREIGN KEY ("etf_id") REFERENCES "public"."etfs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_fields" ADD CONSTRAINT "tracked_fields_etf_id_etfs_id_fk" FOREIGN KEY ("etf_id") REFERENCES "public"."etfs"("id") ON DELETE cascade ON UPDATE no action;