CREATE TABLE "etf_report_links" (
	"etf_id" integer PRIMARY KEY NOT NULL,
	"source_url" text NOT NULL,
	"discovered_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "etf_report_links" ADD CONSTRAINT "etf_report_links_etf_id_etfs_id_fk" FOREIGN KEY ("etf_id") REFERENCES "public"."etfs"("id") ON DELETE cascade ON UPDATE no action;