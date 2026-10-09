# DEC-030 — User-editable daily schedule (external hourly ping + hour gate)

Status: **Decided** — external hourly scheduler is the user's product choice; technical gate semantics validated by the Technical Lead (2026-10-09).

## Context
`settings.cron_hour_utc` is stored but never read by the cron route (BC-8). The real schedule is the static `vercel.json` entry (DEC-016), so changing the hour currently needs a developer. Vercel Hobby allows one cron per day, at a fixed time. The user wants to change the hour in the app and use an external free scheduler that pings hourly.

## Decision (user's choice + tech-lead technical defaults)
An external hourly scheduler (sample: GitHub Actions `schedule`) calls `GET /api/cron/daily` with bearer `CRON_SECRET`. The route runs the job only when the current UTC hour is at or after the stored hour (default 10) and no job run has started for the current UTC date. Otherwise it returns HTTP 200 `{skipped: "not_scheduled_hour" | "already_ran"}` without writing a `job_runs` row.

## Binding details
1. Hour only (0–23 UTC, using existing `settings.cron_hour_utc`). The UI shows the Europe/Bucharest equivalent. Minute and weekdays are out of scope.
2. `NULL`/missing means 10 UTC for legacy settings. The form requires a value, has no clear action, and accepts integer 0–23 only.
3. Gate is `now.getUTCHours() >= storedHour` and no run for the current UTC date. This is the catch-up rule: missed configured-hour pings self-heal at the next hourly ping.
4. Any `job_runs` row with `started_at` within that UTC day counts, whatever its status (`running`, `success`, `partial`, or `failed`). A run that failed or was interrupted consumes that day; there is no same-day retry. A skipped ping writes no run row.
5. `vercel.json`'s daily cron stays as a safety net; it hits the same authenticated gated route. GitHub Actions provides the hourly ping. Concurrent callers must not both run.
6. **A migration is required for race-safe idempotence.** Add nullable `job_runs.scheduled_date_utc date`, a unique index on that column (historical `NULL`s do not conflict), and a `started_at` btree index for the historical UTC-day range check. The route's single atomic insert-select claims the day only if no row has started within that UTC day; a unique conflict means `already_ran`. Existing rows with a `NULL` marker are detected by the `started_at` bounds.
7. The claim row is also the job-run row: finalize it through the existing lifecycle; do not create a second row. Check bearer `CRON_SECRET` before schedule/database work.
8. Ship `.github/workflows/daily-ping.yml` for hourly requests and document it in README. The user later adds repository secrets `CRON_SECRET` and `ETF_MONITOR_BASE_URL`; no secret value is needed during development.

## Consequences
Replace BC-8's "route never reads the hour" pin with a test of the gated path. `/admin/cron` no longer asks the user to edit `vercel.json`; it shows the saved hour, localized Bucharest equivalent, last run and external-scheduler setup guidance.

## Verification note
The earlier "no table, no migration" claim was unverified and is superseded. A nullable day marker and unique index are needed to prevent simultaneous hourly/Vercel requests from both passing a read-before-write check; the `started_at` index supports the range check against historical rows. The developer generates the expand-only migration with `pnpm db:generate`; only the production build applies it (DEC-023).
