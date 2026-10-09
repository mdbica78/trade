# US-012 plan: ingestion pipeline (discover, download, extract, persist) for one ETF

Planner: `story-planner` (opus, high), 2026-09-24. Mode: `plan US-012`.
Sources read: `backlog/stories/US-012.md`, US-013.md, US-014.md (including its tech-lead review), `sprints/sprint-03.md`, `verification/SPRINT-03-review.md`, `architecture/data-model.md`, ADR-001, DEC-010, the requirements (FR3, FR4, FR4.1, FR13). Code: `lib/db/{schema,index,seed,seed-data}.ts`, `drizzle/0000_init.sql`, `lib/extraction/{discovery,http,pdf,report-latest}.ts`, `lib/extraction/adapters/{types,validate,registry,boundaries.test}.ts`, `scripts/report-latest.ts`, `test/fixtures/{expected.json,bvb/README.md}`, and in `node_modules` the `drizzle-orm@0.45.3` neon-http / pglite driver typings plus `neon-http/session.js`.

**Decisions needed: none new.** Nothing blocks the story. The two PRODUCT items are already in the story. They ship the literal FR3 reading and stay NEEDS USER for the demo (SPRINT-03-review). This plan keeps each one to a one-function change (§4, R8).

---

## 0. The chosen DEC-010 pattern: (a), one `db.batch`, with (b)'s ordering inside it

Every write for a report goes through **one `db.batch([...])` call**. On neon-http that call is `client.transaction(builtQueries)`, so it is a single atomic HTTP transaction. I checked this in `node_modules/drizzle-orm/neon-http/session.js:117-133`. Inside the batch:

| # | Statement | Purpose |
|---|---|---|
| S1 | `INSERT INTO reports (etf_id, report_date, source_url, fetched_at, status, error_message) VALUES ($etf, $date, $url, $fetchedAt, 'parse_error', 'write in progress') ON CONFLICT (etf_id, report_date) DO UPDATE SET source_url=…, fetched_at=…, status='parse_error', error_message='write in progress' WHERE reports.status <> 'ok'` | Creates the row, or claims an existing non-`ok` row, with a **non-`ok` interim status**. An existing `ok` row is left untouched. |
| S2 | `DELETE FROM report_values WHERE report_id IN (SELECT id FROM reports WHERE etf_id=$etf AND report_date=$date AND status <> 'ok')` | Removes a replaced row's old values. |
| S3…S(2+N) | one per value: `INSERT INTO report_values (report_id, field_key, numeric_value, raw_value) SELECT r.id, $key::text, $num::numeric, $raw::text FROM reports r WHERE r.etf_id=$etf AND r.report_date=$date AND r.status <> 'ok'` | `report_id` is resolved **by a subquery on `(etf_id, report_date)`** inside the same batch, never by an earlier call. |
| last | `UPDATE reports SET status=$finalStatus, error_message=$finalMessage WHERE etf_id=$etf AND report_date=$date AND status <> 'ok' RETURNING id` | The status becomes `ok` **only in the last statement**, after the values. |

Why this shape:
- **It satisfies (a) literally.** There is one `db.batch`, and the values resolve `report_id` with a subquery on `(etf_id, report_date)`. This is what AC4 and the story's verification notes check.
- **It also has (b)'s property.** Even an executor that is not atomic (the test in §1, AC4-c) can at worst leave a `parse_error` row with the message `write in progress`. It can never leave an `ok` row without its values. Nothing is visible outside the transaction in production.
- **The "never downgrade `ok`" rule is enforced inside SQL, as US-014's tech-lead review requires.** Every statement is guarded by `status <> 'ok'`. Suppose a concurrent run committed `ok` first. Under READ COMMITTED, S1's `DO UPDATE … WHERE` re-checks the latest row version and skips, and S2 to the last statement then match nothing. The last statement's `RETURNING` is empty, and the store reports `already_ok`. So the race gives `already_ingested`, not a duplicate or an overwrite. Under a stricter isolation level the second transaction fails instead. That becomes a `persist` failure outcome, which is still never bad data.
- **US-014 reuses it unchanged.** `saveReport` already takes `status` (`'ok' | 'parse_error'`) and `errorMessage`. Only the final UPDATE uses them.

Option (c), the WebSocket `Pool`, is not used, so no new DEC is needed.

---

## 1. Acceptance criteria, each with the test that proves it

Test files (all offline, Vitest):
- `lib/ingestion/select-values.test.ts` (ST)
- `lib/ingestion/store.test.ts` (SQ): statement building, checked with `.toSQL()`, plus a fake runner
- `lib/ingestion/store.pglite.test.ts` (PG): the same statements executed on in-process PGlite
- `lib/ingestion/ingest-etf.test.ts` (IE): the pipeline with a stateful fake store and a mocked `fetch`
- `lib/ingestion/ingest-etf.pglite.test.ts` (E2E): the pipeline plus the real Drizzle store on PGlite
- `lib/ingestion/boundaries.test.ts` (BD)

In every IE/E2E test, `fetch` is injected through `discoverLatestReport(etf, { fetchImpl })` / `downloadReportPdf(url, { fetchImpl })`. In `beforeEach`, `globalThis.fetch` is stubbed (`vi.stubGlobal`) with a function that throws `real network forbidden`, and each test asserts that it was never called. That makes the no-network proof non-vacuous (Sprint 2 audit W2).

**AC1: Happy path, offline**
- IE-1: `fetchImpl` serves `test/fixtures/bvb/BTBETRETF-instrument-2026-09-23.html` for the ETF's `bvbUrl` (seed URL) and `test/fixtures/BTBETRETF-2026-09-22.pdf` for README §7's newest URL. Any other URL gets 404. Real `discoverLatestReport`, `downloadReportPdf`, `extractPdfText` and `defaultAdapterRegistry` are used. Tracked fields: `["units_in_circulation", "nav_per_unit"]`. Assertions:
  - `saveReport` is called once with `reportDate '2026-09-22'`, `sourceUrl` = README §7 URL, `fetchedAt instanceof Date`, `status 'ok'` and `errorMessage null`;
  - `values` has exactly two entries, whose `numericValue`/`rawValue` equal `expected.json`'s `BTBETRETF-2026-09-22.pdf` entry (read from the file, not hard-coded);
  - the outcome is `{ code: 'ok', symbol, reportDate: '2026-09-22', valuesWritten: 2 }`;
  - `fetchImpl` was called exactly twice, in the order page then PDF.
- E2E-1: the same flow, but the store is `createDrizzleReportStore(mockDb, pgliteRunner)`. It then selects from PGlite:
  - one `reports` row with those column values (`report_date::text`, `status`, `error_message IS NULL`, `fetched_at IS NOT NULL`);
  - two `report_values` rows (`numeric_value::text`, `raw_value`) equal to `expected.json`.

**AC2: `report_date` comes from the PDF footer only**
- IE-2: `vi.useFakeTimers({ toFake: ['Date'] })` plus `vi.setSystemTime('2031-01-15T12:00:00Z')`. Only `Date` is faked, so `fetchOnce`'s `setTimeout` and unpdf are unaffected. A stub `discover` returns `publishedAt '2030-12-31T09:00'` and a `pdfUrl` whose file name says `…-01-01-2029.pdf`. The real download is used with `fetchImpl` serving the 2026-09-22 PDF bytes. Assertions:
  - `saveReport.reportDate === '2026-09-22'`;
  - `fetchedAt` equals the faked clock, so the clock went only into `fetched_at`.
- BD-3: a source check that no non-test file in `lib/ingestion/` contains `new Date(`, `Date.now(` or `publishedAt`. The report date can only come from `result.reportDate`.

**AC3: tracked fields only, through one isolated selection function**
- ST: pure tests of `selectValuesToPersist(result, trackedFieldKeys)`:
  - it returns only the tracked keys' values, in `trackedFieldKeys` order, and untracked adapter fields are absent;
  - a tracked key in `missingFields` makes it incomplete, and `missingFieldKeys` names it;
  - a tracked key unknown to the adapter (in neither `values` nor `missingFields`) makes it incomplete;
  - `[]` tracked gives complete with zero values;
  - duplicate tracked keys are de-duplicated, keeping the first;
  - the inputs are not mutated.
- IE-3a: 8-field extraction with 2 tracked, so `saveReport.values` has only those 2 keys.
- IE-3b, named `US-012 interim: incomplete extraction writes nothing`: a tracked key missing from the result gives a failure outcome with `stage 'select'`, the message names the key, and neither `saveReport` nor `findReport` is called. The same holds for a tracked key unknown to the adapter.
- IE-3c: `trackedFieldKeys: []` gives `saveReport` with `values: []`, and the outcome is `ok` with `valuesWritten: 0`.
- BD-2: `ingest-etf.ts` contains no field-key filtering itself. It imports `selectValuesToPersist`. This is a review check, backed by a source assertion that `ingest-etf.ts` imports `./select-values`.

**AC4: atomic write by pattern (a)**
- SQ-4a, structure, using a fake runner that records calls and `drizzle.mock({ schema })` from `drizzle-orm/neon-http` as the builder:
  - `saveReport` calls the runner **exactly once**, with `2 + N + 1` statements, and the store performs no other I/O;
  - `toSQL()` of S1 contains `insert into "reports"`, `on conflict ("etf_id","report_date") do update` and a `"status" <> $n` guard with param `'ok'`, and the status it inserts or sets is `'parse_error'`, not `'ok'`;
  - each value statement is `insert into "report_values" … select … from "reports" where …"etf_id" = $… and …"report_date" = $… and …"status" <> $…`;
  - the **last** statement is `update "reports" set "status" = $1, "error_message" = $2 … returning "id"`, with params `['ok', null, …]`;
  - no statement except the last has `'ok'` as a *set* value.
- PG-4b, rollback: `saveReport` with one value whose `numericValue` is `'not-a-number'` makes the `::numeric` cast fail in the middle of the batch, inside the PGlite transaction runner. `saveReport` rejects, and PGlite then has **no** `reports` row and no `report_values`.
- PG-4c, ordering proof: the same failing input through a deliberately **non-atomic** runner, which runs the statements one by one without a transaction and stops at the first error. The `reports` row exists with `status = 'parse_error'`, and **never** `ok`. This proves the (b) property.
- IE-4: the store interface has no separate "write values" method. A rejected `saveReport` gives a failure outcome with `stage 'persist'`, never an exception.

**AC5: re-runs**
- IE-5a: the fake store is pre-seeded with an `ok` row for `(etfId, '2026-09-22')`. The outcome is `already_ingested` with `reportDate`, and `saveReport` is not called.
- IE-5b: pre-seeded with a `parse_error` row, which is replaced. `saveReport` is called with `status 'ok'` and the new values.
- IE-5c: `ingestEtf` runs twice on the same fixtures with a stateful fake store. The first gives `ok` and the second `already_ingested`. `saveReport` is called once. The second call still makes one discovery and one download request (SPRINT-03-review N2).
- PG-5a: an existing `ok` row with values V1, then `saveReport` with values V2. The result is `already_ok`, the row is unchanged, and V1 is intact. This is the SQL-level guard for the overlapping-run race (US-014 tech-lead note 2).
- PG-5b: an existing `parse_error` row (inserted directly) with an old value set that includes an extra key, then `saveReport(ok, V2)`. The result is `written`. There is one row, with `status 'ok'`, `error_message NULL`, and the new `source_url`/`fetched_at`. The values are **exactly** V2, and the old extra key is gone.
- E2E-2: `ingestEtf` twice against the PGlite store. There is exactly one `reports` row and exactly N values, and the outcomes are `ok`, then `already_ingested`.
- IE-5d, race: `findReport` returns `undefined`, but `saveReport` returns `{ status: 'already_ok' }`. The outcome is `already_ingested`.

**AC6: one attempt, never throws**
- IE-6a: for every mocked scenario in IE-1, IE-5c and IE-7, `fetchImpl` gets at most one page request and at most one PDF request. With no adapter, `fetchImpl` is called **0** times.
- IE-6b, all three of which **resolve** with a failure outcome (`await expect(ingestEtf(...)).resolves`):
  - `fetchImpl` rejects, giving `stage 'discovery'`, `kind 'network'`;
  - the adapter's `extract` throws (a fake adapter registered in a test registry), giving `stage 'extract'` with the thrown message;
  - `findReport` rejects, or `saveReport` rejects, giving `stage 'persist'`.
- IE-6c: `registry.get` throws, giving a failure outcome with `stage 'adapter'`, not an exception.

**AC7: every failure path writes nothing and names its stage and message.** This is one parameterised test table in IE. For each row, the test asserts the outcome's `code` is the failure code, and checks `stage`, `kind` where applicable, and a non-empty `message`. It asserts `saveReport` is never called. `findReport` is also not called, because every one of these paths happens before the date is known or before persistence.

| Path | How it is triggered | `stage` / `kind` |
|---|---|---|
| discovery `error` | `fetchImpl` 503 for the page | `discovery` / `http_error` |
| discovery `not_found` | HTML with no `gv5News` table / a table with no VAN rows | `discovery` / `list_not_found`, `no_report_entries` |
| download failure | PDF URL returns HTML bytes | `download` / `not_pdf`; also an HTTP 404 case |
| unreadable text | valid `%PDF-` header plus garbage bytes, or a stub `extractText` returning `ok:false` | `text` / `unreadable` |
| no adapter | `adapterKey null` and `'unknown-key'` | `adapter` |
| adapter `ok:false` | fake adapter | `extract` |
| validation violations | fake adapter returning an unknown field key | `validate`; the message lists the violation messages. Named `US-012 interim: validation violations write nothing` |
| incomplete extraction | as IE-3b | `select`. Named `US-012 interim: …` |

Messages contain only Sprint 2 result messages, the adapter's own error text and field keys. They never contain page or PDF text, and never an env value (US-014 step 5, adopted now).

**AC8: boundaries**
- BD-1: a specifier scan over the non-test `.ts` files in `lib/ingestion/`, with the extractor function copied from `lib/extraction/adapters/boundaries.test.ts`. It first runs a positive control. It asserts:
  - no specifier starts with `next`, `react`, `@/app`, `@/components`, `../../app` or `../../components`;
  - no specifier matches `/\b(ai|openai|anthropic|@ai-sdk|llm)\b/i` or a path segment `/ai/`;
  - `ingest-etf.ts` and `select-values.ts` do not import `unpdf`, `@neondatabase/serverless`, `../db/index` or `../db`. Only `default-deps.ts` wires the concrete Sprint 2 functions and `getDb`;
  - no `process.env` in `lib/ingestion/`. `getDb` owns it;
  - the non-test file count is at least 4, so the check cannot pass vacuously.
- IE-8: `createDefaultIngestDeps()` is tested with `vi.mock("@neondatabase/serverless")` and `vi.stubEnv("DATABASE_URL", "postgresql://u:p@ep-fake.neon.tech/db")`, as in `lib/db/index.test.ts`. Its `discover === discoverLatestReport`, `download === downloadReportPdf`, `extractText === extractPdfText`, `registry === defaultAdapterRegistry`, and its `store` exposes `findReport`/`saveReport`. No method is invoked, so there is no network.
- In every IE/E2E test the global `fetch` is stubbed to throw and asserted uncalled (see the preamble). Neon is never reached: the tests use `drizzle.mock()` or the mocked `neon()`.

**AC9: gates.** Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` with `NODE_EXTRA_CA_CERTS` exported (DEC-008). Also run a clean install, `rm -rf node_modules && pnpm install --frozen-lockfile`, because `package.json` changes. That is the US-008 lesson.

**MANUAL-QA:** none that is specific to this story. Nothing calls `ingestEtf` in production until US-013. The live write to Neon is proven by US-013 AC9 and sprint-03.md QA steps 4 and 5. The QA checklist says so and points there.

---

## 2. Files and boundaries

Create:
- `lib/ingestion/select-values.ts`
  - It exports `selectValuesToPersist(result: Extract<ExtractionResult, { ok: true }>, trackedFieldKeys: readonly string[]): ValueSelection`, where `ValueSelection = { complete: true; values: ExtractedValue[] } | { complete: false; values: ExtractedValue[]; missingFieldKeys: string[] }`.
  - `values` in the incomplete branch holds the tracked values that *were* found. US-012 does not use them. US-014 (decision 2, partial `parse_error` rows) does.
  - It is pure and has no imports except types. **PRODUCT decision 1 changes only this function.**
- `lib/ingestion/store.ts`:
  - `ReportStore` has `findReport(etfId, reportDate): Promise<{ id: number; status: string } | undefined>` and `saveReport(input: SaveReportInput): Promise<SaveReportResult>`.
  - `SaveReportInput = { etfId; reportDate; sourceUrl; fetchedAt: Date; status: 'ok' | 'parse_error'; errorMessage: string | null; values: readonly ExtractedValue[] }`.
  - `SaveReportResult = { status: 'written'; reportId: number } | { status: 'already_ok' }`.
  - `buildSaveReportStatements(db, input)` returns the §0 list. It is exported so tests can `.toSQL()` it.
  - `buildFindReportStatement(db, etfId, reportDate)`: `select "id", "status"`. Keep the select/returning keys identical to the SQL column names (`id`, `status`), so that neon's mapped rows and PGlite's raw rows have the same shape (R3).
  - `BatchRunner = (statements) => Promise<readonly unknown[]>`. It is atomic, and it returns one result per statement.
  - `neonBatchRunner(db)` is `(s) => db.batch(s)`.
  - `createDrizzleReportStore(db: Db, run: BatchRunner = neonBatchRunner(db)): ReportStore`. `findReport` goes through `run([select])`. `saveReport` goes through `run(buildSaveReportStatements(...))` and reads the final statement's returned rows: an empty array means `already_ok`.
  - A tiny `rowsOf(result)` normaliser (`Array.isArray(r) ? r : r.rows`) with its own unit test.
  - Imports: `drizzle-orm`, `../db/schema`, the `Db` **type** from `../db/index` (a type-only import), and extraction types. It never calls `getDb`.
- `lib/ingestion/ingest-etf.ts`:
  - `ingestEtf(etf: IngestEtfInput, deps: IngestDeps): Promise<IngestOutcome>`.
  - `ingestReport(etf, adapter, link: { pdfUrl: string }, deps)` is exported. It is the "ingest one report link" half. PRODUCT decision 2 changes only the discovery half in `ingestEtf`.
  - Types:
    ```ts
    type IngestStage = 'adapter'|'discovery'|'download'|'text'|'extract'|'validate'|'select'|'persist'|'internal';
    type IngestOutcome =
      | { code: 'ok'; symbol: string; reportDate: string; valuesWritten: number; sourceUrl: string }
      | { code: 'already_ingested'; symbol: string; reportDate: string }
      | { code: 'failed'; symbol: string; stage: IngestStage; kind?: string; message: string; reportDate?: string };
    ```
    `ok` and `already_ingested` are stable. US-014 replaces `failed` with its vocabulary.
  - `IngestDeps = { discover(etf: {symbol; bvbUrl}): Promise<DiscoveryResult>; download(url): Promise<PdfDownloadResult>; extractText(bytes): Promise<PdfTextResult>; registry: Pick<AdapterRegistry,'get'>; store: ReportStore }`.
  - The story's optional `now` dependency is **omitted**. Nothing in this story reads the clock. `fetched_at` comes from the download result, and AC2 forbids the clock for the date. Adding it would invite misuse.
  - Control flow: a `let stage` variable is updated before each step, and the whole body is wrapped in one `try/catch`. A throw becomes `{ code: 'failed', stage, message }`. It must never rethrow.
  - Step order is as in the story's Task 1: adapter → discover → download → text → extract → validate → select → `findReport` → `saveReport`.
  - `sourceUrl` is `discovery.pdfUrl`, `fetchedAt` is `download.fetchedAt`, and `reportDate` is `result.reportDate`. Nothing else feeds these.
  - No `canHandle` check. That is US-014 AC4. Do not add it here.
  - Imports only types plus `../extraction/adapters/validate` and `./select-values`.
- `lib/ingestion/default-deps.ts`: `createDefaultIngestDeps(): IngestDeps`. It wires `discoverLatestReport`, `downloadReportPdf`, `extractPdfText`, `defaultAdapterRegistry` and `createDrizzleReportStore(getDb())`. `getDb()` runs when the function is **called**, not when the module is imported, so US-013 can catch `MissingDatabaseUrlError`. This is the only file that imports concrete I/O.
- `test/helpers/pglite.ts` (test-only):
  - `createTestDatabase()` creates an in-memory `new PGlite()` and applies `drizzle/0000_init.sql`, split on `--> statement-breakpoint`, so the shipped migration is also exercised.
  - It inserts one `etfs` row (BTBETRETF) and returns `{ pg, etfId, mockDb: drizzle.mock({ schema }) from 'drizzle-orm/neon-http', runner, nonAtomicRunner, close }`.
  - `runner` is `pg.transaction(async tx => { for each stmt: const { sql, params } = stmt.toSQL(); results.push((await tx.query(sql, params)).rows) })`.
  - `nonAtomicRunner` does the same without a transaction.
- The tests listed in §1.

Modify:
- `package.json`:
  - add devDependency `@electric-sql/pglite`, pinned exactly;
  - change `"unpdf": "^0.11.0"` to `"unpdf": "0.11.0"`. This is Sprint 2 audit N1: pin whenever `package.json` is touched.
- `pnpm-lock.yaml`, as regenerated by `pnpm add -D`.
- `pnpm-workspace.yaml` **only if** `pnpm add` prompts for build approval. PGlite has no install scripts, so it should not. Never leave a placeholder value (US-008 round 1 Critical).

Do not change:
- `lib/extraction/**`, including `report-latest.ts`, whose behaviour is frozen (story Notes);
- `lib/db/schema.ts`, `lib/db/index.ts`, `drizzle/**`;
- any UI.

Boundary summary: `ingest-etf.ts` (orchestration, pure logic plus injected I/O) → `select-values.ts` (pure) and `store.ts` (SQL building plus an injected runner) → `default-deps.ts` (production wiring). `lib/extraction` never imports `lib/ingestion`.

---

## 3. Data model and migration

None. The existing `reports`/`report_values` columns, the `UNIQUE (etf_id, report_date)` and `UNIQUE (report_id, field_key)` constraints, and the NOT NULL FKs (DEC-010 D1) are enough.
- `status` is a plain `text` column. The interim value `parse_error` is inside the documented enum.
- No `drizzle-kit generate` run. The PGlite helper applies the **existing** `0000_init.sql` in memory only.
- Nothing touches Neon.

---

## 4. Risks and the smallest design

- **R1: PGlite is an added devDependency.** Justification (AGENTS.md "New runtime dependency … small and justified"; story Notes pre-authorise it):
  - It is dev-only, never bundled, has zero runtime dependencies, and is a WASM Postgres.
  - It is the only offline way to *execute* the guard and subquery SQL that AC4, AC5 and US-014 rely on. `.toSQL()` alone cannot catch the R2-class bugs.
  - The drizzle pglite driver has no `batch()`. I checked `node_modules/drizzle-orm/pglite/driver.d.ts`. So, as the tech-lead caveat says, the tests execute the **shipped** statements (`buildSaveReportStatements`) through an injected runner, not a re-implementation.
  - **Fallback:** if PGlite fails to install (for example pnpm `minimumReleaseAge`, so pick a slightly older exact version) or fails to run under WSL1 in Vitest, drop the PG/E2E files. AC4 and AC5 are then proven by SQ plus IE alone, which the story Notes explicitly accept. Record the fallback in HANDOVER.md. No DEC is needed.
  - Give the PGlite `beforeAll` a `hookTimeout` of about 60 s, because WASM loading on DrvFs is slow.
- **R2: INSERT…SELECT parameter typing.** Postgres types an untyped `$n` in a SELECT list as `text`, and inserting that into `numeric` fails. Cast explicitly: `sql\`${v.numericValue}::numeric\``, `::text` for the key and raw value. Build the value statement with `db.insert(reportValues).select(db.select({ reportId: reports.id, fieldKey: sql…as('field_key'), numericValue: sql…as('numeric_value'), rawValue: sql…as('raw_value') }).from(reports).where(guard))`. The column list is derived from the selected keys. Verify with PG. If Drizzle's insert-select typing fights back, a `db.execute(sql\`…\`)` item is acceptable only if it is `BatchItem`-compatible and passes the same SQ/PG tests.
- **R3: result shapes differ between neon `batch` and the PGlite runner.** Select and return only columns whose key equals the SQL name (`id`, `status`), and read the last result through `rowsOf`. PG-5a/5b and E2E cover it.
- **R4: fake timers.** Fake only `Date` in IE-2. Faking `setTimeout` would hang `fetchOnce`'s timeout race or unpdf.
- **R5: concurrency.** Covered by the SQL guards in §0. A test cannot run two Neon transactions concurrently offline. PG-5a proves the committed-`ok` case, and the rest is argued in §0. It is not claimed as tested.
- **R6: Neon HTTP transaction semantics are only proven live.** The atomicity of `client.transaction` is Neon's guarantee, not something this repo can test offline. PG-4b models it, and the live run in US-013's QA exercises it.
- **R7: duplicate tracked keys** would violate `UNIQUE (report_id, field_key)` and fail the batch. `selectValuesToPersist` de-duplicates them.
- **R8: forward compatibility, without building it now.**
  - For US-014: `selectValuesToPersist` returns the found values on the incomplete path, and `saveReport` accepts `status: 'parse_error'`. The "interim" tests are named with the `US-012 interim:` prefix, so US-014's plan can list exactly which ones it supersedes (US-014 tech-lead note 1). These are IE-3b, "US-012 interim: incomplete extraction writes nothing", and the validation row of the AC7 table, "US-012 interim: validation violations write nothing".
  - For PRODUCT decision 2: `ingestReport` is the per-link unit.
  - No other extension points.
- **R9: `unpdf` exact pin.** Changing `^0.11.0` to `0.11.0` keeps the same resolved version, and the lockfile specifier updates. Confirm the clean `--frozen-lockfile` install (AC9).

Implementation order: 1 `select-values` + ST → 2 `store` + SQ → 3 PGlite helper + PG → 4 `ingest-etf` + IE → 5 E2E → 6 `default-deps` + IE-8 → 7 BD → 8 package pins and the clean-install check → 9 the four gates.

## 5. Decisions needed

None. Pattern (a) is chosen within DEC-010's allowed set, and the PGlite devDependency is pre-authorised by the story Notes and AGENTS.md. The story's PRODUCT 1 and 2 remain NEEDS USER at the demo and are non-blocking; this story implements the literal reading.
