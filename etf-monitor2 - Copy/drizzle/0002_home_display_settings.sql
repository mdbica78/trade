CREATE TABLE "home_display_columns" (
	"field_key" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"show_absolute" boolean,
	"show_percent" boolean,
	"show_arrow" boolean,
	CONSTRAINT "home_display_columns_position_unique" UNIQUE("position")
);
--> statement-breakpoint
CREATE TABLE "home_display_etfs" (
	"etf_id" integer PRIMARY KEY NOT NULL,
	"visible" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_display_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"show_absolute" boolean DEFAULT true NOT NULL,
	"show_percent" boolean DEFAULT true NOT NULL,
	"show_arrow" boolean DEFAULT true NOT NULL,
	CONSTRAINT "home_display_settings_single_row" CHECK ("home_display_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "home_display_etfs" ADD CONSTRAINT "home_display_etfs_etf_id_etfs_id_fk" FOREIGN KEY ("etf_id") REFERENCES "public"."etfs"("id") ON DELETE cascade ON UPDATE no action;