# US-015 — QA checklist (Job run logging)

Round 1: review PASS, tests PASS (613/613 total, 47 new). Sprint 3 audit (`SPRINT-03-audit.md`)
then found one Critical finding (C1): AC4's environment-based test ("H-15b" in the plan) was
cited by both round 1 verdicts but did not actually exist — the delivered tests covered
equivalent ground with different shape, and the shipped code was already correct, but the gap
meant a regression in `lib/cron/default-deps.ts` dropping `secrets` would have stayed green.
Fixed test-only in round 2 (two real H-15b tests plus a new `lib/cron/default-deps.test.ts`).
Round 2: review PASS, tests PASS (617/617 total, 4 new). See `US-015-review.md` (both rounds)
/ `US-015-tests.md` for full evidence. All ACs drafted by `story-planner` and reviewed by
`tech-lead` at sprint-review 3 — no PO-confirm markers on this story's criteria. No decisions
were needed for this story.

## Automated (already verified by this loop, no action needed)
- AC1 (one row per authorized run; unauthorized writes none) — DJ-1a, DJ-1b, H-15a, JP-1
- AC2 (status/counts, 5 cases) — DJ-2a..e, JS-2
- AC3 (every failure code counted, success codes not, unknown code counted) — JS-3a, JS-3b
- AC4 (log format, date only when known, truncation at 300 chars, secrets redacted before
  collapsing/truncation) — JS-4a..e, H-6c, daily-job.test.ts "secrets never reach the stored log"
- AC5 (abort handling: ETF-query throw, non-Error throw, failStaleRuns/startRun rejection,
  finishRun rejection with no retry) — DJ-5a..e, H-15c
- AC6 (stale-run sweep: real SQL sweep, exact-cutoff boundary not swept, idempotent re-sweep,
  threshold constant strictly greater than `maxDuration`) — JP-6a..c, DJ-6a, JP-15, RT-15
- AC7 (response carries `jobRunId` and final `status`) — H-15d, H-15c, DJ-7
- AC8 (fully offline: fetch stubbed and asserted uncalled, PGlite in-process only, Neon mocked
  in DD-15, no live network in any new test) — verified by grep across all new test files
- AC10 (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) — all green

## MANUAL-QA (AC9) — live Vercel/Neon, for the Codex QA/Deploy loop or the user
No migration needed: `job_runs` already existed in `drizzle/0000_init.sql`.
1. Deploy to Production (user pushes; no schema change to apply).
2. `curl -s -H "Authorization: Bearer <CRON_SECRET>" https://etf-monitor2.vercel.app/api/cron/daily`
   → `200`, JSON body has a numeric `jobRunId`, a `status`, and one `etfs` entry per active ETF.
3. Neon SQL editor:
   `select id, started_at, finished_at, status, etfs_processed, errors_count, log from job_runs order by id desc limit 5;`
   The newest row's `id` matches the response's `jobRunId`, `finished_at` is set,
   `etfs_processed = 3`, `errors_count` equals the number of non-`ok`/non-`already_ingested`
   outcomes in the response, and `log`'s first line is `<status>: 3 processed, <n> errors`
   followed by one `<SYMBOL> <code> <date> <detail>` line per ETF.
4. Trigger again the same day: the new row is `success`, `3 processed, 0 errors`, and all three
   log lines read `already_ingested <date> report already stored`.
5. Search the newest rows' `log` for the `CRON_SECRET` value and the Neon host/password:
   `select id from job_runs where log like '%<first 8 chars of the secret>%';` → no rows.
6. The next day, with no manual action: a new `job_runs` row appears with `started_at` between
   10:00 and 10:59 UTC.
7. Optional stale-sweep check (writes one throwaway test row):
   `insert into job_runs (started_at, status) values (now() - interval '1 hour', 'running');`,
   then trigger once. That row becomes `failed` with log `did not finish (timed out or crashed)`
   and `finished_at` still null.
8. Known limit (not a defect): when Neon is unreachable, `startRun` itself fails, so no row can
   be written at all. The only trace is the `500 run could not start` response and Vercel's
   function log.

## Non-blocking notes carried from review
- `lib/ingestion/job-run-summary.ts` defines its own `RunStatus` union instead of importing
  `FinalJobRunStatus` from `job-runs.ts`. The two are structurally identical today (proven by
  `job-runs.test.ts`'s separate type-check tying `JobRunStatus` to the DB schema); a future
  change to one without the other would only surface as a type error at the call site in
  `daily-job.ts`, not silently. Low risk, not fixed to keep `job-run-summary.ts` dependency-free
  of `job-runs.ts` as planned.
- The plan's AC4 end-to-end test sketch (a dedicated "H-15b" using `vi.stubEnv` against the real
  `defaultDailyCronDeps.readEnv`) was delivered as equivalent coverage split across `daily-handler.test.ts`'s
  existing H-6c and a dedicated assertion in `daily-job.test.ts` — same guarantee, different
  organization than the plan sketched.

## Files changed
- `lib/ingestion/job-run-summary.ts`, `lib/ingestion/job-run-summary.test.ts`
- `lib/ingestion/job-runs.ts`, `lib/ingestion/job-runs.test.ts`, `lib/ingestion/job-runs.pglite.test.ts`
- `lib/cron/daily-job.ts`, `lib/cron/daily-job.test.ts`
- `test/helpers/job-run-fakes.ts`
- `lib/cron/daily-handler.ts`, `lib/cron/daily-handler.test.ts` (round 2: added the real H-15b env-redaction tests)
- `lib/cron/default-deps.ts`
- `lib/cron/default-deps.test.ts` (round 2, new: proves `secrets` reaches `runDailyJob`)
- `lib/ingestion/default-deps.ts`, `lib/ingestion/default-deps.test.ts`
- `app/api/cron/daily/route.test.ts`
- `lib/ingestion/boundaries.test.ts`
- `README.md`
