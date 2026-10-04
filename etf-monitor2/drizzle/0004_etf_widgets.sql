CREATE TABLE "etf_widgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"etf_id" integer NOT NULL,
	"slot" smallint NOT NULL,
	"operation" text NOT NULL,
	"field_key" text NOT NULL,
	"period_unit" text NOT NULL,
	"period_amount" integer NOT NULL,
	"title" text,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "etf_widgets_etf_id_slot_unique" UNIQUE("etf_id","slot"),
	CONSTRAINT "etf_widgets_slot_range" CHECK ("etf_widgets"."slot" between 1 and 6),
	CONSTRAINT "etf_widgets_operation_closed" CHECK ("etf_widgets"."operation" in ('change', 'percent_change', 'average', 'min', 'max')),
	CONSTRAINT "etf_widgets_period_unit_closed" CHECK ("etf_widgets"."period_unit" in ('days', 'reports')),
	CONSTRAINT "etf_widgets_period_amount_range" CHECK ("etf_widgets"."period_amount" between 1 and 365)
);
--> statement-breakpoint
ALTER TABLE "etf_widgets" ADD CONSTRAINT "etf_widgets_etf_id_etfs_id_fk" FOREIGN KEY ("etf_id") REFERENCES "public"."etfs"("id") ON DELETE cascade ON UPDATE no action;