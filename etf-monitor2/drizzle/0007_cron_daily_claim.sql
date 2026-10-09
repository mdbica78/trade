ALTER TABLE "job_runs" ADD COLUMN "scheduled_date_utc" date;--> statement-breakpoint
CREATE UNIQUE INDEX "job_runs_scheduled_date_utc_unique" ON "job_runs" USING btree ("scheduled_date_utc");--> statement-breakpoint
CREATE INDEX "job_runs_started_at_idx" ON "job_runs" USING btree ("started_at");
