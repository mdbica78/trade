# US-014 plan: missing report, parse failure and no-adapter handling

Planner: `story-planner` (opus, high), 2026-09-24. Mode: `plan US-014`.
Sources read: `backlog/stories/US-014.md` (including its `## Tech-lead review`), US-012.md, US-013.md, US-015.md, `verification/SPRINT-03-review.md`, `verification/US-012-plan.md`, `verification/US-013-plan.md`, DEC-010 (via the US-012 plan and store). Code: `lib/ingestion/{ingest-etf,store,select-values,run-daily,default-deps}.ts` and every test file in `lib/ingestion/`, `lib/cron/daily-handler{,.test}.ts`, `lib/extraction/{discovery,pdf,http}.ts`, `lib/extraction/adapters/{types,validate,registry}.ts`, `test/helpers/pglite.ts`.

**Decisions needed: none.** Story decisions 1 and 2 are already Decided (A and A, SPRINT-03-review). The only choice the story does not spell out, how an unexpected *throw* maps onto the seven codes, follows from the story's own table (a code per pipeline stage). It is settled in §4 R2 and flagged for the reviewer, not escalated.

---

## 0. Starting point and what changes

US-012 already does most of the plumbing:
- the adapter is resolved before any network call;
- `store.saveReport` accepts `status: 'ok' | 'parse_error'` and an `errorMessage`;
- **every** statement in `buildSaveReportStatements` is guarded by `status <> 'ok'`, and the values' `report_id` is resolved by a subquery that carries the same guard. So the tech-lead's point 2 ("never downgrade `ok` inside the write") is already true in SQL for a `parse_error` save too. This story adds the tests that prove it for that input (§1 AC7). **No store code change is expected.** If one of the new PG tests fails, fix the SQL in `store.ts`, never the test.

This story changes:
1. The outcome type: `failed` + `stage` is replaced by the seven codes, and every outcome gets a `detail`.
2. `ingestReport` gets a `canHandle` gate (between text and extract).
3. The incomplete path and the contract-violation-with-valid-date path now write a `parse_error` row through the same `saveReport` (after the same `findReport` precedence check).
4. The tests that encoded US-012's interim behaviour (tech-lead point 1, table in §1 "Superseded / edited tests").

---

## 1. Acceptance criteria, each with the test that proves it

Test files (all offline, Vitest, global `fetch` stubbed to throw `real network forbidden` in `beforeEach` and asserted uncalled, as in US-012):
- `lib/ingestion/outcome.test.ts` (OC): the vocabulary and the pure message builders.
- `lib/ingestion/ingest-etf.failures.test.ts` (IF): new. The failure paths with a stateful `FakeStore`, either a mocked `fetchImpl` through the real `discoverLatestReport` / `downloadReportPdf` (when request counts matter), or a stub pipeline (`discover` → found link, `download` → `{ ok: true, bytes, fetchedAt: <a fixed Date built in the test> }`, `extractText` → given text, `registry` = `createAdapterRegistry([fakeAdapter])`).
- `lib/ingestion/ingest-etf.test.ts` (IE): existing, edited as listed below.
- `lib/ingestion/store.test.ts` (SQ) and `store.pglite.test.ts` (PG): existing, tests added.
- `lib/ingestion/ingest-etf.pglite.test.ts` (E2E): existing, one test added.
- `lib/ingestion/boundaries.test.ts` (BD): existing, checks added.

Shared test helpers go in a new `test/helpers/ingest-fakes.ts` (`FakeStore`, `makeFetchImpl`, fixture URL constants, `stubPipelineDeps(adapter, text, store)`). The new IF file imports them. Moving IE's local copies to the helper is optional and must not change any IE assertion.

The fake adapter used by IF-5/6/7 has `key: 'fake-depositary'` and `fieldKeys: ['net_asset', 'units_in_circulation', 'nav_per_unit']`; the ETF's tracked fields are the same three unless a test says otherwise.

**AC1: No adapter**
- IF-1a: `adapterKey: null` → `{ code: 'no_adapter', symbol, detail: 'no adapter: adapter_key not set' }`. `fetchImpl` called 0 times, `findReport`/`saveReport` 0 times.
- IF-1b: `adapterKey: 'unknown-key'` → `no_adapter`, detail `no adapter: adapter_key "unknown-key" is not registered`. Same zero-call assertions.
- IF-1c, isolation: with **one shared** `fetchImpl` and `FakeStore`, call `ingestEtf` for the no-adapter ETF, then for BTBETRETF (real fixtures). The second outcome is `ok`, `fetchImpl` was called exactly twice in total (page, then PDF, both for the second ETF), and the store holds only the second ETF's row.
- IF-1d: the outcome has no `reportDate` key (`'reportDate' in outcome === false`).

**AC2: Missing report**
- IF-2a: page HTML without the `gv5News` table → `{ code: 'missing', reason: 'list_not_found', detail: 'no report found: list_not_found' }`.
- IF-2b: page HTML with a `gv5News` table and no `VAN la data` row (a small table built in the test) → `reason: 'no_report_entries'`, detail `no report found: no_report_entries`.
- Both: `fetchImpl` called exactly once, with the instrument page URL (no download); `findReport`/`saveReport` never called; no `reportDate`.

**AC3: Fetch failures** (one parametrised table, real discovery/download with a mocked `fetchImpl`)

| Case | Trigger | Expected outcome | `fetchImpl` calls |
|---|---|---|---|
| discovery http_error | page → 503 | `fetch_error`, `stage: 'discovery'`, `kind: 'http_error'`, `httpStatus: 503`, detail starts `discovery http_error 503:` | 1 |
| discovery network | `fetchImpl` rejects | `stage 'discovery'`, `kind 'network'`, detail starts `discovery network:` | 1 |
| discovery timeout | stub `discover: (e) => discoverLatestReport(e, { fetchImpl: never-resolving, timeoutMs: 20 })` | `stage 'discovery'`, `kind 'timeout'` | 1 |
| download http_error | page OK, PDF URL → 404 | `stage 'download'`, `kind 'http_error'`, `httpStatus: 404`, detail starts `download http_error 404:` | 2 |
| download network | page OK, PDF request rejects | `stage 'download'`, `kind 'network'` | 2 |
| download timeout | page OK, PDF never resolves, `download` with `timeoutMs: 20` | `stage 'download'`, `kind 'timeout'` | 2 |
| download not_pdf | page OK, PDF URL returns HTML | `stage 'download'`, `kind 'not_pdf'` | 2 |

Every row: `findReport`/`saveReport` never called, no `reportDate`, and the per-URL call count is exactly 1 (each request made once).

**AC4: Unusable report** (no row, no value)
- IF-4a unreadable text, real path: the PDF URL returns `%PDF-` + garbage bytes → `{ code: 'parse_error', reason: 'unreadable_text' }`, detail starts `unreadable text:`.
- IF-4b unreadable text, stub: `extractText` → `{ ok: false, kind: 'unreadable', message: 'PDF has no extractable text' }` → same code/reason.
- IF-4c **`canHandle` false stops extraction**: fake adapter with `canHandle: () => false` and `extract: vi.fn(() => <a complete, contract-valid result for 2026-09-22>)`. Outcome `parse_error`, `reason 'format_not_recognised'`, detail `report format not recognised by adapter fake-depositary`. `extract` was **never called**, `findReport`/`saveReport` never called, no `reportDate`.
- IF-4d `canHandle` false with the **real** `brd-depositary` adapter: stub `extractText` returns unrelated text (`"Raport lunar al altui depozitar"`) → `parse_error` / `format_not_recognised`. Proves the gate is wired for the production adapter, not just fakes.
- IF-4e adapter `ok: false`: fake adapter returning `{ ok: false, error: 'report date not found (footer phrase missing)' }` → `parse_error`, `reason 'extraction_failed'`, detail `extraction failed: report date not found (footer phrase missing)`. No row.
- IF-4f: `registry` passed to `ingestEtf` is a `{ get }`-only object, plus a type assertion `expectTypeOf<IngestDeps['registry']>().toEqualTypeOf<Pick<AdapterRegistry, 'get'>>()`. The pipeline cannot fall back to `detect` (story Notes; US-009 AC2). BD-14b backs it at source level.
- For all AC4 cases: `saveReportCalls.length === 0` and `findReportCalls.length === 0`.

**AC5: Incomplete extraction** (fake adapter via the stub pipeline; result date `2026-09-22`; `net_asset` and `units_in_circulation` in `values` with valid canonical numbers, `nav_per_unit` in `missingFields`)
- IF-5a: `saveReport` called **exactly once** with:
  - `status: 'parse_error'`, `reportDate: '2026-09-22'`, `sourceUrl` = the discovered `pdfUrl`, `fetchedAt` = the download's `fetchedAt` (same object);
  - `errorMessage: 'missing fields: nav_per_unit'`;
  - `values` = exactly the two found values (`net_asset`, `units_in_circulation`), and no entry for `nav_per_unit`.
  - Outcome: `{ code: 'parse_error', reason: 'incomplete', reportDate: '2026-09-22', detail: 'missing fields: nav_per_unit' }`.
- IF-5b: tracked = `['net_asset', 'nav_per_unit', 'not_a_real_field']` → `errorMessage` names **both** missing keys, in tracked order: `missing fields: nav_per_unit, not_a_real_field`. The expectation is built by calling `selectValuesToPersist`, not by re-implementing its rule (story Notes).
- IF-5c: every tracked field missing (all three in `missingFields`) → a `parse_error` row with `values: []`.
- IF-5d: no `saveReport` call in any IF-5 case has `status: 'ok'` (the "no `ok` row ever for an incomplete result" bullet).
- Atomicity (DEC-010 note 2), proven at three levels:
  - SQ-14a: `buildSaveReportStatements(mockDb, { …, status: 'parse_error', errorMessage: 'missing fields: nav_per_unit', values: [2 values] })` returns `2 + 2 + 1` statements; every one of them contains `"status" <> ` in its SQL; the last one is the `update "reports" … returning "id"` with params starting `['parse_error', 'missing fields: nav_per_unit']`. The store API still has only `findReport`/`saveReport` (no separate values write).
  - PG-14a: `saveReport` with that input on a fresh PGlite → one `reports` row (`status 'parse_error'`, `error_message 'missing fields: nav_per_unit'`, `report_date::text '2026-09-22'`, `source_url`, `fetched_at` not null) and exactly the two `report_values` rows, no `nav_per_unit`.
  - PG-14b: the same input with one value's `numericValue: 'not-a-number'` through the atomic `runner` → rejects, and **no** `reports` row and no values remain.
- E2E-3: `ingestEtf` with a stub pipeline (fake adapter) but the **real** `createDrizzleReportStore(db.mockDb, db.runner)` → PGlite holds the `parse_error` row and exactly the found values.

**AC6: Contract violations**
- IF-6a, valid date: fake adapter returns `ok: true`, `reportDate '2026-09-22'`, `values` = `net_asset` with `numericValue '1,234.5'` (not canonical) and a valid `units_in_circulation`, and omits `nav_per_unit` from both lists (uncovered). → `saveReport` once with `status 'parse_error'`, `values: []`, `errorMessage` = `contract violations: uncovered_field(nav_per_unit); invalid_numeric_value(net_asset)` (order = `validateExtractionResult` order). Outcome `parse_error`, `reason 'contract_violation'`, `reportDate '2026-09-22'`.
- IF-6b, the message contains **no** extracted text: assert `errorMessage` and `detail` do not contain `1,234.5` (story step 5: field keys only, never PDF content). The builder uses each violation's `rule` and `fieldKey`, never its `message` (which quotes values).
- IF-6c, invalid date: `reportDate: '2026-02-30'`, otherwise valid → no `findReport`, no `saveReport`; outcome `parse_error`, `reason 'contract_violation'`, detail `contract violations: invalid_report_date`, and **no** `reportDate` key (an invalid date is never echoed as if known).
- IF-6d, violations **and** incomplete: violations win. `values: []`, message starts `contract violations:`.
- PG-14c: `saveReport({ status: 'parse_error', errorMessage: 'contract violations: …', values: [] })` → one `parse_error` row, zero `report_values`.

**AC7: Precedence** (parametrised over two "later bad results": the IF-5a incomplete result and the IF-6a violation result)
- IF-7a, existing `ok` (fake store pre-seeded): outcome `{ code: 'already_ingested', reportDate: '2026-09-22', detail: 'report already stored' }`, `findReport` called once, `saveReport` **not** called, seeded row unchanged.
- IF-7b, race: `findReport` → `undefined`, `saveReport` → `{ status: 'already_ok' }` → `already_ingested`.
- IF-7c, existing `parse_error` row replaced by a later complete result: pre-seed `parse_error` with an old value set; a complete fake result → `saveReport` with `status 'ok'`, `errorMessage null`, the new values; outcome `ok`. (IE-5b already covers this with the real adapter; kept.)
- IF-7d, existing `parse_error` replaced by a later `parse_error`: pre-seed `parse_error` with message `missing fields: net_asset` and values `{ units_in_circulation: '1' }`; the later IF-5a result → `saveReport` with the new message and new values; the `FakeStore` row now holds exactly the new values and message.
- **SQL-level guard (tech-lead point 2)**, on PGlite with the shipped statements:
  - PG-14d: `saveReport(ok, V1)` then `saveReport({ status: 'parse_error', errorMessage: 'missing fields: nav_per_unit', values: V2 partial })` → second result `{ status: 'already_ok' }`; the row is still `ok` with `error_message NULL`, the original `source_url`/`fetched_at`, and **exactly V1** in `report_values`.
  - PG-14e: same, but the later save has `values: []` (violation path) → `already_ok`, V1 intact. This is the case the tech-lead warned about: the values delete must not touch the `ok` row's values.
  - PG-14f: existing `parse_error` row (message `old`, values `{old_field}`) then `saveReport(parse_error, 'missing fields: nav_per_unit', V2)` → `written`, one row, `status 'parse_error'`, new message, new `source_url`, values exactly V2.
  - SQ-14b: for `status: 'parse_error'` input, every statement's SQL contains the `"status" <> ` guard with param `'ok'` (the same assertion US-012 has for `status: 'ok'`, now for the other write status).

**AC8: One outcome, never throws, only `ok`/`parse_error` rows**
- OC-8a: `INGEST_OUTCOME_CODES` equals exactly `['ok', 'already_ingested', 'missing', 'fetch_error', 'no_adapter', 'parse_error', 'persist_error']`, and `expectTypeOf<IngestOutcome['code']>().toEqualTypeOf<IngestOutcomeCode>()`.
- IF-8a, a trigger per code: `const triggers: Record<IngestOutcomeCode, () => Promise<IngestOutcome>>`. The `Record` type makes `pnpm typecheck` fail if a code has no trigger. Each trigger's result has that code, a string `symbol`, and a non-empty single-line `detail` (no `\n`). A final assertion checks that the set of produced codes equals `INGEST_OUTCOME_CODES` (anti-vacuity). The `persist_error` trigger is `saveReport` rejecting; `findReport` rejecting is IE-6b-iii (edited).
- IF-8b, never throws: parametrised over every injected function throwing an `Error` **and** throwing a non-Error value (`'plain'`): `registry.get` → `no_adapter`; `discover` → `fetch_error` (`stage 'discovery'`, `kind 'unexpected'`); `download` → `fetch_error` (`stage 'download'`, `kind 'unexpected'`); `extractText`, `canHandle`, `extract` → `parse_error` (`reason 'unexpected'`, no row); `findReport`, `saveReport` → `persist_error` (with `reportDate`). Every case uses `await expect(ingestEtf(...)).resolves` and checks the code is in `INGEST_OUTCOME_CODES`.
- IF-8c, only two statuses: collect every `SaveReportInput` from every IF scenario into one list (a module-level recorder in the helper); assert every `status` is `'ok'` or `'parse_error'` and that both occur. Plus `expectTypeOf<SaveReportInput['status']>().toEqualTypeOf<'ok' | 'parse_error'>()`.
- BD-14a: among non-test files under `lib/ingestion/`, only `store.ts` contains `insert into "reports"` or `update "reports"`. So `saveReport` is the only path that writes a status.
- BD-14b: `ingest-etf.ts` does not contain `.detect(` (no adapter fallback).
- BD-3 (existing) still passes: no `new Date(`, `Date.now(` or `publishedAt` in non-test `lib/ingestion` files. It now also covers `outcome.ts`. This is the reviewer's "no guessed date" check.

**AC9: Gates.** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, with `NODE_EXTRA_CA_CERTS` exported (DEC-008). `package.json` should not change. If it does, also run `rm -rf node_modules && pnpm install --frozen-lockfile` (US-008 lesson).

**MANUAL-QA: none specific to this story.** All three seeded ETFs have the `brd-depositary` adapter, so production never hits `no_adapter` today, and the other failure paths depend on bvb.ro misbehaving. Live behaviour is observed through US-015 AC9 (`job_runs.log` lines with these codes). The QA checklist states that and points there.

### Superseded / edited US-012 and US-013 tests (tech-lead point 1)

Only the two `US-012 interim:` tests change behaviour. Every other edit is the vocabulary rename (`failed` + `stage` + `message` → a code + structured fields + `detail`) or adding the now-required `detail`. The asserted behaviour (which path, what was or was not written, how many requests) stays the same or gets stricter.

| File / test | Change | Replaced by |
|---|---|---|
| `ingest-etf.test.ts` "US-012 interim: incomplete extraction writes nothing (tracked key missing from result)" | **Behaviour change.** Rename to "US-014 AC5: an unknown tracked key gives a parse_error row with the found values". Assert `saveReport` once with `status 'parse_error'`, `errorMessage 'missing fields: not_a_real_field'`, `values` = only `units_in_circulation` (real fixture value from `expected.json`); `findReport` called once; outcome `parse_error` / `incomplete` / `reportDate '2026-09-22'`. | US-014 AC5 |
| `ingest-etf.test.ts` AC7 table row "US-012 interim: validation violations write nothing" | **Behaviour change.** Remove the row from the "writes nothing" table. Its exact fake adapter (valid date `2026-09-22`, one `unknown_field` value, both real keys in `missingFields`) moves to IF-6 as "US-014 AC6: violations with a valid date write a parse_error row with no values": `saveReport` once, `status 'parse_error'`, `values: []`, `errorMessage 'contract violations: unknown_field(unknown_field)'`. | US-014 AC6 |
| `ingest-etf.test.ts` AC7 table, the other 8 rows | Vocabulary only. `stage`/`kind` expectations become `code` plus `stage`/`kind`/`reason` per the §2 mapping (discovery 503 → `fetch_error`; `list_not_found` → `missing`; not_pdf/404 → `fetch_error`; unreadable → `parse_error`/`unreadable_text`; null/unknown key → `no_adapter`; adapter `ok:false` → `parse_error`/`extraction_failed`). `message.length > 0` becomes `detail.length > 0`. The "saveReport/findReport never called" assertions stay unchanged. Retitle the describe to "every pre-date failure path writes nothing". | AC1–AC4 |
| IE-1, IE-5a, IE-5d | Add the now-required `detail` to the `toEqual` expectations (`'stored 2 values'`, `'report already stored'`). | AC8 |
| IE-4, IE-6b-iii | `{ code: 'failed', stage: 'persist', message }` → `{ code: 'persist_error', reportDate: '2026-09-22' }` and `detail` contains `db exploded` / `find failed`. | AC8 |
| IE-6b-i | → `{ code: 'fetch_error', stage: 'discovery', kind: 'network' }`. | AC3 |
| IE-6b-ii (extract throws) | → `{ code: 'parse_error', reason: 'unexpected' }`, `detail` contains `adapter blew up`, no `saveReport`. | AC8 |
| IE-6c (registry.get throws), "a call with no adapter makes zero fetch calls" | → `code: 'no_adapter'`; the zero-fetch assertion stays. | AC1 |
| `run-daily.test.ts` `okOutcome`, RD-3a `failedOutcome` | Type fixtures only: `okOutcome` gains `detail`; `failedOutcome` becomes `{ code: 'fetch_error', symbol: 'A', stage: 'download', kind: 'http_error', httpStatus: 503, detail: 'boom-a' }`. The runner behaviour asserted (stored as returned, `toBe` identity) is unchanged. | — |
| `daily-handler.test.ts` H-3c/H-6a, H-6c | Type fixtures only: the `ok` entry gains `detail`; each `failed` entry becomes a `fetch_error` entry. In H-6c the secret-bearing text moves from `message` to `detail`, so the redaction test still carries both secrets in an outcome text field. | — |
| `default-deps.cron.test.ts` | `toMatchObject({ code: 'failed', stage: 'discovery' })` → `toMatchObject({ code: 'missing', reason: 'list_not_found' })` (the mocked discovery returns that reason). | AC2 |

No test is deleted without a replacement asserting the new specified behaviour. The reviewer checks this table against the changed files.

---

## 2. Files and boundaries

Create:
- `lib/ingestion/outcome.ts`: pure, types plus string helpers. No imports except types from `../extraction/**`.
  ```ts
  export const INGEST_OUTCOME_CODES = ['ok','already_ingested','missing','fetch_error','no_adapter','parse_error','persist_error'] as const;
  export type IngestOutcomeCode = (typeof INGEST_OUTCOME_CODES)[number];
  export type ParseErrorReason = 'unreadable_text' | 'format_not_recognised' | 'extraction_failed' | 'contract_violation' | 'incomplete' | 'unexpected';
  type Base = { symbol: string; detail: string };
  export type IngestOutcome =
    | (Base & { code: 'ok'; reportDate: string; valuesWritten: number; sourceUrl: string })
    | (Base & { code: 'already_ingested'; reportDate: string })
    | (Base & { code: 'missing'; reason: 'no_report_entries' | 'list_not_found' })
    | (Base & { code: 'fetch_error'; stage: 'discovery' | 'download'; kind: 'http_error' | 'network' | 'timeout' | 'not_pdf' | 'unexpected'; httpStatus?: number })
    | (Base & { code: 'no_adapter' })
    | (Base & { code: 'parse_error'; reason: ParseErrorReason; reportDate?: string })
    | (Base & { code: 'persist_error'; reportDate?: string });
  ```
  Plus pure builders, each unit-tested in OC:
  - `oneLine(s)`: collapses every whitespace run (incl. `\n`) to one space and trims; an empty result becomes `(no message)`.
  - `formatMissingFields(keys)`: `missing fields: a, b`.
  - `formatViolations(violations)`: `contract violations: rule(fieldKey); rule` (field omitted when absent). Uses only `rule` and `fieldKey`.
  - `formatFetchError(stage, kind, httpStatus, message)`: `<stage> <kind>[ <status>]: <message>`.
  - `errorText(e)`: `e instanceof Error ? e.message : String(e)`, never throws (wrap `String()` in try/catch → `(unprintable error)`).

  Detail prefixes (stable, English diagnostics, not UI strings, story step 5):

  | code | detail |
  |---|---|
  | ok | `stored N values` |
  | already_ingested | `report already stored` |
  | missing | `no report found: <reason>` |
  | fetch_error | `<stage> <kind>[ <httpStatus>]: <message>` |
  | no_adapter | `no adapter: adapter_key not set` / `no adapter: adapter_key "<key>" is not registered` / `no adapter: lookup failed: <message>` |
  | parse_error | `unreadable text: <message>` / `report format not recognised by adapter <key>` / `extraction failed: <adapter error>` / `contract violations: …` / `missing fields: …` / `unexpected error during <stage>: <message>` |
  | persist_error | `database write failed: <message>` |

  For `parse_error` rows, `error_message` equals the outcome's `detail`.
- `lib/ingestion/outcome.test.ts`, `lib/ingestion/ingest-etf.failures.test.ts`, `test/helpers/ingest-fakes.ts`.

Modify:
- `lib/ingestion/ingest-etf.ts`:
  - `export type { IngestOutcome } from './outcome'` so `run-daily.ts` keeps importing from `./ingest-etf` unchanged. Drop the exported `IngestStage` type (nothing else uses it). Keep an internal `stage` variable only for mapping throws (§4 R2).
  - `ingestEtf`: adapter lookup (`no_adapter`, no network) → discover (`fetch_error` / `missing`) → `ingestReport`.
  - `ingestReport`: download (`fetch_error`) → text (`parse_error`/`unreadable_text`) → **`adapter.canHandle(text)`** (`parse_error`/`format_not_recognised`; `extract` not called) → extract (`ok:false` → `extraction_failed`) → validate: if there are violations, then if `violations.some(v => v.rule === 'invalid_report_date')` → `parse_error` with no `reportDate` and no store call; else `persist('parse_error', formatViolations(...), [])` → select: incomplete → `persist('parse_error', formatMissingFields(missing), selection.values)`; complete → `persist('ok', null, selection.values)`.
  - A private `persist(status, errorMessage, values)` applies the US-012 precedence once for all three write paths: `findReport` → `ok` ⇒ `already_ingested`; `saveReport` → `already_ok` ⇒ `already_ingested`; `written` ⇒ `ok` outcome (for `status 'ok'`) or `parse_error` outcome with its `reason` and `reportDate`.
  - Every outcome's `detail` goes through `oneLine`.
- `lib/ingestion/select-values.ts`: comment only. "nothing should be persisted for an incomplete selection (US-012 AC3)" becomes "an incomplete selection is persisted as a `parse_error` row with the found values (US-014 AC5)". No logic change.
- Tests listed in §1 (the edit table plus the added SQ/PG/E2E/BD tests).

Do not change: `lib/ingestion/store.ts` (unless a PG-14 test proves the guard wrong, see §0), `run-daily.ts`, `default-deps.ts`, `load-etfs.ts`, `lib/cron/**` source, `app/**`, `lib/extraction/**`, `lib/db/**`, `drizzle/**`, `package.json`.

Boundaries: `outcome.ts` (pure vocabulary) ← `ingest-etf.ts` (orchestration, injected I/O) → `select-values.ts` (pure) and `ReportStore` (interface). The existing BD-1 scan (no Next/React/AI imports, no `process.env`) now also covers `outcome.ts`. Add `outcome.ts` to the list of files that must not import `unpdf`/Neon/`../db`.

---

## 3. Data model and migration

None. `reports.status` is plain `text` (US-003), and only `ok`/`parse_error` are written (decision 1 A). `missing`/`no_adapter` stay documented but unused. There is no new column or table, no `drizzle-kit generate`, and nothing touches Neon.

---

## 4. Risks and the smallest design

- **R1: the outcome type ripples into US-013's test files.** `run-daily.ts` and `daily-handler.ts` only pass outcomes through (US-013 plan: "the runner must not reshape it, so US-014 needs no runner change"), so no production file outside `lib/ingestion/ingest-etf.ts` changes. Three US-013 test files have typed fixtures that must follow the new union (edit table). Run `pnpm typecheck` first. It lists every fixture that needs an edit.
- **R2: throws have to map onto the seven codes** (AC8 "exactly one outcome from the table … never throws"). The story's table assigns codes by pipeline stage, so a throw at a stage becomes that stage's code: adapter lookup → `no_adapter`; discovery/download → `fetch_error` with `kind: 'unexpected'`; text/`canHandle`/extract/validate/select → `parse_error` with `reason: 'unexpected'` and no row; `findReport`/`saveReport` → `persist_error`. The alternative, a new `internal_error` code inside `ingestEtf`, would break AC8's closed list. US-013's runner already owns `internal_error` for a thrown `ingestEtf`. Reviewer: check this mapping, and that `kind: 'unexpected'` is the only kind value not taken from a Sprint 2 result.
- **R3: messages must not leak page/PDF content or env values** (step 5). Violation messages from `validateExtractionResult` quote `numericValue`/`reportDate`, so `formatViolations` uses only `rule`/`fieldKey` (IF-6b). `ingestEtf` never reads `process.env` (BD-1). Pass-through texts are limited to what the story allows: Sprint 2 fetch messages (URL + status), the adapter's own error text, and DB driver error messages in `persist_error`. A driver message could in theory contain connection details. The composed text never adds any. US-013's handler already redacts `CRON_SECRET`/`DATABASE_URL` from the response, and US-015 AC4 must redact the log. Put that in the QA file as a forward note for US-015. It is not solved here.
- **R4: the `canHandle` gate could reject the real fixtures.** US-010's smoke check showed `canHandle` true on all three real PDFs, and IE-1/E2E-1 (real fixture, real adapter) keep proving it. If IE-1 turns red after adding the gate, that is a real adapter/fixture mismatch. Stop and report it. Do not bypass the gate.
- **R5: concurrency.** An overlapping `ok` write vs. a `parse_error` write is guarded in SQL (PG-14d/e). The reverse order (a `parse_error` committed first, then `ok`) correctly upgrades. Two concurrent `parse_error` writes: the last writer wins with its own message and values, and both are flagged. As in US-012, true concurrency is argued, not tested.
- **R6: `already_ingested` for a bad result over an `ok` row hides the bad parse.** That is the specified behaviour (AC7). The stored `ok` data is the trustworthy one.
- **R7: PRODUCT decision 1 (tracked vs. every field)** would only change `selectValuesToPersist`. The IF-5 expectations are derived from that function (IF-5b), so they follow automatically.

Smallest design: one new pure module, one reshaped orchestrator with a single `persist` helper, and zero store/schema/dependency changes. No extension points beyond the ones US-012 already has.

Implementation order: 1 `outcome.ts` + OC → 2 `ingest-etf.ts` rewrite → 3 `pnpm typecheck` and fix the fixtures in the edit table → 4 `ingest-fakes.ts` helper + IF file → 5 SQ/PG/E2E additions → 6 BD additions → 7 the four gates.

## 5. Decisions needed

None.
