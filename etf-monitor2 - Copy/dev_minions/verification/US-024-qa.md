# US-024 QA checklist — Admin operational dashboard

Round 1: review PASS (`US-024-review.md`, N1/N2 non-blocking notes), tests PASS (`US-024-tests.md`, 1129/1130 full
suite pass, 1 flaky unrelated timeout passes on retry; 238/238 targeted files pass). Both verdicts in the same round.

## PO to confirm drafted criteria

All 11 acceptance criteria in `dev_minions/backlog/stories/US-024.md` are `DRAFTED BY AGENT — PO to confirm`.
Decisions #14 (translation scope), #15 (no pagination), #16 (timestamp format) shipped isolated defaults; see
"Waiting on the user" below.

## Numbered manual checks (live, after the user deploys)

1. **MQ-1 — run history matches the database.** Open `/admin/operations` in RO and EN on the deployed app. Compare
   the "Job runs" section against:
   `select id, started_at, finished_at, status, etfs_processed, errors_count from job_runs order by started_at desc, id desc;`
   Times shown must be in Romanian local time (e.g. a `started_at` of `…10:0x+00` shows as `13:0x` in summer,
   `12:0x` in winter). Each per-ETF log line shows a translated outcome, not the raw code.
2. **MQ-1 — last successful extraction matches the database.** Compare the "ETFs" section against:
   `select e.symbol, max(r.report_date) from etfs e left join reports r on r.etf_id = e.id and r.status = 'ok' group by e.symbol order by e.symbol;`
   An ETF with no matching row shows "never" (EN) / "niciodată" (RO).
3. **MQ-1 — parse errors are visible.** Any row from `select * from reports where status <> 'ok';` is listed with
   its message, its PDF link (opens in a new tab, `target="_blank" rel="noopener noreferrer"`) when `source_url` is
   set, and its stored values in the DEC-007 number format. An ETF added with no adapter (e.g. one added in
   sprint-05.md step 2) shows "adapter missing" (EN) / "adaptor lipsă" (RO) in the ETFs section.
4. **MQ-2 — truthful outcome codes on the next live daily run.** After the next scheduled cron run on the
   deployment, any ETF failure shown in the log uses the correct code: `no_adapter` only for an ETF with no or an
   unregistered adapter key; `internal_error` never appears for an ordinary fetch/parse/persist failure (it is
   reserved for an internal fault in the adapter lookup or an error escaping `ingestReport`, which cannot be
   triggered on purpose live — the offline AC1 tests are its proof, see `US-024-tests.md`).
5. **MQ-3 (Codex QA, local serve through `scripts/claude/qa-serve.sh`, no `DATABASE_URL`).** `/admin/operations`
   returns HTTP 200 in RO and EN with the translated load error (`Admin.operations.loadError`) and no stack trace,
   no `DATABASE_URL` text, no connection string. The admin nav shows the "Operations" / "Operațiuni" link at
   `/admin/operations`.

## Live BVB / Neon / Vercel / key steps

- None beyond the above — this story adds no new external integration point. It reads existing `job_runs` and
  `reports` rows written by the already-deployed daily job (US-015, US-012..014).

## Files changed

- `lib/ingestion/outcome.ts` (added `internal_error` to `INGEST_OUTCOME_CODES` and `IngestOutcome`)
- `lib/ingestion/ingest-etf.ts` (registry.get throw and the outer `ingestReport` catch now `internal_error`)
- `lib/ingestion/run-daily.ts` (removed `InternalErrorOutcome`; `DailyEtfOutcome = IngestOutcome` alias)
- `lib/ingestion/job-run-summary.ts` (`RunStatus = FinalJobRunStatus` imported from `job-runs.ts`)
- `lib/ingestion/outcome.test.ts` (OC-8a: eight codes)
- `lib/ingestion/ingest-etf.test.ts` (IE-6c changed to `internal_error`; IE-6d new)
- `lib/ingestion/ingest-etf.failures.test.ts` (IF-8a `internal_error` trigger; IF-8b `registry.get throws` row changed; IF-8c rewritten, order-independent)
- `lib/ingestion/job-run-summary.test.ts` (JS-3c new)
- `lib/ingestion/run-daily.test.ts` (RD-T new type test)
- `lib/admin/run-log.ts` (new — log parser: `parseRunLog`, `isKnownOutcomeCode`, `CODES_WITH_REPORT_DATE`)
- `lib/admin/run-log.test.ts` (new — RL-1..RL-11)
- `lib/admin/operations.ts` (new — three read-only statement builders + `createOperationsLoader`)
- `lib/admin/operations.pglite.test.ts` (new)
- `lib/admin/operations-messages.test.ts` (new — OM-1)
- `lib/admin/boundaries.test.ts` (new — BA-1)
- `lib/format/datetime.ts` (new — `formatDateTime`, Europe/Bucharest, 24-hour)
- `lib/format/datetime.test.ts` (new — DT-1..DT-8)
- `components/admin/OperationsDashboard.tsx` (new — presentational, three sections)
- `components/admin/OperationsDashboard.test.tsx` (new — OD-*)
- `components/admin/sections.ts` (added `/admin/operations`)
- `app/admin/operations/page.tsx` (new — `dynamic = "force-dynamic"`, try/catch load)
- `app/admin/operations/page.test.tsx` (new — OPG-*)
- `app/admin/operations/page.pglite.test.tsx` (new — PG-1)
- `app/admin/layout.test.tsx` (AL-5 added — operations nav link)
- `messages/en.json`, `messages/ro.json` (new `Admin.nav.operations`, `Admin.operations.*`)
- `dev_minions/verification/US-024-review.md`, `US-024-tests.md` (verdicts, by story-reviewer/story-tester)

Local gates green (implementer + independently re-run by both verifiers): `pnpm typecheck`, `pnpm lint`
(0 errors, 3 pre-existing warnings), `pnpm test` (1130/1130, 101 files), `env -u DATABASE_URL pnpm build`
(offline, includes new `/admin/operations` route).
