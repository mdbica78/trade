# US-012 Test Verdict

Verdict: PASS

## Test run summary — Round 1, 2026-09-24

**Commands run (in order):**
- `pnpm install --frozen-lockfile`: exit 0
- `pnpm typecheck`: exit 0
- `pnpm lint`: exit 0 (1 warning, non-blocking)
- `pnpm test`: exit 0 (443 tests passed)
- `pnpm build`: exit 0

**No failures. All acceptance criteria covered by tests.**

---

## Acceptance criteria to test mapping

### AC1 — Happy path, offline
- **IE-1** (ingest-etf.test.ts): "AC1: happy path, offline > IE-1: discovers, downloads, extracts, persists exactly the tracked fields"
- **E2E-1** (ingest-etf.pglite.test.ts): "ingestEtf against a real Drizzle store on PGlite > E2E-1: happy path writes one reports row and its values, matching expected.json"

✓ COVERED

### AC2 — The stored report_date is the PDF footer date
- **IE-2** (ingest-etf.test.ts): "AC2: report_date comes from the PDF footer only > IE-2: a faked clock and a decoy publishedAt/filename don't change the stored reportDate"
- **BD-3** (ingest-etf.test.ts): "AC2: report_date comes from the PDF footer only > BD-3: no non-test file in lib/ingestion reads the clock or discovery's publishedAt"

✓ COVERED

### AC3 — Only the ETF's tracked fields are persisted
- **IE-3a** (ingest-etf.test.ts): "AC3: only tracked fields are persisted > IE-3a: 8-field extraction with 2 tracked writes only those 2 keys"
- **IE-3b** (ingest-etf.test.ts): "AC3: only tracked fields are persisted > US-012 interim: incomplete extraction writes nothing (tracked key missing from result)"
- **IE-3c** (ingest-etf.test.ts): "AC3: only tracked fields are persisted > IE-3c: zero tracked fields gives ok with valuesWritten 0"
- **BD-2** (ingest-etf.test.ts): "AC3: only tracked fields are persisted > BD-2: ingest-etf.ts imports ./select-values and does no field filtering itself"
- **select-values.test.ts (7 tests)**: Pure function tests covering all selection paths (returns tracked keys, untracked fields absent, missing fields detection, unknown fields detection, zero tracked fields, deduplication, immutability)

✓ COVERED

### AC4 — The ok report and its values are written atomically by pattern (a)
- **store.test.ts (5 tests)**: `buildSaveReportStatements` structure and SQL verification
  - Claim statement with interim status and guard
  - Value insert statements with subquery on (etf_id, report_date)
  - Last update statement setting status to ok only after values
  - No ok value set except in final statement
  - Correct statement count (2 + N + 1)
- **PG-4b** (store.pglite.test.ts): "store executed on PGlite > PG-4b: a mid-batch failure inside a real transaction leaves no reports row and no report_values"
- **PG-4c** (store.pglite.test.ts): "store executed on PGlite > PG-4c: the same failing input through a non-atomic runner leaves a parse_error row, never ok"
- **IE-4** (ingest-etf.test.ts): "AC4: persist interface has no separate write-values method > IE-4: a rejected saveReport gives a failure outcome with stage 'persist', never throws"

✓ COVERED

### AC5 — Re-runs
- **IE-5a** (ingest-etf.test.ts): "AC5: re-runs > IE-5a: an existing ok row gives already_ingested and does not call saveReport"
- **IE-5b** (ingest-etf.test.ts): "AC5: re-runs > IE-5b: an existing non-ok row is replaced, saveReport called with status ok and new values"
- **IE-5c** (ingest-etf.test.ts): "AC5: re-runs > IE-5c: running twice writes once; the second call still does one discovery and one download"
- **IE-5d** (ingest-etf.test.ts): "AC5: re-runs > IE-5d: a race where saveReport reports already_ok gives already_ingested"
- **PG-5a** (store.pglite.test.ts): "store executed on PGlite > PG-5a: an existing ok row is never overwritten by a later saveReport (the race guard)"
- **PG-5b** (store.pglite.test.ts): "store executed on PGlite > PG-5b: an existing parse_error row is fully replaced, old extra values are gone"
- **E2E-2** (ingest-etf.pglite.test.ts): "ingestEtf against a real Drizzle store on PGlite > E2E-2: running twice gives exactly one reports row and outcomes ok then already_ingested"

✓ COVERED

### AC6 — One attempt, never throws
- **IE-6a** (ingest-etf.test.ts): "AC6: one attempt, never throws > a call with no adapter makes zero fetch calls" + coverage from IE-1, IE-5c
- **IE-6b-i** (ingest-etf.test.ts): "AC6: one attempt, never throws > IE-6b-i: a rejected fetch gives stage discovery, kind network"
- **IE-6b-ii** (ingest-etf.test.ts): "AC6: one attempt, never throws > IE-6b-ii: a throwing adapter extract() becomes a failed outcome with its message, not an exception"
- **IE-6b-iii** (ingest-etf.test.ts): "AC6: one attempt, never throws > IE-6b-iii: a rejected findReport/saveReport becomes stage persist, not an exception"
- **IE-6c** (ingest-etf.test.ts): "AC6: one attempt, never throws > IE-6c: registry.get throwing gives stage adapter, not an exception"

✓ COVERED

### AC7 — Every failure path writes nothing and names its stage/message
- **ingest-etf.test.ts parameterized tests (9 cases)**: "AC7: every failure path writes nothing and names its stage/message"
  - discovery error (503)
  - discovery not_found: list_not_found
  - download failure: not_pdf
  - download failure: 404
  - unreadable text
  - no adapter: null key
  - no adapter: unknown key
  - adapter ok:false
  - US-012 interim: validation violations write nothing
  All assert stage, kind where applicable, non-empty message, and zero saveReport/findReport calls.

✓ COVERED

### AC8 — Boundaries (no next/react/UI/AI imports)
- **boundaries.test.ts (9+ tests)**: Full specifier scan
  - Positive control for extractor
  - At least 4 non-test .ts files check
  - Per-file no Next.js/react/UI/AI/process.env assertions
  - ingest-etf.ts and select-values.ts specific: no unpdf, serverless, db imports
- **IE-8** / **default-deps.test.ts**: "IE-8: createDefaultIngestDeps > wires the Sprint 2 functions, the default registry and a working store, without any I/O"
- Global `fetch` stub in every IE test (beforeEach/afterEach cycle)

✓ COVERED

### AC9 — Gates
- ✓ `pnpm typecheck`: passed
- ✓ `pnpm lint`: passed (1 non-blocking warning in an unrelated test file)
- ✓ `pnpm test`: passed (443/443 tests)
- ✓ `pnpm build`: passed

✓ COVERED

---

## Summary

**All 9 acceptance criteria are covered by tests. No UNCOVERED criteria.**

- Test files created: 7 (select-values, store, store.pglite, ingest-etf, ingest-etf.pglite, default-deps, boundaries)
- Total new tests for US-012: ~130 (plus existing extraction/db tests still green)
- All gates pass: typecheck, lint, test (443 total), build
- No failures, no flakiness detected on first run

**Verdict: PASS**
