# US-037 test verdict — round 1

Verdict: PASS

**Test run summary:**
- `pnpm install --frozen-lockfile`: exit 0, lockfile up to date (565ms)
- `pnpm typecheck`: exit 0, no errors
- `pnpm lint`: exit 0, 0 errors, 9 pre-existing warnings
- `pnpm test`: exit 0, 186 test files / 1879 tests passed (156.94s)
- `pnpm build`: exit 0, offline build completed, all 12 routes included

All commands run with `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt`, `DATABASE_URL`, `CRON_SECRET`, and `VERCEL_ENV` unset.

## Acceptance criteria coverage

| AC | Result | Evidence |
|---|---|---|
| **AC1** Every report in the filing | MET | `lib/ingestion/ingest-filing.test.ts:33` MF-1 (3 links, each with own report date, newest first, one saveReport call per report); `lib/ingestion/ingest-filing.pglite.test.ts:81` MFP-1 (two report links with BRD fixtures give two ok reports, each with its own file's values) |
| **AC2** Every field (extracted values) | MET | `lib/ingestion/select-values.test.ts:17` SV-1 (every extracted value returned in adapter order); `lib/ingestion/select-values.test.ts:23` SV-2 (zero tracked keys gives every value); `lib/ingestion/select-values.test.ts:28` SV-3 (tracked key missing keeps every found value); `lib/ingestion/select-values.test.ts:42` SV-4 (tracked key unknown, de-duplicated); `lib/ingestion/select-values.test.ts:51` SV-5 (inputs not mutated); `lib/ingestion/ingest-filing.pglite.test.ts:81` MFP-1 verifies every key of expected.json stored (8 BRD keys); `test/e2e/daily-pipeline.pglite.test.ts:315` DP-1 confirms report_values rows equal expected.json keys |
| **AC3** Idempotent by URL, completes on re-run | MET | `lib/ingestion/ingest-filing.test.ts:63` MF-3 (mid-filing download failure saves others, re-run downloads only failed link); `lib/ingestion/ingest-filing.test.ts:109` MF-4 (findStoredReportUrls called once, findReport never for URL-skipped links); `lib/ingestion/ingest-filing.pglite.test.ts:131` MFP-3 (re-run skips URLs with already_ingested, snapshot byte-identical); `lib/ingestion/store.pglite.test.ts:251` FS-P1 (findStoredReportUrls returns only this ETF's ok rows, keyed by source_url); `test/e2e/daily-pipeline.pglite.test.ts:315` DP-2 (rerun makes one request per ETF, no writes, already_ingested codes) |
| **AC4** Never downgraded, duplicate harmless | MET | Existing `lib/ingestion/ingest-etf.test.ts` IE-5a, IF-7a/b pass; `lib/ingestion/store.pglite.test.ts` guard tests stay green; PGlite-tested `ingestEtf` never writes over `ok` status (DEC-010 rule enforced by code review) |
| **AC5** Deadline guard per download | MET | `lib/ingestion/ingest-filing.test.ts:142` MF-7 (link 2 download crosses deadline, links 3-4 not_attempted, no download call); `lib/ingestion/ingest-filing.test.ts:195` MF-8 (failure wins over deadline cut, priority D-2); `lib/ingestion/ingest-filing.test.ts:211` MF-9 (first PDF never guarded, even when canStartDownload always false); `lib/ingestion/default-deps.guard.pglite.test.ts:65` DD-G1 (createDailyRunDeps wires canStartDownload into ingestEtf: ≤1 download with always-false guard, 2 with always-true) |
| **AC6** Display unchanged by storage | MET | `lib/ingestion/ingest-filing.pglite.test.ts:165` DV-1 (two tracked fields: createHomeTableLoader returns exactly tracked-union keys, createEtfHistoryLoader returns exactly tracked keys, all rows' cells/values match tracked keys); existing `test/e2e/daily-pipeline.pglite.test.ts:315` DP-1 `home.columns` assertion stays unchanged while 8 fields stored |
| **AC7** Budget constants | MET | Constants defined in `lib/extraction/discovery.ts:13` MAX_REPORTS_PER_FILING=4, `lib/ingestion/run-daily.ts:9` MIN_REQUESTS_PER_ETF=2, `lib/ingestion/run-daily.ts:16` MAX_REQUESTS_PER_ETF=1+MAX_REPORTS_PER_FILING (5); `app/api/cron/daily/route.test.ts:33` RT-7b (extended, asserts one ETF's worst case fits in CRON_MAX_DURATION_S, maxFitting computed, failure case tested); `lib/ingestion/run-deadline.test.ts:160` DL-7 (arithmetic uses named constants only, no literals); existing guard constants sanity test passes |
| **AC8** Request bound and truncation | MET | `lib/extraction/discovery.filing.test.ts:26` FL-1 (BTBETRETF/TVBETETF/PTENGETF three-link row gives three links newest first); `lib/extraction/discovery.filing.test.ts:43` FL-2 (all BRD + ICBETNETF fixtures: links[0] equals single link); `lib/extraction/discovery.filing.test.ts:54` FL-3 (6 links caps to MAX_REPORTS_PER_FILING with truncated=true); `lib/extraction/discovery.filing.test.ts:68` FL-3b (duplicate href de-duplicated); `lib/extraction/discovery.filing.test.ts:79` FL-3c (no row gives null); `lib/extraction/discovery.filing.test.ts:84` FL-4 (discoverLatestReport found carries links/truncated, pdfUrl/title/publishedAt match links[0]); `lib/ingestion/request-bound.test.ts:230` RB-1 (BRD single-link fixture makes MIN_REQUESTS_PER_ETF calls); `lib/ingestion/request-bound.test.ts:252` RB-2 (ICBETNETF single-link makes MIN_REQUESTS_PER_ETF); `lib/ingestion/request-bound.test.ts:274` RB-3 (failure paths ≤MIN_REQUESTS_PER_ETF); `lib/ingestion/request-bound.test.ts:326` RB-4 (add-time detection ≤MAX_REQUESTS_PER_ETF); `lib/ingestion/request-bound.test.ts:368` RB-6 (6-link row makes exactly MAX_REQUESTS_PER_ETF calls, page + 4 newest, oldest 2 skipped); `lib/ingestion/request-bound.test.ts:402` DT-M1 (detectAdapter ≤MIN_REQUESTS_PER_ETF, downloads newest link only); `lib/ingestion/request-bound.test.ts:426` NA-M1 (no-adapter 1 request, upserts newest link's URL only) |
| **AC9** Docs | MET | `test/data-model-doc.test.ts:10` DM-1 asserts data-model.md contains MAX_REPORTS_PER_FILING, "no batch mixes two reports", "findStoredReportUrls", "skipped with no request", "Every field the adapter extracts is stored", "not what is stored" |
| **AC10** Offline and gates | MET | All new tests stub global `fetch` to throw (`lib/ingestion/ingest-filing.test.ts:18`); SQL runs on PGlite only; no `package.json` or `pnpm-lock.yaml` changes; no `drizzle/` migration added; boundary tests `lib/ingestion/boundaries.test.ts` BD-3 stays green (forbids `new Date(`, `Date.now(`, `publishedAt` in non-test ingestion files — new code is compliant); `pnpm typecheck`, `pnpm lint` (0 errors), `pnpm test` (1879/1879), `pnpm build` all pass with three env vars unset |

## Summary of new test files and key test IDs

**New test files (with test IDs cited above):**
- `lib/extraction/discovery.filing.test.ts`: FL-1, FL-2, FL-3, FL-3b, FL-3c, FL-4
- `lib/ingestion/filing-outcome.test.ts`: FO-1..FO-8 (priority, counting, truncated, detail formatting)
- `lib/ingestion/ingest-filing.test.ts`: MF-1, MF-3, MF-4, MF-6, MF-7, MF-8, MF-9
- `lib/ingestion/ingest-filing.pglite.test.ts`: MFP-1, MFP-3, DV-1
- `lib/ingestion/default-deps.guard.pglite.test.ts`: DD-G1
- `test/helpers/filing-page.ts`: helper functions (withNewestRowHrefs, withoutRowsBefore, rowHrefs)
- `test/data-model-doc.test.ts`: DM-1

**Existing tests updated (unchanged expectations stay green):**
- `lib/ingestion/select-values.test.ts`: SV-1..SV-5 rewritten (every value vs tracked only)
- `lib/ingestion/ingest-etf.test.ts`: IE-1, IE-3a, IE-3c, IE-5a, IE-5c, IE-5d updated (values 2→8, detail format with counts)
- `lib/ingestion/ingest-etf.failures.test.ts`: download-stage rows get count prefix; unreadable-text, format-not-recognised, extraction-failed, IF-5a, IF-6c, IF-7a updated
- `lib/ingestion/ingest-etf.pglite.test.ts`: E2E-1, E2E-2 updated (report_values 2→8)
- `lib/ingestion/ingest-icbetnetf.pglite.test.ts`: IC-E2E-1 updated (2 value rows→8)
- `lib/ingestion/request-bound.test.ts`: RB-1..RB-4 bound changed to MIN_REQUESTS_PER_ETF; RB-6 added (multi-link filing)
- `app/api/cron/daily/route.test.ts`: RT-7b extended (constants checks); RT-7d unchanged
- `app/chat/page.test.tsx` CPG-4b, `app/admin/etfs/page.test.tsx` PG-7b: budget recalculated with MIN_REQUESTS_PER_ETF
- `test/e2e/fixture-web.ts`: dayBMap() serves new day-B URL, page's newest-row href rewritten (§0.2 deliberate change)
- `test/e2e/daily-pipeline.pglite.test.ts`: DP-0 self-check, DP-1 log/values updated, DP-2 guard2.calls 9→5
- `lib/ingestion/default-deps.cron.test.ts`: deps.ingest second argument wired with canStartDownload type check
- `lib/ingestion/run-deadline.test.ts`: DL-1..DL-7 unchanged, guard constants pass

**New runtime files (implementation):**
- `lib/extraction/discovery.ts`: MAX_REPORTS_PER_FILING export, findLatestFilingLinks, DiscoveryResult.found extended
- `lib/ingestion/filing-outcome.ts`: combineFilingOutcomes aggregator
- `lib/ingestion/store.ts`: findStoredReportUrls method
- `lib/ingestion/run-daily.ts`: MIN_REQUESTS_PER_ETF, MAX_REQUESTS_PER_ETF exports, canStartEtf, canStartDownload guards
- `lib/ingestion/ingest-etf.ts`: multi-link loop, URL skip, deadline guard per download

## Test counts

From `pnpm test` summary line:
- Test Files: 186 passed (186)
- Tests: 1879 passed (1879)
- Duration: 156.94s

Denied or attempted commands: none

## Round 2 — 2026-09-29

Verdict: PASS

**Test run summary:**
- `pnpm install --frozen-lockfile`: exit 0, lockfile up to date (605ms)
- `pnpm typecheck`: exit 0, no errors
- `pnpm lint`: exit 0, 0 errors, 9 pre-existing warnings
- `pnpm test`: exit 0, 186 test files / 1882 tests passed (189.14s)
- `pnpm build`: exit 0, offline build completed, all 12 routes included

All commands run with `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt`, `DATABASE_URL`, `CRON_SECRET`, and `VERCEL_ENV` unset.

## Acceptance criteria coverage (round 2 re-verification)

All acceptance criteria verified to still be met by the same tests cited in round 1:

| AC | Result | Evidence |
|---|---|---|
| **AC1** Every report in the filing | MET | `lib/ingestion/ingest-filing.test.ts:33` MF-1; `lib/ingestion/ingest-filing.pglite.test.ts:81` MFP-1 |
| **AC2** Every field (extracted values) | MET | `lib/ingestion/select-values.test.ts:17..51` SV-1..SV-5; `lib/ingestion/ingest-filing.pglite.test.ts:81` MFP-1; `test/e2e/daily-pipeline.pglite.test.ts:315` DP-1 |
| **AC3** Idempotent by URL, completes on re-run | MET | `lib/ingestion/ingest-filing.test.ts:63` MF-3; `lib/ingestion/ingest-filing.test.ts:109` MF-4; `lib/ingestion/ingest-filing.pglite.test.ts:131` MFP-3; `lib/ingestion/store.pglite.test.ts:251` FS-P1; `test/e2e/daily-pipeline.pglite.test.ts:315` DP-2 |
| **AC4** Never downgraded, duplicate harmless | MET | `lib/ingestion/ingest-etf.test.ts` IE-5a; `lib/ingestion/ingest-etf.failures.test.ts` IF-7a/b; `lib/ingestion/store.pglite.test.ts` guard tests green |
| **AC5** Deadline guard per download | MET | `lib/ingestion/ingest-filing.test.ts:201` MF-7; `lib/ingestion/ingest-filing.test.ts:254` MF-8; `lib/ingestion/ingest-filing.test.ts:270` MF-9; `lib/ingestion/default-deps.guard.pglite.test.ts:65` DD-G1 |
| **AC6** Display unchanged by storage | MET | `lib/ingestion/ingest-filing.pglite.test.ts:165` DV-1; `test/e2e/daily-pipeline.pglite.test.ts:315` DP-1 |
| **AC7** Budget constants | MET | `lib/extraction/discovery.ts:13` MAX_REPORTS_PER_FILING=4; `lib/ingestion/run-daily.ts:9` MIN_REQUESTS_PER_ETF=2; `lib/ingestion/run-daily.ts:16` MAX_REQUESTS_PER_ETF=5; `app/api/cron/daily/route.test.ts:33` RT-7b; `lib/ingestion/run-deadline.test.ts:160` DL-7 |
| **AC8** Request bound and truncation | MET | `lib/extraction/discovery.filing.test.ts:27` FL-1; `lib/extraction/discovery.filing.test.ts:44` FL-2; `lib/extraction/discovery.filing.test.ts:54` FL-3; `lib/extraction/discovery.filing.test.ts:68` FL-3b; `lib/extraction/discovery.filing.test.ts:79` FL-3c; `lib/extraction/discovery.filing.test.ts:84` FL-4; `lib/ingestion/request-bound.test.ts:230` RB-1; `lib/ingestion/request-bound.test.ts:252` RB-2; `lib/ingestion/request-bound.test.ts:274` RB-3; `lib/ingestion/request-bound.test.ts:326` RB-4; `lib/ingestion/request-bound.test.ts:368` RB-6; `lib/ingestion/request-bound.test.ts:402` DT-M1; `lib/ingestion/request-bound.test.ts:426` NA-M1 |
| **AC9** Docs | MET | `test/data-model-doc.test.ts:10` DM-1 |
| **AC10** Offline and gates | MET | All new tests stub global fetch; SQL on PGlite only; no package.json/pnpm-lock.yaml/drizzle/ changes; boundary tests green; gates pass with env vars unset |

## Test counts (round 2)

From `pnpm test` summary line:
- Test Files: 186 passed (186)
- Tests: 1882 passed (1882) — 3 additional tests from round 1 (1879 → 1882)
- Duration: 189.14s

Note: Test count increased by 3 tests (1879 to 1882) since round 1. All three additional tests pass. This is likely from implementation refinements or additional test cases added to verify acceptance criteria more thoroughly. No failures recorded.

Denied or attempted commands: none
