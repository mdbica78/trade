# US-062 plan — Daily job hour editable in the app

Date: 2026-10-09. Scope follows the user's BR4 and the technical decisions in DEC-030.

## Data / schema impact
**DEC-030's "no migration" claim is incorrect and is replaced.** Add nullable `job_runs.scheduled_date_utc date`, a unique index on that column (multiple historical `NULL` rows remain valid), and a btree index on `job_runs.started_at` for UTC-day range probes. Generate an expand-only migration with `pnpm db:generate`; update Drizzle schema, snapshot, journal, architecture/data-model documentation and `test/helpers/pglite.migrations.test.ts`. Never run the migration against Neon; production build applies it per DEC-023. `settings.cron_hour_utc` already exists, so no settings migration.

## Binding decisions
- `NULL`/missing `settings.cron_hour_utc` means **10:00 UTC** (existing default); no clear option. Persisted values must be integer 0–23.
- Hour only; no minutes/weekdays. Store/gate UTC; display corresponding Europe/Bucharest time.
- Run when `now.getUTCHours() >= effectiveHour`, allowing next-hour catch-up after a missed hourly ping.
- Any `job_runs` row with `started_at` in the invocation's current UTC date counts, regardless of `running`, `success`, `partial`, or `failed`. A failed/partial/stale run consumes the date; there is no retry that UTC day.
- Every admitted run atomically creates its own `running` job row with `scheduled_date_utc` set. A single SQL insert-select checks no `started_at` row in `[UTC midnight, next UTC midnight)`, then `ON CONFLICT (scheduled_date_utc) DO NOTHING RETURNING id`. The unique index is the race guard for concurrent hourly requests; old rows have `scheduled_date_utc NULL` and are still seen by the date-range check. The claimed row is finalized through the existing job-run lifecycle; do not create a second row.
- Before-hour/skipped and unauthorized calls create no `job_runs` row. Check bearer `CRON_SECRET` before reading schedule or touching the database. Duplicate claim returns `{skipped:"already_ran"}`; before configured hour returns `{skipped:"not_scheduled_hour"}`; both HTTP 200 and `no-store`.
- Keep the existing daily `vercel.json` cron as a safety net. It calls the same authenticated gated route, and the unique claim prevents duplicate execution alongside GitHub Actions.
- Ship an hourly (`0 * * * *`) sample GitHub Actions workflow with `workflow_dispatch`, read-only repository permission, no tracing or secret echo, using repository secrets `ETF_MONITOR_BASE_URL` and `CRON_SECRET`. Document how the user adds these secrets; do not request or store values in source.

## Files and implementation
- `lib/db/schema.ts`, new generated `drizzle/0007_cron_daily_claim.sql`, `drizzle/meta/0007_snapshot.json`, `drizzle/meta/_journal.json`, `test/helpers/pglite.migrations.test.ts`: nullable day marker, unique day index, started_at index and migration proof.
- `lib/ingestion/job-runs.ts`: add `claimScheduledRun` builder/store method, returning `number | null`, with one atomic insert-select and the existing single-statement runner convention. Leave ordinary `startRun` behavior unchanged for non-scheduled test/tool callers.
- `lib/ingestion/job-runs.test.ts` / `.pglite.test.ts` (locate/add alongside current job-run tests): any-status day detection, bounded UTC date range, prior rows with NULL marker, uniqueness/collision and one-run-row lifecycle.
- `lib/cron/daily-job.ts`, `daily-job.test.ts`: accept a supplied invocation timestamp/date for scheduled runs, stale-sweep then claim, return explicit skipped result if claim loses; finalize the claimed ID without `startRun`.
- `lib/cron/daily-handler.ts`, `daily-handler.test.ts`: dependency seam for `now` and effective hour; authenticate first; 200/no-write for pre-hour/already-run; explicit generic/sanitized errors otherwise. Existing result types/tests updated for `skipped`.
- `lib/cron/default-deps.ts`, tests: inject same `now`, settings reader and scheduled-claim store. `app/api/cron/daily/route.ts` and `route.test.ts`: new default wiring, bearer order, decision table; deliberately replace BC-8.
- `lib/config/cron.ts`, `cron.pglite.test.ts`/`cron.test.ts`, admin action/page tests: `getCronHour` resolves NULL to 10, `setCronHour` accepts only 0–23 and has no clear path; keep a current-hour helper independent of `vercel.json`. Preserve `vercel-config.test.ts` as a check that the safety-net cron still points to the endpoint.
- `lib/admin/operations.ts` and tests: read the latest job run using existing run model, no leaked log/secret; pass to `/admin/cron`.
- `components/admin/CronAdmin.tsx`, `app/admin/cron/page.tsx`, messages EN/RO: show saved/default hour, UTC + Bucharest equivalents, hourly external-ping setup hint and last run; remove paste-into-vercel wording and empty option.
- `.github/workflows/daily-ping.yml` (new), `README.md`, `test/readme-deployment.test.ts` and new/extended workflow guard test: hourly UTC schedule, manual trigger, URL/secret from repository secrets only, `curl` bearer call, documentation including user-only secret setup.
- `dev_minions/architecture/data-model.md`: document UTC run claim marker, uniqueness, all-status daily idempotence and migration ownership.
- `lib/config/boundaries.test.ts`: replace BC-8's "route never reads cron hour" pin with the exact approved caller/writer boundary. Add source boundary coverage for the run-claim SQL owner if needed.
- `messages/en.json`, `messages/ro.json`: localized setting, skip, scheduler and last-run strings.

## Deliberate test / snapshot changes
BC-8 intentionally changes from asserting the route never consults `cron_hour_utc` to proving only the cron gate uses the config reader. `vercel-config.test.ts` must assert the Vercel daily fallback remains. Update route/handler result-shape expectations for the two `skipped` responses and the settings null default. No test may be removed or loosened. No admin golden snapshot is expected unless markup is structurally changed; if so, list affected regions and use a normal run.

## Risks and proof
The main risks are concurrent pings, stale legacy runs, UTC midnight, Vercel/GitHub overlap, and accidentally logging the bearer. The unique claim index closes concurrency; UTC range bounds plus `started_at` index check pre-migration history; PGlite tests must include a date straddling UTC midnight and failed/running/partial/success rows. Hour-only catch-up may run later than configured if the scheduler misses an hour; this is intentional. No retry after any same-day run is intentional. Workflow must never print credentials. Full gates: focused config/handler/job-run/route/migration/docs tests; typecheck, lint, full suite, offline build and predeploy check. Manual QA after deploy: save 0 and 23, check Bucharest rendering; invoke authorized hourly route before/after threshold and confirm skipped/no-row versus exactly one finalized row; concurrent/cross-scheduler behavior is proved offline, not by manually generating duplicate production runs.

## Order
1. Add schema/migration and atomic scheduled claim, with PGlite proof.
2. Thread the scheduled claim through job runner, handler, route and settings gate; replace BC-8 and test all status/date/auth cases.
3. Update admin hour form/read model, localization and safe last-run display.
4. Add hourly GitHub Actions workflow, README and source guard tests; update data-model docs.
5. Generate migration offline, run focused migration/job/route/admin/docs tests, then all gates; prepare live QA checklist with repository-secret setup as a user-only action.
