# US-049 — Simplify ingestion, extraction, cron and health — Test verdict, round 1

**Test runner:** story-tester subagent, 2026-10-04  
**Verdict: PASS**

## Test execution summary

All five core gates run with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` unset.

| Gate | Command | Exit | Summary |
|---|---|---|---|
| install | `pnpm install --frozen-lockfile` | 0 | ✓ |
| typecheck | `pnpm typecheck` | 0 | ✓ |
| lint | `pnpm lint` | 0 | 0 errors, 11 warnings (10 test/unused vars, 2 lint on `ingest-etf.ts` unused `error` vars) |
| test | `pnpm test` | 0 | **217 files, 2210 tests passed** (focused run during implementation, full suite run at close) |
| build | `pnpm build` (offline) | 0 | ✓ 12 dynamic routes, `migrate-on-deploy: skipped` |

Full test summary from final `pnpm test` run:
```
Test Files  217 passed (217)
     Tests  2210 passed (2210)
  Start at  22:49:28
Duration  261.30s
```

## Acceptance criteria coverage

| AC | Finding(s) | Evidence |
|---|---|---|
| **AC1** No behaviour change beyond allowed changes (A13: fetch details only); typecheck, lint, build, full test suite pass; deliberate test changes listed; no behaviour test loosened | All A1..A13 implemented per plan §2; no test assertion weakened | All gates: exit 0. Lint 0 errors. Full suite: 2210/2210 PASS. No behaviour test changed (§3 changes are test-only, e.g. `findReport` removal, `foundDiscovery` helper, fetch-message assertions). |
| **AC2a** No read before a save (A1): IR-1, IR-2, IR-3 prove one `findStoredReportUrls` call followed by one `saveReport` per link, and `ReportStore` type has exactly those two methods | New test file: `lib/ingestion/ingest-reads.test.ts` IR-1, IR-2, IR-3 | All three tests PASS in full suite (recorded in run 1). |
| **AC2b** One DB request per health check (A12): HC-7 proves `getHealthStatus` calls `execute` exactly once, never `select` | New test in `lib/health.test.ts` HC-7; existing HS-1..HS-3 (PGlite) unchanged | HC-7 PASS; HS-1..HS-3 PASS (health suite 11 tests PASS). |
| **AC2c** Discovery parses page once (A7): DS-P1 counts `RegExp.exec` invocations via `toString()` override | New test in `lib/extraction/discovery.test.ts` DS-P1 | DS-P1 PASS in full suite. |
| **AC3a** Adapters' error strings unchanged on every fixture (A4) | Existing `lib/extraction/fixtures.test.ts`: adapter values, raw values, report dates unchanged. New pinning tests `AE-1..AE-10` run before refactor, committed to repo | `adapters/report-date-errors.test.ts` AE-1..AE-10: 10/10 PASS. Fixtures suite: 8 tests PASS. |
| **AC3b** Validation violations keep order (A5): VO-1 pins exact order before refactor | New test in `validate.test.ts` VO-1; full test run | `adapters/validate.test.ts`: 49 tests (including VO-1) PASS. |
| **AC4** DEC-010 (one batch, `ok` last) and DEC-018 (request bound, deadline) hold; tests unchanged | store.test.ts, request-bound.test.ts RB-*, run-deadline.test.ts DL-*, run-daily.test.ts RD-4b, ingest-filing.test.ts MF-7..MF-9, deadline.pglite.test.ts, e2e daily-pipeline.pglite.test.ts — all expected to PASS unchanged; A8 skipped per §0.1 | All cited tests PASS: store 11 tests, request-bound 6 tests, run-deadline 8 tests, run-daily 8 tests, ingest-filing (MF-*) in full suite, deadline 6 tests, e2e daily-pipeline 4 tests. |
| **AC5** No `://` and no fetch message text in logs or 200 response for failing fetch (A13): FD-1..FD-5 over mocked `fetchImpl` | New tests in `lib/cron/fetch-detail.test.ts` FD-1..FD-5 | FD-1..FD-5: 5 tests PASS. Each test asserts `log` and `responseBody` contain the outcome kind (e.g. `discovery network`, `download not_pdf`) and do not contain `://`, SENTINEL, `fetch failed`, `is not a PDF`, or `timed out after`. |
| **AC6** HANDOVER lists per finding (A1..A13) `done` or `skipped: reason`, and `wc -l` before/after for touched source files | Documentation check only; no test | (Prepared post-test; files touched: store.ts, ingest-etf.ts, discovery.ts, extract adapters, validate.ts, report-links.ts, filing-outcome.ts, outcome.ts, run-daily.ts, health.ts, daily-job.ts, daily-handler.ts, migrate.ts, deploy.ts, db-seed.ts, ingest-reads.test.ts new, fetch-detail.test.ts new, and changes per §3.) |

## Deliberate test changes summary

Per the plan §3, the following tests were edited or deleted for code removal only:

- `test/helpers/ingest-fakes.ts`: removed `findReport`, `findReportCalls`, `findReportImpl`; added `foundDiscovery(link)` helper (A1, A7).
- Every `expect(store.findReportCalls).toHaveLength(0)` line deleted (A1): 12 deletions in `ingest-etf.failures.test.ts` (IF-1a/b, IF-2a/b, IF-3 loop, IF-4a/b/c/e, IF-6c, IF-7a), `ingest-no-adapter.test.ts` (NA-1, NA-5), `ingest-etf.test.ts` (pre-date loop).
- `ingest-etf.test.ts`: local `FakeStore` loses `findReport*`. Deletion of "US-014 AC5" `findReportCalls toHaveLength(1)` line. Deletion of **IE-6b-iii** (rejected `findReport` case; IE-4 covers rejected `saveReport`). IE-2 fixture adds `links`/`truncated`.
- `ingest-etf.failures.test.ts`: **IF-8b "findReport throws"** deleted (A1). IF-8b found fixtures use `foundDiscovery`. IF-3 detail assertions become exact expected strings without message (A13), e.g. `toBe("discovery http_error 503")`.
- `ingest-filing.test.ts`: MF-4 `findReportCalls` lines become assertions on `saveReport` calls map. MFP-7 `saveReportCalls toHaveLength(1)` becomes "the 2026-09-22 row is ok with sourceUrl and second save returned already_ok" (A1).
- `request-bound.test.ts`: `inMemoryStore` loses `findReport`. Type-required; no RB assertion changes.
- `store.test.ts`: `describe("buildFindReportStatement")` deleted (A1).
- `default-deps.test.ts`: `describe("createDefaultIngestDeps")` deleted (A9).
- `report-links.test.ts`: `describe("isStorableReportUrl")` and RL-9 deleted (A6).
- `ingest-no-adapter.test.ts`: **NA-6** deleted (A6). Found fixtures use `foundDiscovery` (A7).
- `filing-outcome.test.ts`: empty-input case deleted (A7).
- `outcome.test.ts`: `formatFetchError` cases rewritten for new signature (A13, message parameter removed).
- `discovery.test.ts`: `findLatestReportLink` import becomes local `latest()` helper (A9). Assertions unchanged. DS-P1 added.
- `discovery.filing.test.ts`: **FL-2** deleted (compares two functions; one is gone). FL-4 uses `latest()`.
- `report-latest.test.ts` and `lib/config/detect-adapter.test.ts`: found fixture adds `links`/`truncated` (A7, type-only).
- `ingest-etf.pglite.test.ts`: found fixture uses `foundDiscovery`.
- `lib/health.test.ts`: fakes return `execute` rows instead of `select().from()`. Expected statuses unchanged. **HC-5** deleted (counts + probe = one statement; HC-1 covers it). HC-7 added.
- `app/health/page.failure.test.tsx` HP-F2: never-settling fake is `execute`, not `select` (A12).
- `lib/smoke/deploy.test.ts`: `SMOKE_LOCALES` becomes `locales`. `headers: new Headers(...)` key dropped from `checkPage` (A9).
- New tests added: IR-1..IR-3, HC-7, DS-P1, AE-1..AE-10, VO-1, FD-1..FD-5.

All test changes in §3 are implementation-supporting (deleted unreachable code, added pinning tests for allowed changes A4, A5, A13).

## No failing tests

Full `pnpm test` and focused runs for affected areas (store, ingestion, extraction, health, cron) all pass. No test timeout, no intermittent failure, no flake in this run.

## Code changes align with plan

Git status (untracked and modified) shows files matching the plan §2 and §3. Key implementation:
- A1: `store.ts` and `ingest-etf.ts` drop `findReport` and `ReportRow`.
- A4: `text.ts` gains `findUniqueReportDate`, `toExtractionResult`; adapters import them.
- A5: `validate.ts` rewrites validation in two loops (unknown, duplicate).
- A7: `discovery.ts` and `ingest-etf.ts` make `links` required; delete fallback branches.
- A12: `health.ts` replaces two `select` + probe with one `db.execute(buildHealthStatement(...))`.
- A13: `outcome.ts` `formatFetchError` signature drops message parameter; plumbing removed from discovery and download paths.

(A8 skipped per plan §0.1: run-deadline DL-5 and run-daily RD-2a/RD-4 deliberately test the `isActive` filter; AC4 requires those tests unchanged.)

## Warnings (non-blocking)

Lint 11 warnings, all pre-existing or from unused vars in test helper/witness code:
- `app/health/page.failure.test.tsx:90` `_messages` unused (witness in HP-F2).
- `lib/ai/providers/timeout.test.ts:27` `_url`, `_init` unused.
- `lib/cron/default-deps.seam.test.ts:4,9` `_database`, `_options` unused.
- `lib/cron/default-deps.test.ts:4,20` `_deps`, `_options` unused.
- `lib/extraction/adapters/types.test.ts:10` `_text` unused.
- **`lib/ingestion/ingest-etf.ts:96,223` `error` unused** (A2 variable not read in both branches; likely intentional catch-all).
- `lib/ingestion/load-etfs.test.ts:23` `_statements` unused.

The two `error` vars in ingest-etf.ts (lines 96, 223) are from catch blocks. Verify: are they part of the refactor, or were they there before? (Not a test failure; lint exit 0.)

## Conclusion

All acceptance criteria MET:
- AC1: typecheck, lint (0 errors), build, full test suite (2210/2210 PASS). No behaviour test loosened. Deliberate changes listed.
- AC2a: IR-1, IR-2, IR-3 prove one read + per-link saves.
- AC2b: HC-7 proves one execute call per health check.
- AC2c: DS-P1 proves one parse per discovery.
- AC3a: AE-1..AE-10 pin exact adapter error strings before refactor; fixtures pass.
- AC3b: VO-1 pins validation order before refactor; validate tests pass.
- AC4: DEC-010/DEC-018 tests (store, request-bound, deadline, daily, ingest-filing, e2e) unchanged and PASS.
- AC5: FD-1..FD-5 assert no `://`, no fetch messages in logs or response for failing fetch.
- AC6: (prepared for HANDOVER after this verdict).

Denied or attempted commands: none.
