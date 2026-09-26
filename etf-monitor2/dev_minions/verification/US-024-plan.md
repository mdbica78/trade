# US-024 plan: Admin operational dashboard (job runs, last successful extraction, parse errors)

Planner: story-planner (opus), 2026-09-26. Mode: `plan US-024`.
Inputs read: `backlog/stories/US-024.md`; `backlog/sprints/sprint-05.md` (Decisions needed #12–#16, manual step 6);
requirements FR13 and §5; `architecture/data-model.md` (`reports`, `job_runs`, "Write rules"); `decisions/README.md`
(DEC-007, DEC-010, DEC-015, DEC-016); `verification/US-023-plan.md` (format). Code read: `lib/ingestion/{outcome,ingest-etf,
run-daily,job-run-summary,job-runs}.ts`; tests `outcome.test.ts`, `ingest-etf.test.ts` (IE-4, IE-6b-iii, IE-6c, the
"pre-date failure path" table), `ingest-etf.failures.test.ts` (IF-1a/b, IF-5d, IF-8a/b/c), `job-run-summary.test.ts`
(JS-3a); `test/helpers/{ingest-fakes,pglite}.ts`; `lib/monitoring/{home,history}.ts`; `lib/format/{date,number}.ts`;
`lib/config/{etfs,boundaries.test}.ts`; `lib/db/{schema,index}.ts`; `app/admin/{layout,page}.tsx`, `app/admin/cron/page(.test).tsx`,
`app/etf/[symbol]/page.tsx`; `components/admin/{sections,AdminNav,EtfAdmin,CronAdmin}.tsx`, `components/HistoryTable.tsx`,
`components/HomeTable.tsx` (PDF link pattern); `messages/en.json`; `i18n/messages.test.ts`; `eslint.config.mjs`
(`react/jsx-no-literals`); `global.d.ts` (typed messages).

**No decision is open. Nothing here is BLOCKED.** #12 and #13 are Decided (tech-lead, 2026-09-26). #14, #15 and #16 are
PRODUCT, and each ships its isolated default in the code named below (DEC-015 point 6). No schema change and no migration.

---

## 1. Acceptance criteria and the tests that prove them

Test ids are `it(...)` name prefixes, one prefix per file, so the tester can map them.

| AC | What proves it | File / test ids |
|---|---|---|
| **AC1** Outcome codes are truthful (N4, N5) | **OC-8a** (changed, see §6): `INGEST_OUTCOME_CODES` `toEqual` the **eight** codes `ok, already_ingested, missing, fetch_error, no_adapter, parse_error, persist_error, internal_error`. The existing `expectTypeOf<IngestOutcome["code"]>().toEqualTypeOf<IngestOutcomeCode>()` still passes. **IE-6c** (changed): `registry.get` throwing `Error("registry broken")` gives `code: "internal_error"`, the detail contains `registry broken` and does **not** start with `no adapter`, and makes zero fetch calls. **IE-6d** (new): `stubPipelineDeps(...)` with `download: async () => undefined as never` (so `download.ok` throws a TypeError outside `ingestReport`'s inner try, and the rejection reaches `ingestEtf`'s outer catch) gives `internal_error`. The detail does not contain `database write failed`, and there are zero `saveReport` calls. **IF-8a** (changed): the `Record<IngestOutcomeCode, …>` trigger map gains `internal_error: () => ingestEtf(etf, {…, registry: { get: () => { throw new Error("x"); } } })`. Each of the 8 codes is produced exactly, with a non-empty single-line detail. **IF-8b** (changed): the `registry.get throws` thrower expects `internal_error` (Error and non-Error). Every other thrower's `expectCode` is unchanged. **Unchanged and still passing:** IF-1a/IF-1b/IF-1c/IF-1d (`no_adapter` for NULL / unregistered key), the two `no adapter:` rows of the IE "pre-date failure path" table, IE-4 and IE-6b-iii and IF-8b `findReport/saveReport throws` (`persist_error`). **JS-3c** (new): `summarizeRun` on `[ok, internal_error]` outcomes built as real `IngestOutcome` values (no `as never`) → `{ status: "partial", etfsProcessed: 2, errorsCount: 1 }`. JS-3a stays unchanged (its `[...INGEST_OUTCOME_CODES, "internal_error"]` now lists the code twice, which is harmless). **RD-T** (new, type-only): `expectTypeOf<DailyEtfOutcome>().toEqualTypeOf<IngestOutcome>()`, which proves there is one definition. **IF-8c** (rewritten, N5): now `async`. It runs its own two `ingestEtf` calls on fresh `FakeStore`s (`fakeAdapter` → `ok` save, `adapterMissingNav()` → `parse_error` save), then asserts over those stores' `saveReportCalls` **plus** `allSaveReportInputs`: every status is in `{ok, parse_error}`, both occur, and the type is still closed. Proof of order-independence: the tester runs `pnpm vitest run lib/ingestion/ingest-etf.failures.test.ts -t IF-8c` alone and it passes. | `lib/ingestion/outcome.test.ts`, `lib/ingestion/ingest-etf.test.ts`, `lib/ingestion/ingest-etf.failures.test.ts`, `lib/ingestion/job-run-summary.test.ts`, `lib/ingestion/run-daily.test.ts` |
| **AC2** Run history | PGlite (`createEmptyTestDatabase`), inserted with `pg.query`: a `success` row (finished), a `partial` row (finished), a `failed` row with `finished_at` NULL and the stale line, and a `running` row (NULL finish, NULL log), with distinct `started_at` values given out of id order. **OP-R1** `createOperationsLoader(mockDb, registry, runner)()` returns `runs` newest `started_at` first. The ids come back in the expected order, and `startedAt` / `finishedAt` are **strings** of the form `YYYY-MM-DDTHH:MM:SSZ` equal to the inserted UTC instants (one inserted as `'2026-09-22 13:03:00+03'` reads back as `2026-09-22T10:03:00Z`, which proves the offset handling). `finishedAt` is `null` for the two unfinished rows. `etfsProcessed` and `errorsCount` are numbers. **OP-R2** equal `started_at` → higher id first. Render **OD-R1** (en, ro) with those four runs: each `data-run-id` row shows the translated status. The success and partial rows show a formatted end time. The swept `failed` row shows `Admin.operations.didNotFinish`. The `running` row shows no end time (no `didNotFinish`, no timestamp in its end cell) and the translated `running` status. Counts are shown as numbers. **OD-R2** a `failed` row **with** `finished_at` (an aborted run) shows its end time, not "did not finish". Page-level PGlite render **PG-1** (below) covers the same rows end to end. | `lib/admin/operations.pglite.test.ts`, `components/admin/OperationsDashboard.test.tsx`, `app/admin/operations/page.pglite.test.tsx` |
| **AC3** Log lines translated | **RL-1 round trip**: for each of the 8 codes, build a real `IngestOutcome` (or `internal_error` outcome) with a report date where the type allows one (`ok`, `already_ingested`, `parse_error`, `persist_error`) and, for the two optional ones, also without. Feed them to the **real** `formatRunLog(etfs, summarizeRun(etfs), [])`, then `parseRunLog` the result. The summary equals `{ status, processed, errors }` from `summarizeRun`, and the entries equal, in order, `{ kind: "etf", symbol, code, reportDate?, detail }` with exactly the input symbols, codes and dates. **RL-2** a detail with `\n`/tabs and a detail longer than 300 chars (with and without date) come back as `formatRunLog` wrote them (one line, `...`-truncated), each asserted as a literal expected string, not recomputed with the formatter's helpers. **RL-3** a secret in a detail comes back as `[redacted]` (`formatRunLog(…, [secret])`). **RL-4** `formatAbortedRunLog(new Error("boom"), [])` → summary `failed/0/0`, entries `[{ kind: "aborted", detail: "boom" }]`. **RL-5** a `formatRunLog` log + `"\n" + STALE_RUN_LOG_LINE` (the constant, as `buildFailStaleRunsStatement` appends it) → the ETF entries then `{ kind: "stale" }`. **RL-6** a log that is only `STALE_RUN_LOG_LINE` → `summary: null`, `[{ kind: "stale" }]`. **RL-7** `null` and `""` → `{ summary: null, entries: [] }`. **RL-8** unparseable lines (`"garbage"`, `"lower case line here"`, `"BTBETRETF"` alone, an empty middle line, `"[redacted] ok x"`) → `{ kind: "unparsed", text }` verbatim, line count preserved (never dropped), never throws. **RL-9** an unknown code `"BTBETRETF some_future_code 2026-09-22 x"` → `{ kind: "etf", code: "some_future_code", detail: "2026-09-22 x" }` with no `reportDate` (dates are parsed only for the codes that can carry one, §4 R3). `isKnownOutcomeCode` returns false for it and true for all 8. **RL-10** a code that cannot carry a date keeps a date-like prefix inside the detail: `"A internal_error 2026-09-22 boom"` → no `reportDate`, detail `"2026-09-22 boom"`. An invalid calendar date for a date code (`"A ok 2026-02-30 x"`) → no `reportDate`, detail kept whole. **RL-11** (type) `CODES_WITH_REPORT_DATE` equals the set of `IngestOutcome` variants that declare `reportDate` (distributive conditional type, §2). Render **OD-L1** (ro, en): one run whose log has every code → each entry shows the symbol, `Admin.operations.outcome.<code>` in that locale, the report date in P5 format where present, and the detail verbatim after `Admin.operations.detailLabel`. **OD-L2** unknown code → raw code text shown. Aborted → `logAborted` label + detail. Stale → `logStale`. Unparsed → the text verbatim. | `lib/admin/run-log.test.ts`, `components/admin/OperationsDashboard.test.tsx` |
| **AC4** Last successful extraction per ETF | PGlite. ETF `AAA` (brd-depositary): `ok` 2026-09-19 (fetched `2026-09-19T09:00:00Z`), `ok` 2026-09-20 (fetched `2026-09-20T09:15:00Z`), `parse_error` 2026-09-22. ETF `BBB`: only a `parse_error`. ETF `CCC` inactive with one `ok`. **OP-E1** `etfs` ordered by symbol. `AAA.lastOk = { reportDate: "2026-09-20", fetchedAt: "2026-09-20T09:15:00Z" }`, so the newer `parse_error` does not count and the fetch time comes from the same row. `BBB.lastOk = null`. `CCC.isActive = false` and it is still listed with its `lastOk`. **OP-E2** an `ok` row with `fetched_at` NULL → `fetchedAt: null`, `reportDate` kept. Render **OD-E1** (ro, en): `AAA` shows `20.09.2026` / `2026-09-20` and the formatted fetch time. `BBB` shows `Admin.operations.never`. `CCC` shows `Admin.operations.inactive`. | `lib/admin/operations.pglite.test.ts`, `components/admin/OperationsDashboard.test.tsx` |
| **AC5** Adapter missing flagged | **OP-E3** PGlite: ETFs with `adapter_key` `brd-depositary`, NULL, and `unknown-adapter` → `adapterAvailable` `true`, `false`, `false` against `defaultAdapterRegistry` (the US-016 AC5 rule). **OD-E2** (ro, en): the NULL and unknown rows carry `data-adapter-missing` and `Admin.operations.adapterMissing`. The brd row has neither. | `lib/admin/operations.pglite.test.ts`, `components/admin/OperationsDashboard.test.tsx` |
| **AC6** Parse errors visible | PGlite: `field_catalog` row (`brd-depositary`, `net_asset`, `Activ net`, `Net assets`). ETF `AAA` (brd) has a `parse_error` 2026-09-22 with `error_message = 'missing fields: nav_per_unit'`, `source_url = 'https://bvb.ro/x.pdf'` and values `net_asset = 415591664.27` and `units_in_circulation = 37470000` (no catalogue row, so the label falls back to `field_key`). A `no_adapter` row for `BBB` (2026-09-21, `source_url` NULL, no values, inserted raw as `history.pglite.test.ts` does) and an `ok` row for `AAA` 2026-09-20. **OP-P1** `parseErrors` = the two non-`ok` rows, newest `report_date` first. Values are grouped under their report, ordered by `field_key`, with labels as specified. The `ok` row is absent. **OP-P2** an ETF with `adapter_key` NULL and a stored value → label = `field_key` in both locales. Render **OD-P1** (ro): `AAA`, `22.09.2026`, `Admin.operations.reportStatus.parse_error`, `missing fields: nav_per_unit`, `Activ net`, `415591664,27`, `37470000`. The same in en: `2026-09-22`, `Net assets`, `415591664.27`. **OD-P2** the link is `<a href="https://bvb.ro/x.pdf" target="_blank" rel="noopener noreferrer">`. The `BBB` row has no `<a>` at all. A `source_url` of `javascript:alert(1)` renders no `<a>` (§4 R6). Exactly one `target="_blank"` per linked row. **PG-1** (page-level PGlite) finds both the message and the value on the page. | `lib/admin/operations.pglite.test.ts`, `components/admin/OperationsDashboard.test.tsx`, `app/admin/operations/page.pglite.test.tsx` |
| **AC7** Dates, times, numbers | **DT-1** `formatDateTime`: `2026-09-22T10:03:00Z` → en `2026-09-22 13:03`, ro `22.09.2026 13:03` (summer, UTC+3). **DT-2** `2026-01-15T10:03:00Z` → `2026-01-15 12:03` / `15.01.2026 12:03` (winter, UTC+2). **DT-3** DST start: `2026-03-29T00:59:00Z` → `2026-03-29 02:59`, `2026-03-29T01:00:00Z` → `2026-03-29 04:00`. **DT-4** DST end: `2026-10-25T00:59:00Z` → `2026-10-25 03:59`, `2026-10-25T01:00:00Z` → `2026-10-25 03:00`. **DT-5** midnight crossing: `2026-09-22T21:30:00Z` → `2026-09-23 00:30` (the hour is `00`, never `24`). **DT-6** an offset input `2026-09-22T13:03:00+03:00` → `2026-09-22 13:03`. **DT-7** DT-1 to DT-5 repeated under `vi.stubEnv("TZ", "America/Los_Angeles")` and `"Pacific/Kiritimati"` give identical results. **DT-8** a string that is not a date → returned verbatim, never throws. All expected values are literals. Report dates in OD-L1/OD-E1/OD-P1 go through `formatReportDate`. Values in OD-P1 go through `formatNumber`. | `lib/format/datetime.test.ts`, `components/admin/OperationsDashboard.test.tsx` |
| **AC8** Bilingual | **I18N** the existing key-parity test (`i18n/messages.test.ts`) passes. **OM-1** for every code in `INGEST_OUTCOME_CODES`, every value in `jobRuns.status.enumValues` and every value in `reports.status.enumValues`, both `ro.Admin.operations.{outcome,runStatus,reportStatus}[x]` and the `en` ones are non-empty strings. The test iterates the code lists and hard-codes no key. **OD-B1** ro vs en render of a full view: the headings, `didNotFinish`, `never`, `adapterMissing` and `detailLabel` are in the locale's text, and the ro HTML contains none of the differing en strings (and vice versa). **AL-5** admin layout (ro, en) shows `Admin.nav.operations` with `href="/admin/operations"`. **Lint** `react/jsx-no-literals` passes: no bare text in the new `.tsx`. Separators such as `—` or `:` live in messages. | `lib/admin/operations-messages.test.ts`, `components/admin/OperationsDashboard.test.tsx`, `app/admin/layout.test.tsx` |
| **AC9** No leak, no crash | **OD-S1** a log detail, an `error_message` and an unparsed line each containing `<script>alert(1)</script>` render as `&lt;script&gt;`, and the HTML contains no `<script`. **OPG-2** the page with the loader throwing `Error("connection refused: postgres://user:secret@db.example.com/etfs")` shows `Admin.operations.loadError` (ro and en) and no `connection refused`, `postgres://` or `secret`. **OPG-3** `getDb` throwing `MissingDatabaseUrlError` → the same error state, and the HTML does not contain `DATABASE_URL`. **OPG-4** with `vi.stubEnv("DATABASE_URL", "postgres://u:envsecret@h/db")` and `vi.stubEnv("CRON_SECRET", "cronsecret123")` and a successful mocked load, the HTML contains neither value. **BA-1** no non-test file in `lib/admin/` reads `process.env`. | `components/admin/OperationsDashboard.test.tsx`, `app/admin/operations/page.test.tsx`, `lib/admin/boundaries.test.ts` |
| **AC10** Shipped statements, offline, read-only | Every `lib/admin/operations.pglite.test.ts` case runs `createOperationsLoader(mockDb, registry, runner)`, which executes the exported `build*Statement` functions on PGlite migrated from `drizzle/0000_init.sql`. **OP-W1** a full dump (`select * … order by id`) of all six tables before and after a load is identical. **OP-W2** each of the three statements' `getQuery().sql`, trimmed and lower-cased, starts with `select`, and the load is **one** runner call with three statements (spy on the runner). **PG-1** mocks `@/lib/db` (`getDb` → PGlite `mockDb`) and partially mocks `@/lib/admin/operations` so that `createOperationsLoader(db)` binds the PGlite runner. The page then renders the shipped statements' results. **BA-1** `lib/admin/*.ts` has no `next`/`react`/`@/app`/`@/components` import, and `operations.ts` source has no `insert into`, `update "` or `delete from`. **OPG-5** a `fetch` spy is never called while rendering the page. No test imports `@neondatabase/serverless` or reaches Neon. | `lib/admin/operations.pglite.test.ts`, `app/admin/operations/page.pglite.test.tsx`, `app/admin/operations/page.test.tsx`, `lib/admin/boundaries.test.ts` |
| **AC11** Gates | Tester commands, locally with `NODE_EXTRA_CA_CERTS` exported (DEC-008): `pnpm typecheck`, `pnpm lint`, `pnpm test`, `env -u DATABASE_URL pnpm build`. **OPG-6** `app/admin/operations/page.tsx` exports `dynamic = "force-dynamic"`, so the build never queries the database. | commands in `US-024-tests.md`, `app/admin/operations/page.test.tsx` |

**MANUAL-QA** (goes into `US-024-qa.md`):
- **MQ-1 (user, deployed app + Neon)** = sprint-05.md step 6. Open `/admin/operations` in RO and EN. The runs match
  `select id, started_at, finished_at, status, etfs_processed, errors_count from job_runs order by started_at desc, id desc;`,
  with times shown in Romanian local time (for example `started_at` `…10:0x+00` shows as `13:0x` in summer). Each log line has a translated
  outcome. Each ETF's last successful extraction matches
  `select e.symbol, max(r.report_date) from etfs e left join reports r on r.etf_id = e.id and r.status = 'ok' group by e.symbol order by e.symbol;`.
  Any row from `select * from reports where status <> 'ok'` is listed with its message, its PDF link (opens in a new tab)
  and its values. An ETF without an adapter (for example one added in step 2 of the sprint) shows "adapter missing".
- **MQ-2 (user, after the next daily run on the deployment)**: a run in which an ETF hits a real failure shows the
  truthful code. `no_adapter` appears only for an ETF with no or unknown adapter. The N4 fix cannot be triggered live on
  purpose (it guards internal faults), so the offline AC1 tests are its proof.
- **MQ-3 (Codex QA, local serve through `scripts/claude/qa-serve.sh`, no `DATABASE_URL`)**: `/admin/operations` returns HTTP
  200 in ro and en with the translated load error and no stack trace. The admin nav shows the new link. Never print
  an environment value (DEC-015).
- **PO decisions (not failed criteria):** #14 (what is translated), #15 (no pagination), #16 (timestamp format).

---

## 2. Files and boundaries

### `lib/ingestion/` (N4 fix, Task 1)
- `outcome.ts`: append `"internal_error"` to `INGEST_OUTCOME_CODES`. Add the variant `(Base & { code: "internal_error" })`
  to `IngestOutcome`. It carries no `reportDate`: neither N4 path has a date.
- `ingest-etf.ts`: in the `registry.get` catch, return `internal_error` with detail
  `oneLine(\`internal error: adapter lookup failed: ${errorText(error)}\`)`. In the outer catch around `ingestReport`, return
  `internal_error` with detail `oneLine(\`internal error: ${errorText(error)}\`)` and add a comment that it is a
  defensive net. `no_adapter` paths (NULL / unregistered) and `persist()` are untouched.
- `run-daily.ts`: delete `InternalErrorOutcome`. `export type DailyEtfOutcome = IngestOutcome;` stays as an alias,
  because `job-run-summary.ts`, `lib/cron/daily-job.ts` and tests import it. The catch keeps building
  `{ code: "internal_error", symbol, detail }`, which now type-checks against `IngestOutcome`. Its behaviour does not change (RD-3/3b tests unchanged).
- `job-run-summary.ts` (optional N6, recommended because it is one line): `export type RunStatus = FinalJobRunStatus;` imported from `./job-runs`.
  No behaviour change.
- Tests: `outcome.test.ts` (OC-8a), `ingest-etf.test.ts` (IE-6c, new IE-6d), `ingest-etf.failures.test.ts` (IF-8a map,
  IF-8b `registry.get throws` row, IF-8c rewrite), `job-run-summary.test.ts` (new JS-3c), `run-daily.test.ts` (new RD-T).

### `lib/admin/` (new, read side, no writes, no Next/React)
- `run-log.ts`: `parseRunLog(log: string | null): ParsedRunLog`, `isKnownOutcomeCode(code: string): code is IngestOutcomeCode`,
  `CODES_WITH_REPORT_DATE = ["ok", "already_ingested", "parse_error", "persist_error"] as const`. Types:
  ```ts
  type RunLogSummary = { status: string; processed: number; errors: number };
  type RunLogEntry =
    | { kind: "etf"; symbol: string; code: string; reportDate?: string; detail: string }
    | { kind: "aborted"; detail: string }
    | { kind: "stale" }
    | { kind: "unparsed"; text: string };
  type ParsedRunLog = { summary: RunLogSummary | null; entries: RunLogEntry[] };
  ```
  Algorithm: `null`/`""` → empty. Split on `"\n"`. Line 0 matching `^([a-z_]+): (\d+) processed, (\d+) errors$` → summary.
  Every other line, in order:
  1. equal to `STALE_RUN_LOG_LINE` (imported from `lib/ingestion/job-runs`) → stale;
  2. starts with `"run aborted: "` → aborted, with the rest as the detail;
  3. `^([A-Z0-9]+) ([a-z_]+) (.+)$` → etf. If the code is in `CODES_WITH_REPORT_DATE` and the rest matches
     `^(\d{4}-\d{2}-\d{2}) (.+)$` with `isIsoCalendarDate` (`lib/extraction/adapters/validate.ts`), the date and the remainder
     become `reportDate` and `detail`. Otherwise the whole rest is the detail;
  4. anything else → unparsed.

  The symbol pattern matches US-020's `normaliseSymbol` output and the seeded symbols. Everything is a pure function with no I/O. RL-11's type check:
  `type WithDate<T> = T extends unknown ? ("reportDate" extends keyof T ? T extends { code: infer C } ? C : never : never) : never;`
  `expectTypeOf<(typeof CODES_WITH_REPORT_DATE)[number]>().toEqualTypeOf<WithDate<IngestOutcome>>()`.
- `operations.ts`: three exported statement builders and one loader:
  - `buildRunsStatement(db)`: `select "id", <iso>("started_at") as "started_at", <iso>("finished_at") as "finished_at",
    "status", "etfs_processed", "errors_count", "log" from "job_runs" order by "started_at" desc, "id" desc`.
  - `buildEtfStatusStatement(db)`: `etfs` left-joined to a `distinct on ("etf_id")` subquery of `ok` reports ordered
    `report_date desc, id desc` (the same "newest ok" rule as `home.ts`). It selects `symbol`, `adapter_key`, `is_active`,
    `to_char(report_date,'YYYY-MM-DD')`, `<iso>(fetched_at)`, ordered by `symbol`. It lists active **and** inactive ETFs.
  - `buildParseErrorReportsStatement(db)`: `reports r join etfs e` where `r.status <> 'ok'`, left join `report_values rv`,
    left join `field_catalog fc on fc.adapter_key = e.adapter_key and fc.field_key = rv.field_key` (the ETF's own adapter,
    as `history.ts` does). Ordered `r.report_date desc, r.id desc, rv.field_key`. It is one row per value (or one row with NULL
    value columns), and TS groups the rows by `r.id` in the order they arrive.
  - `<iso>(col)` is `to_char(col at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`: text on both neon-http and PGlite, and
    independent of the session time zone (story Notes, Sprint 4 audit N7). One small `sql` helper in this file.
  - `createOperationsLoader(db, registry = defaultAdapterRegistry, run = neonBatchRunner(db)): () => Promise<OperationsView>`
    makes **one** runner call with the three statements. Rows are mapped with `rowsOf`, `parsePgBoolean`, `Number` and
    `adapterAvailable = key !== null && registry.get(key) !== undefined`, and `parseRunLog` is applied to each run's log.
    Types: `OperationsRun { id; startedAt: string; finishedAt: string | null; status: string; etfsProcessed: number; errorsCount: number; log: ParsedRunLog }`,
    `EtfOperationalStatus { symbol; isActive; adapterAvailable; lastOk: { reportDate: string; fetchedAt: string | null } | null }`,
    `NonOkReport { id; symbol; reportDate; status: string; errorMessage: string | null; sourceUrl: string | null; values: { fieldKey; labelRo; labelEn; numericValue: string | null }[] }`,
    `OperationsView { runs; etfs; parseErrors }`.
  - Known-value lists for the UI: `JOB_RUN_STATUSES = jobRuns.status.enumValues`, `REPORT_STATUSES = reports.status.enumValues`
    (from `lib/db/schema`, the single source), plus `isKnownRunStatus` and `isKnownReportStatus` guards.
- Tests: `run-log.test.ts`, `operations.pglite.test.ts`, `operations-messages.test.ts` (OM-1), `boundaries.test.ts` (BA-1:
  the same import rules as `lib/config/boundaries.test.ts` using `test/helpers/module-specifiers.ts`, plus the no-write text check).

### `lib/format/datetime.ts` (new, decision 16)
`formatDateTime(iso: string, locale: Locale): string`. It uses a module-level `Intl.DateTimeFormat("en-US", { timeZone: "Europe/Bucharest",
year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })` and
`formatToParts`, then assembles the string itself: `ro` `DD.MM.YYYY HH:mm`, `en` `YYYY-MM-DD HH:mm`. It never relies on a locale's own
pattern. An invalid date is returned as the input string. Test: `lib/format/datetime.test.ts`.

### UI
- `components/admin/OperationsDashboard.tsx` (new, presentational, props only). Props:
  `{ status: "error" } | { status: "ok"; view: OperationsView }`. It uses `useTranslations("Admin.operations")` and `useLocale()`
  (as `HistoryTable.tsx`). It has three sections with headings and per-section empty states (`runsEmpty`, `etfsEmpty`,
  `parseErrorsEmpty`). A log sub-component renders `RunLogEntry[]`, and the `summary` is not rendered because the row's columns hold the same data.
  Data attributes for precise assertions: `data-run-id`, `data-run-end="finished|did-not-finish|running"`,
  `data-log-entry="etf|aborted|stale|unparsed"`, `data-etf-symbol`, `data-adapter-missing`, `data-report-id`.
  Translation lookups use `isKnown*` guards and fall back to the raw string (typed messages via `global.d.ts`: `t(\`outcome.${code}\`)`
  type-checks once `code` is narrowed). The PDF `href` is rendered only when `/^https?:\/\//i` matches. If the file grows past
  about 250 lines, split the three sections into sibling files under `components/admin/operations/`.
- `components/admin/sections.ts`: append `{ href: "/admin/operations", labelKey: "operations" }`.
- `app/admin/operations/page.tsx` (new): `export const dynamic = "force-dynamic"`. It has a `load()` with try/catch around
  `createOperationsLoader(getDb())()` → `{ status: "ok", view }`, or `{ status: "error" }` with no exception text, following the pattern of
  `app/etf/[symbol]/page.tsx`. It renders `<OperationsDashboard …/>`. No Server Actions, no forms.
- `messages/ro.json`, `messages/en.json`: `Admin.nav.operations`; `Admin.operations.{heading, loadError, runsHeading, runsEmpty,
  startedColumn, finishedColumn, statusColumn, processedColumn, errorsColumn, logColumn, didNotFinish, logAborted, logStale,
  detailLabel, etfsHeading, etfsEmpty, symbolColumn, activeColumn, active, inactive, adapterColumn, adapterMissing,
  lastSuccessColumn, lastSuccessValue ("{date}, fetched {time}" style), lastSuccessDateOnly, never, parseErrorsHeading,
  parseErrorsEmpty, reportDateColumn, errorMessageColumn, pdfColumn, pdfLink, valuesColumn, noValues}`;
  `Admin.operations.runStatus.{running,success,partial,failed}`; `Admin.operations.outcome.{the 8 codes}`;
  `Admin.operations.reportStatus.{ok,missing,parse_error,no_adapter}`. The exact names are free as long as OM-1 and parity hold.
- Tests: `components/admin/OperationsDashboard.test.tsx` (OD-*), `app/admin/operations/page.test.tsx` (OPG-*, mocks
  `@/lib/db` and `@/lib/admin/operations`, following `app/admin/cron/page.test.tsx`), `app/admin/operations/page.pglite.test.tsx` (PG-1),
  `app/admin/layout.test.tsx` (+AL-5).
- Optional: one line in `README.md` → "Administration" naming `/admin/operations`. Not an AC.

Boundaries: `lib/admin/` reads only (it depends on `lib/db`, `lib/ingestion/{store,job-runs,outcome,load-etfs}`,
`lib/extraction/adapters/{default-registry,validate}`), and `lib/ingestion/` never imports `lib/admin/`. Components
receive plain data. Only the page touches `getDb`.

---

## 3. Data model

No change. Every column read exists (`job_runs.*`, `reports.*`, `report_values.*`, `etfs.*`, `field_catalog.*`).
`internal_error` is a code in `job_runs.log` text and in TS only. It is never written to `reports.status`, whose values
stay `ok|missing|parse_error|no_adapter`. There is no migration, and nothing to apply to Neon.

---

## 4. Risks and the smallest design

- **R1: changing Sprint 3 tests.** This is intended and cited (Sprint 3 audit N4/N5, the carry-forward note, sprint decision #12). The only
  expectation changes: OC-8a (7 → 8 codes), IE-6c and IF-8b `registry.get throws` (`no_adapter` → `internal_error`),
  and IF-8a gets a new key. IF-8c is restructured (still asserting the same three facts) so it does not depend on other tests. The reviewer checks that
  IF-1a/b/c/d, IE-4, IE-6b-iii, the IF-8b `persist_error` rows and IF-5d are byte-identical.
- **R2: log-format coupling.** The parser mirrors `formatEtfLine`. The round trip uses the real `formatRunLog`,
  `formatAbortedRunLog` and `STALE_RUN_LOG_LINE`, so a format change fails RL-1/4/5/6 first. Old rows written before
  `internal_error` existed parse the same way, and their `no_adapter` lines stay as written (history is not rewritten).
- **R3: date ambiguity.** `formatEtfLine` prefixes a date only when the outcome has `reportDate`. Parsing a date for every
  code would misread an `internal_error` message that happens to start with a date. So dates are parsed only for
  `CODES_WITH_REPORT_DATE` (RL-10), and RL-11 pins that list to the `IngestOutcome` type. An unknown code keeps its
  detail whole (RL-9), and nothing is lost either way because the text is still shown verbatim.
- **R4: timestamps differ by driver.** Converting with `to_char` in SQL gives text on both drivers. `formatDateTime` does the time-zone work in
  one place and is tested independently of the process time zone.
- **R5: DST correctness.** The `Intl` time-zone database handles the DST switches. DT-3/DT-4 pin both 2026 switch instants, and `hourCycle: "h23"`
  avoids the `24:30` artefact (DT-5).
- **R6: stored URL and text rendering.** React escapes all text (OD-S1). `source_url` comes from bvb.ro discovery, but the
  admin area is open (requirements §6). A non-http(s) scheme renders as no link, which is a one-line guard and cheaper than
  proving the discovery can never yield one.
- **R7: size.** There is no pagination (decision #15). About one run a day, so a few hundred rows a year, and the log is at most one line per
  active ETF, each capped at 300 chars. If this grows, a later story adds a limit.
- **R8: shared gate state.** HANDOVER's QA log recorded typecheck errors in `lib/config/tracked-fields.pglite.test.ts`
  (US-021). If `pnpm typecheck` still fails there when US-024 runs its gates, the implementer records it in HANDOVER and
  flags it rather than editing another story's test. It is not an AC11 failure of US-024's own files.

Not built: filtering, retries, triggering the cron, a structured log column, translation of `detail`/`error_message`,
and a report link for no-adapter ETFs (US-030).

---

## 5. Decisions needed

None open. Recorded for traceability:

| # | Type | Status | Where the default lives |
|---|---|---|---|
| 12 | TECHNICAL | Decided (tech-lead, 2026-09-26) | `lib/ingestion/outcome.ts`, `ingest-etf.ts` |
| 13 | TECHNICAL | Decided (tech-lead, 2026-09-26) | `lib/admin/run-log.ts` |
| 14 | PRODUCT, **NEEDS USER, default shipped** | Codes, statuses, labels translated. `detail` and `error_message` verbatim | `lib/admin/run-log.ts` (`isKnownOutcomeCode`), `components/admin/OperationsDashboard.tsx`, `messages/*.json` `Admin.operations.*` |
| 15 | PRODUCT, **NEEDS USER, default shipped** | All runs, all non-`ok` reports, newest first, no limit | `lib/admin/operations.ts` (`order by`, no `limit`) |
| 16 | PRODUCT, **NEEDS USER, default shipped** | Europe/Bucharest, 24 h, `ro` `22.09.2026 13:03`, `en` `2026-09-22 13:03` | `lib/format/datetime.ts` |

Two design choices made in this plan are within #13's and the story's technical scope: date parsing gated by code (R3), and the
http(s)-only PDF link (R6). They need no decision.

---

## 6. Test-change ledger (for the reviewer)

| Test | Before | After | Source |
|---|---|---|---|
| `outcome.test.ts` OC-8a | seven codes | eight codes (`internal_error` last) | sprint decision #12 |
| `ingest-etf.test.ts` IE-6c | `no_adapter` | `internal_error`, detail not `no adapter…` | Sprint 3 audit N4 |
| `ingest-etf.failures.test.ts` IF-8a | 7-key trigger map | 8-key map (+`internal_error`) | #12 |
| `ingest-etf.failures.test.ts` IF-8b `registry.get throws` | `no_adapter` | `internal_error` | N4 |
| `ingest-etf.failures.test.ts` IF-8c | reads the shared array only | makes its own saves, then asserts the same three facts | Sprint 3 audit N5 |
| everything else in `lib/ingestion/*.test.ts` | — | unchanged | — |
