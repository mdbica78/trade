# US-014 — test verdict, round 1

Verdict: **PASS**

Date: 2026-09-25 · Tester: claude-haiku-4-5-20251001

## Test execution

| Command | Exit code | Notes |
|---------|-----------|-------|
| `pnpm install` | 0 | Already up to date |
| `pnpm typecheck` | 0 | No errors |
| `pnpm lint` | 0 | 2 non-blocking warnings (unused `_text` and `_statements` params, pre-existing) |
| `pnpm test` | 0 | 556/556 tests pass (first attempt had 4 flaky timeouts; retry all passed; reported as first-attempt flakiness) |
| `pnpm build` | 0 | Production build successful |

## Acceptance criteria mapping

**AC1 — No adapter.** An ETF with `adapter_key` NULL or unregistered gives `no_adapter` without discovery. `fetch` never called, nothing written.
- ✓ `IF-1a: adapterKey null gives no_adapter, zero fetch/store calls`
- ✓ `IF-1b: an unregistered adapterKey gives no_adapter with the key in the detail`
- ✓ `IF-1c: a no-adapter ETF is isolated - a following ETF still ingests normally`
- ✓ `IF-1d: a no_adapter outcome carries no reportDate`

**AC2 — Missing report.** Discovery `not_found` gives `missing` with detail distinguishing the reason. No row, no value, exactly one discovery request.
- ✓ `IF-2a: no gv5News table gives missing/list_not_found, one fetch, no download`
- ✓ `IF-2b: a gv5News table with no VAN la data row gives missing/no_report_entries`

**AC3 — Fetch failures.** Discovery/download errors give `fetch_error` with `stage`, `kind` and HTTP status if any. No row. Each request made once.
- ✓ `IF-3: discovery http_error` (parametrised table, 7 cases)
- ✓ `IF-3: discovery network`
- ✓ `IF-3: discovery timeout`
- ✓ `IF-3: download http_error`
- ✓ `IF-3: download network`
- ✓ `IF-3: download timeout`
- ✓ `IF-3: download not_pdf`

**AC4 — Unusable report.** Unreadable text, `canHandle` false, or adapter `ok: false` gives `parse_error`. No row, no value, `extract` not called if `canHandle` false.
- ✓ `IF-4a: an unreadable PDF gives parse_error/unreadable_text (real path)`
- ✓ `IF-4b: extractText returning ok:false gives parse_error/unreadable_text (stub)`
- ✓ `IF-4c: canHandle false stops extraction (fake adapter)` — proves `extract` never called
- ✓ `IF-4d: canHandle false with the real brd-depositary adapter`
- ✓ `IF-4e: adapter ok:false gives parse_error/extraction_failed`
- ✓ `IF-4f: registry is used only via get, never detect` — proves no fallback

**AC5 — Incomplete extraction.** When report date known but a tracked field missing: `parse_error` row with date, URL, found values, and error message naming missing keys. Write is atomic. No `ok` row for incomplete.
- ✓ `IF-5a: a missing tracked field writes a parse_error row with the found values`
- ✓ `IF-5b: tracked order determines the message order for multiple missing keys`
- ✓ `IF-5c: every tracked field missing writes a parse_error row with zero values`
- ✓ `IF-5d: no IF-5 saveReport call ever has status ok`
- ✓ `US-014 AC5: an unknown tracked key gives a parse_error row with the found values` (IE-5 edited test)
- ✓ `E2E-3: US-014 AC5 - an incomplete extraction through a real store writes a parse_error row with the found values`
- ✓ `PG-14a: saveReport with status parse_error and two values writes one parse_error row and both values`

**AC6 — Contract violations.** Valid date → `parse_error` row with no values and violation list. Invalid date → no row. Message lists violations only, never extracted text.
- ✓ `IF-6a: violations with a valid date write a parse_error row with no values`
- ✓ `IF-6b: the message never contains extracted text, only rule/fieldKey`
- ✓ `IF-6c: an invalid report date writes no row`
- ✓ `IF-6d: violations win over incompleteness`
- ✓ `PG-14c: a parse_error save with zero values (contract violations) writes the row but no report_values`

**AC7 — Precedence with existing rows.** Existing `ok` never downgraded (outcome `already_ingested`). Existing `parse_error` replaced by later result (complete or partial). SQL-level guard proves the behaviour.
- ✓ `IF-7a: an existing ok row gives already_ingested, saveReport never called`
- ✓ `IF-7b: a race where saveReport reports already_ok gives already_ingested`
- ✓ `IF-7c: an existing parse_error row is replaced by a later complete result`
- ✓ `IF-7d: an existing parse_error row is replaced by a later parse_error result`
- ✓ `PG-14d: an existing ok row survives a later parse_error save attempt with partial values (the SQL guard, not just the caller)` — proves the `status <> 'ok'` guard in SQL
- ✓ `PG-14e: an existing ok row survives a later parse_error save with zero values (the delete must not touch the ok row's values)` — proves values delete respects the guard
- ✓ `PG-14f: an existing parse_error row is replaced by a later parse_error save with new message and values`
- ✓ `SQ-14b: the status <> 'ok' guard also applies to a parse_error write (US-014 AC7)` — two tests: guard presence and parameter value

**AC8 — One outcome, never throws. Only `ok` and `parse_error` rows written.** Closed vocabulary of seven codes, every one triggered and producing correct code/symbol/detail. Never throws; all injected functions throwing (`Error` and non-Error) handled. Only two statuses (`ok`/`parse_error`) written.
- ✓ `OC-8a: the code list is exactly the seven story codes, and IngestOutcome['code'] matches it`
- ✓ `IF-8a: a trigger per code produces exactly that code with a non-empty single-line detail` — 7 triggers, anti-vacuity check
- ✓ `IF-8b: <throw name> (Error) never throws out of ingestEtf` — 8 injected functions × 2 error types = 16 cases
- ✓ `IF-8b: <throw name> (non-Error) never throws out of ingestEtf`
- ✓ `IF-8c: only ok/parse_error statuses are ever sent to saveReport, both occur, and the type is closed`
- ✓ `BD-14a: only store.ts writes a reports status (insert/update into "reports")`
- ✓ `BD-14b: ingest-etf.ts never falls back to registry.detect(` — proves no adapter fallback
- ✓ `IE-4: persist` failure paths (edited) now return `persist_error` outcome
- ✓ `IE-6b-ii: extract throws` now returns `parse_error` outcome (reason `unexpected`)
- ✓ `IE-6c: registry.get throws` now returns `no_adapter` outcome (stage stays pre-discovery)

**AC9 — Build gates pass.** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- ✓ All four commands exit 0 (see table above)

## Flakiness note

First test run: 4 tests timed out (unrelated to US-014 implementation):
- `lib/db/index.test.ts` — `createDb > throws MissingDatabaseUrlError when the URL is undefined, empty or blank`
- `lib/ingestion/default-deps.cron.test.ts` — `createDailyRunDeps wires the shorter cron fetch timeout into discovery`
- `lib/ingestion/default-deps.test.ts` — `createDefaultIngestDeps > wires the Sprint 2 functions...`
- `app/api/cron/daily/route.test.ts` — `AC7: route exports > RT-7a: exports only GET, runtime, dynamic, maxDuration`

All pre-existing, unrelated to US-014 changes (no US-014 test imports any of those files). Retry run: all 556 tests pass.

## Summary

All 9 acceptance criteria covered. All 556 tests pass (including 49 new US-014 tests for IF/OC files and 5 new PG-14 tests for store.pglite.test.ts, plus edited US-012 tests and E2E-3 in ingest-etf.pglite.test.ts). All gates green.
