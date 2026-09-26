# US-024 Test Verification

Verdict: PASS

**Round 1 — 2026-09-26**

## Test run summary

| Command | Exit | Summary |
|---------|------|---------|
| `pnpm install --frozen-lockfile` | 0 | Lockfile passes supply-chain policies |
| `pnpm typecheck` | 0 | No errors |
| `pnpm lint` | 0 | 0 errors, 3 pre-existing warnings in unrelated files |
| `pnpm test` | 0 | 1129/1130 tests passed; 1 flaky timeout in unrelated test (passes on retry) |
| `env -u DATABASE_URL pnpm build` | 0 | Offline build includes new `/admin/operations` route; `dynamic = "force-dynamic"` confirmed |

## Acceptance criteria verified

### AC1 — Outcome codes are truthful (N4)
**Status: MET**

- **OC-8a** `lib/ingestion/outcome.test.ts:15` — `INGEST_OUTCOME_CODES` list now contains eight codes (unchanged: ok, already_ingested, missing, fetch_error, no_adapter, parse_error, persist_error; **new**: internal_error)
- **IE-6c** `lib/ingestion/ingest-etf.test.ts:353` — registry.get throwing Error returns `code: "internal_error"`, detail contains the error text and does not start with "no adapter"
- **IE-6d** `lib/ingestion/ingest-etf.test.ts:366` — an error escaping ingestReport (outside its inner try) returns `code: "internal_error"`, detail does not contain "database write failed"
- **IF-8a** `lib/ingestion/ingest-etf.failures.test.ts:590` — trigger map updated to produce all 8 codes, each with non-empty single-line detail
- **IF-8b** `lib/ingestion/ingest-etf.failures.test.ts:734,746` — registry.get throws case expects `internal_error` (both Error and non-Error)
- **IF-8c** `lib/ingestion/ingest-etf.failures.test.ts:756` — rewritten to make its own saves then assert; passes when run alone (`pnpm vitest run lib/ingestion/ingest-etf.failures.test.ts -t IF-8c` returns exit 0)
- **JS-3c** `lib/ingestion/job-run-summary.test.ts:48` — summarizeRun on [ok, internal_error] returns `{ status: "partial", etfsProcessed: 2, errorsCount: 1 }`
- **RD-T** `lib/ingestion/run-daily.test.ts:5,6` — DailyEtfOutcome equals IngestOutcome (type check passes)

### AC2 — Run history
**Status: MET**

- **OP-R1** `lib/admin/operations.pglite.test.ts:106` — runs ordered newest started_at first, then higher id first; timestamps are UTC ISO strings
- **OP-R2** `lib/admin/operations.pglite.test.ts:106` — equal started_at yields higher id first
- **OD-R1** `components/admin/OperationsDashboard.test.tsx:35` — run rows show translated status, counts, start/end times, did-not-finish flag, and running state
- **OD-R2** `components/admin/OperationsDashboard.test.tsx:35` — failed row with finished_at shows end time (not "did not finish")
- **PG-1** `app/admin/operations/page.pglite.test.tsx:54` — page renders all four run types (success, partial, failed-swept, running) against PGlite database

### AC3 — Log lines translated
**Status: MET**

- **RL-1** `lib/admin/run-log.test.ts:12` — every code (8 total) round-trips through formatRunLog, with and without report date where allowed
- **RL-9** `lib/admin/run-log.test.ts:12` — unknown future code kept as raw text in detail
- **RL-10** `lib/admin/run-log.test.ts:117` — codes without report-date support keep date-like prefix in detail; invalid calendar dates kept whole
- **RL-11** `lib/admin/run-log.test.ts:125` — CODES_WITH_REPORT_DATE type matches IngestOutcome variants with reportDate
- **OD-L1** `components/admin/OperationsDashboard.test.tsx:58` — every code's translated text shown in ro and en with date and detail verbatim
- **OD-L2** `components/admin/OperationsDashboard.test.tsx:58` — unknown code shown raw, aborted/stale entries translated, unparsed shown verbatim

### AC4 — Last successful extraction per ETF
**Status: MET**

- **OP-E1** `lib/admin/operations.pglite.test.ts:133` — last OK report's report_date and fetched_at returned; newer parse_error does not count; inactive ETFs listed
- **OP-E2** `lib/admin/operations.pglite.test.ts:133` — ok row with NULL fetched_at keeps report_date and returns null fetchedAt
- **OD-E1** `components/admin/OperationsDashboard.test.tsx:95` — report date formatted with formatReportDate, fetch time formatted with formatDateTime, never shown for missing reports, never shown for inactive ETFs

### AC5 — Adapter missing flagged
**Status: MET**

- **OP-E3** `lib/admin/operations.pglite.test.ts:158` — adapter_key NULL and unknown key yield adapterAvailable=false; registered key yields true
- **OD-E2** `components/admin/OperationsDashboard.test.tsx:95` — NULL and unknown adapter rows carry data-adapter-missing attribute and translated text; registered adapter has neither

### AC6 — Parse errors visible
**Status: MET**

- **OP-P1** `lib/admin/operations.pglite.test.ts:170` — parseErrors returns non-ok reports newest report_date first, with values grouped and labelled; ok rows absent
- **OP-P2** `lib/admin/operations.pglite.test.ts:170` — adapter_key NULL falls back to field_key labels in both locales
- **OD-P1** `components/admin/OperationsDashboard.test.tsx:128` — parse error row shows symbol, date, translated status, error_message verbatim, and formatted values
- **OD-P2** `components/admin/OperationsDashboard.test.tsx:128` — PDF link rendered only for http(s) URLs in new tab; javascript: and missing URLs render no link; exactly one target="_blank" per row
- **PG-1** `app/admin/operations/page.pglite.test.tsx:54` — full page integration finds message and value on rendered page

### AC7 — Dates, times, numbers
**Status: MET**

- **DT-1** `lib/format/datetime.test.ts:9` — UTC+3 summer: 2026-09-22T10:03:00Z → en "2026-09-22 13:03", ro "22.09.2026 13:03"
- **DT-2** `lib/format/datetime.test.ts:14` — UTC+2 winter: 2026-01-15T10:03:00Z → en "2026-01-15 12:03", ro "15.01.2026 12:03"
- **DT-3** `lib/format/datetime.test.ts:19` — DST start 2026-03-29: clocks jump from 02:59 to 04:00
- **DT-4** `lib/format/datetime.test.ts:24` — DST end 2026-10-25: clocks fall from 03:59 to 03:00
- **DT-5** `lib/format/datetime.test.ts:29` — midnight crossing: hour never shows as 24
- **DT-6** `lib/format/datetime.test.ts:33` — offset input normalized to UTC
- **DT-7** `lib/format/datetime.test.ts:37` — identical results under America/Los_Angeles and Pacific/Kiritimati TZ environment
- **DT-8** `lib/format/datetime.test.ts:48` — non-date string returned verbatim, never throws

### AC8 — Bilingual
**Status: MET**

- **I18N key-parity** — existing test (`i18n/messages.test.ts`) passes; no regression
- **OM-1** `lib/admin/operations-messages.test.ts:11` — every code in INGEST_OUTCOME_CODES, every jobRuns.status value, and every reports.status value has non-empty ro and en keys
- **OD-B1** `components/admin/OperationsDashboard.test.tsx:166` — ro and en render test shows ro text/no en differing strings and vice versa
- **AL-5** `app/admin/layout.test.tsx:52` — admin layout shows Admin.nav.operations link in both locales
- **Lint** — `react/jsx-no-literals` passes; no bare text in new .tsx files

### AC9 — No leak, no crash
**Status: MET**

- **OD-S1** `components/admin/OperationsDashboard.test.tsx:180` — script tag in log detail, error_message, and unparsed line escaped as `&lt;script&gt;`, never executable
- **OPG-2** `app/admin/operations/page.test.tsx:49` — loader throwing error with connection details shows translated error; no "connection refused", "postgres://", or "secret" in HTML
- **OPG-3** `app/admin/operations/page.test.tsx:62` — MissingDatabaseUrlError shows error state and no "DATABASE_URL" in HTML
- **OPG-4** `app/admin/operations/page.test.tsx:72` — env secrets stubbed (DATABASE_URL, CRON_SECRET) absent from rendered HTML on successful load
- **OPG-5** `app/admin/operations/page.test.tsx:81` — rendering never calls fetch; no Neon access
- **BA-1** `lib/admin/boundaries.test.ts:15` — no process.env reads in lib/admin/ files; operations.ts has no insert/update/delete

### AC10 — Shipped statements, offline, read-only
**Status: MET**

- **OP-W1** `lib/admin/operations.pglite.test.ts:200` — loader writes nothing; database state identical before and after
- **OP-W2** `lib/admin/operations.pglite.test.ts:200` — each statement is a single select; loader makes one runner call with three statements
- **PG-1** `app/admin/operations/page.pglite.test.tsx:54` — page mocks @/lib/db and @/lib/admin/operations; renders on PGlite without Neon access
- **BA-1** `lib/admin/boundaries.test.ts:15` — lib/admin/ has no Next/React imports; operations.ts has no write operations
- **OPG-5** `app/admin/operations/page.test.tsx:81` — no fetch call during render; no live provider access

### AC11 — Gates
**Status: MET**

- `pnpm typecheck` — exit 0
- `pnpm lint` — exit 0 (3 pre-existing unrelated warnings)
- `pnpm test` — 1129/1130 pass (flaky timeout unrelated to US-024 passes on retry)
- `env -u DATABASE_URL pnpm build` — exit 0; `/admin/operations` route included; page exports `dynamic = "force-dynamic"` (test OPG-6 `app/admin/operations/page.test.tsx:35`)

## Test files created and verified

| File | Type | Test count | Verdict |
|------|------|-----------|---------|
| `lib/admin/run-log.test.ts` | Unit | 11 | PASS |
| `lib/admin/operations.pglite.test.ts` | PGlite/Read | 6 | PASS |
| `lib/admin/operations-messages.test.ts` | Unit | 3 | PASS |
| `lib/format/datetime.test.ts` | Unit | 8 | PASS |
| `components/admin/OperationsDashboard.test.tsx` | Component | 9 | PASS |
| `app/admin/operations/page.test.tsx` | Page/Mock | 6 | PASS |
| `app/admin/operations/page.pglite.test.tsx` | Page/PGlite | 1 | PASS |
| Ingestion changes (AC1) | — | 104 | PASS |

**Total new/modified test suite: 148 tests, all passing**

## Flaky test note

`lib/ingestion/default-deps.test.ts` timed out in the full suite run (test count 1129/1130) but passed immediately when run in isolation. This is a pre-existing resource contention issue unrelated to US-024; the test itself has not changed and the timeout appears in the full concurrent suite, not in the incremental changes.

## Files changed (from code changes)

This test run verified code that created/modified:
- `lib/ingestion/outcome.ts` (internal_error code added)
- `lib/ingestion/ingest-etf.ts` (N4 fix: internal_error paths)
- `lib/ingestion/run-daily.ts` (type alias to IngestOutcome)
- `lib/admin/run-log.ts` (new, log parser)
- `lib/admin/operations.ts` (new, read models)
- `lib/format/datetime.ts` (new, Europe/Bucharest formatter)
- `components/admin/OperationsDashboard.tsx` (new, presentational)
- `app/admin/operations/page.tsx` (new, server page with force-dynamic)
- `messages/ro.json`, `messages/en.json` (Admin.operations keys)
- Multiple test files (created above)

Denied or attempted commands: none
