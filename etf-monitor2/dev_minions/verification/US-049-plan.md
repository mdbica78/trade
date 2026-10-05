# US-049 plan: simplify ingestion, extraction, cron and health

> story-planner, 2026-10-04. Binding text: `backlog/stories/US-049.md`, `verification/CODE-REVIEW-20261004.md`
> ("Rules for every Sprint 12 story" and §A items 1-13), DEC-010, DEC-018, DEC-019, data-model "Write rules".
> No schema change, no migration, no new dependency, no message key change. Data-only refactor: no design reference.

Nothing TECHNICAL is open. The planner-level points PL-1..PL-6 in §5 are resolved here, and the tech-lead can overrule
any of them at the sprint audit. There is no PRODUCT item. **Not blocked.**

## 0. What the code and tests show (this shapes the plan)

1. **A8 conflicts with AC4.** `run-deadline.test.ts` DL-5 ("an inactive ETF after the deadline is silently skipped"),
   `run-daily.test.ts` RD-2a and RD-4 build `DailyEtf` with `isActive: false` and assert that `runDailyIngestion` filters it.
   `load-etfs.ts` says the second filter exists on purpose ("so the tests prove real behaviour"). If `isActive` is dropped,
   a deadline test assertion has to be deleted, and AC4 requires the deadline tests to stay unchanged. **A8 is skipped**
   (PL-1). The story allows this.
2. **A1 changes one call-count assertion.** `ingest-filing.test.ts` MFP-7 (two links in one filing, same new date) asserts
   `saveReportCalls` has length 1. Without the pre-read, the second link calls `saveReport`, which returns `already_ok` and
   writes nothing. The DEC-010 guard is in SQL (`status <> 'ok'` on every statement). The outcome and detail stay the same.
   The count assertion becomes a stored-state assertion (§3). MFP-5 and MFP-6 pass unchanged because `FakeStore.saveReport`
   leaves an `ok` row as it is.
3. **A7 makes `links` required.** About 12 test fixtures build `{ status: "found", pdfUrl, title }` without `links`.
   They exercised the unreachable `[discovery]` fallback. They need `links` and `truncated` added (type-only; §3 gives a
   helper). `lib/config/detect-adapter.ts` and `lib/extraction/report-latest.ts` read `discovery.pdfUrl` and
   `discovery.publishedAt`. So the `found` result **keeps** the top-level spread of `links[0]` (PL-2), and
   `lib/config/detect-adapter.ts` is not touched.
4. **A12: PGlite drizzle has no `db.batch`.** `lib/health.pglite.test.ts` runs `getHealthStatus` on a real PGlite drizzle
   (`test/helpers/pglite-drizzle.ts`). "One batch" is therefore one SQL statement through `db.execute`. That gives one
   request on neon-http and on PGlite (PL-3). The unit-test fakes in `lib/health.test.ts` and
   `app/health/page.failure.test.tsx` HP-F2 mock `select().from()`, so they follow the new call shape. Their expected
   statuses do not change.
5. **A13 scope.** The review item is about fetch messages (`http.ts` puts the URL in them). AC5 tests "a failing fetch".
   Raw non-fetch messages are pinned by behaviour tests that stay: IE-4 `"db exploded"`, IE-6b-ii, IE-6c, RD-3a/b,
   DJ-5a's `run aborted: relation "etfs" does not exist`, and P15's `/health` text. So only the fetch path changes
   (PL-4). `DiscoveryResult.message` and `PdfDownloadResult.message` stay, because `report-latest` CLI stderr uses them
   and `pdf.test.ts`/`http.test.ts` pin them. Only ingestion stops reading them. The `ok` outcome's `sourceUrl` field stays
   in the cron JSON. It is the public report URL, not an error, and it is not named as a change (PL-5).
6. **No adapter test pins an exact error string.** `brd-depositary.test.ts` and `intercapital-nav.test.ts` only check
   that `error` is non-empty, and `validate.test.ts` has no mixed-order case. AC3 needs both pinned **before** the
   refactor (§2, step 1).
7. **`findLatestReportLink` is used by about 12 discovery tests** for newest-link selection. They keep their assertions
   and call a local test helper `latest(html, url) = findLatestFilingLinks(html, url)?.links[0] ?? null` (PL-6).
8. BD-3 (`ingest-etf.test.ts`) bans `new Date(`, `Date.now(` and the word `publishedAt` in non-test `lib/ingestion/*.ts`.
   BD-16 bans literal `etf_report_links` reads outside `lib/monitoring/home.ts`. New code must respect both.

## 1. Acceptance criteria → tests

| AC | Proof |
|---|---|
| AC1 no behaviour change beyond A13 | `pnpm typecheck`, `pnpm lint`, `pnpm build` (offline), full `pnpm test`, `bash scripts/claude/predeploy-check.sh`, with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` unset. HANDOVER lists every `deliberate test change: file, test, reason` from §3, and nothing else is edited. |
| AC2 (A1) no read before a save | New **IR-1** (`lib/ingestion/ingest-reads.test.ts`): a recording store (every method call pushed in order) over a 2-link `filingDeps` filing gives exactly `["findStoredReportUrls","saveReport","saveReport"]`. **IR-2**: the MFP-7 same-date pair gives the same sequence, and the second outcome is `already_ingested`. **IR-3**: `expectTypeOf<keyof ReportStore>().toEqualTypeOf<"saveReport" \| "findStoredReportUrls">()`. |
| AC2 (A12) one DB request per health check | New **HC-7** (`lib/health.test.ts`): a fake `Db` whose `execute` counts calls and whose `select`/`batch` throw if touched. `getHealthStatus` gives the connected status, `execute` is called exactly once, and `select` is never called. Existing HS-1..HS-3 (PGlite) pass unchanged, so the single statement is real SQL. |
| AC2 (A7) discovery parses once | New **DS-P1** (`lib/extraction/discovery.test.ts`): the fake `fetchImpl` returns a response whose `text()` resolves to an object with a counting `toString()` that returns a fixture page. `LIST_CONTAINER_RE.exec` converts it once per parse. After `discoverLatestReport` the count is 1 (today it is 2). The result is `found` with the expected URL. |
| AC3 adapters unchanged | Existing `lib/extraction/fixtures.test.ts` (every committed fixture: values, raw values, report date) and the adapter tests, unchanged. New **AE-1..AE-10** (`lib/extraction/adapters/report-date-errors.test.ts`), written and run green **before** the refactor. They pin each exact error string. BRD: `report date not found (footer phrase missing)`; `report date not found after footer occurrence 1` (footer at end of text); `invalid report date "31.02.2026"`; `invalid report date "2026-09-22"`; `conflicting report dates: 2026-09-22, 2026-09-23`. InterCapital: the same five with `"Data:"` (`report date not found ("Data:" label missing)`, `report date not found after "Data:" occurrence 1`, …). |
| AC3 (A5) violation order | New **VO-1** (`validate.test.ts`), written before the refactor. `values` hold [unknown `x`, `a`, `a`] and `missingFields` hold [unknown `y`, `b`, `x`]. The full violation array `toEqual` is pinned (rule, fieldKey, message, in order): unknown x, unknown y, duplicate a, duplicate x, uncovered c, then numeric/raw violations. |
| AC4 DEC-010/DEC-018 | Unchanged and green: `store.test.ts` (save statements), `store.pglite.test.ts`, `request-bound.test.ts` RB-* (assertions unchanged; §3 only removes the fake's deleted `findReport` method), `run-deadline.test.ts` DL-*, `run-daily.test.ts` RD-4b, `ingest-filing.test.ts` MF-7..MF-9, `deadline.pglite.test.ts`, `test/e2e/daily-pipeline.pglite.test.ts`. A8 skipped, so none of these change. |
| AC5 (A13) no URL or fetch message in log or response | New **FD-1..FD-5** (`lib/cron/fetch-detail.test.ts`): `handleDailyCron` → `runDailyJob` (fake job-run store from `test/helpers/job-run-fakes.ts`) → `runDailyIngestion` → real `ingestEtf` with real `discoverLatestReport`/`downloadReportPdf` over a mocked `fetchImpl`, and `FakeStore`. Cases: discovery rejects `TypeError("fetch failed SENTINEL_FETCH")`; discovery 503; download rejects with the sentinel; download `not_pdf`; download timeout (`timeoutMs` 20). For each case the `finishRun` log and the 200 response body contain no `://`, no `SENTINEL_FETCH`, no `fetch failed`, no `is not a PDF` and no `timed out after`. Each detail equals exactly `discovery network`, `discovery http_error 503`, `stored 0, already stored 0, failed 1, not attempted 0; download network`, and so on. |
| AC6 HANDOVER record | HANDOVER gets one line per finding A1..A13 (`done` or `skipped: <reason>`; A8 skipped, §0.1), and `wc -l` before and after for every source file in §2, taken before the first edit. Documentation check, no test. |

No criterion needs a live resource. Codex QA spot-checks are in the story ("Manual QA").

## 2. Files and steps (order matters: pin first, then refactor)

**Step 0.** `wc -l` every source file below and record the numbers in HANDOVER.
**Step 1.** Add AE-1..AE-10 and VO-1, then run them green against the current code.

| Finding | File(s) | Change |
|---|---|---|
| A1 | `lib/ingestion/store.ts`, `ingest-etf.ts` | Delete `ReportRow`, `buildFindReportStatement`, `ReportStore.findReport` and its Drizzle implementation. `persist` calls `saveReport` directly: `already_ok` gives `already_ingested`, a throw gives `persist_error` with the same detail text as today. |
| A2 | `ingest-etf.ts` | `ingestEtf`: `registry.get` (same try, same `internal_error`), then **one** guarded discovery call. A thrown discover becomes `{ status: "error", kind: "unexpected" }` (local type). Then branch: no adapter → `noAdapterOutcome(base, discovery, deps)` (link upsert unchanged); else `fetch_error` / `missing` / `ingestFiling`. Same order of calls, same outcomes. |
| A3 | `ingest-etf.ts` | Drop `PersistWriteStatus`. In `ingestReport`, one local `save(status, errorMessage, values, written)` builds the `SaveReportInput` once (`etfId`, `reportDate`, `sourceUrl`, `fetchedAt`). `persist(symbol, store, input: SaveReportInput, written: IngestOutcome)` takes the outcome object instead of a callback. |
| A4 | `lib/extraction/adapters/text.ts`, `brd-depositary.ts`, `intercapital-nav.ts` | Add `findUniqueReportDate(text, labelRe, { occurrence, missing })`. It clones `labelRe` (global) and keeps the loop, `tokenAfter`, `parseDottedDate`, and the `invalid report date "…"` / `conflicting report dates: …` texts. Each adapter passes its own `occurrence` (`footer` / `"Data:"`) and `missing` string. Add `toExtractionResult(reportDate, fieldKeys, found)` for the values/missingFields loop. BRD drops `FOOTER_DATE_RE` and uses `parseDottedDate`; `isIsoCalendarDate` is no longer imported there. Adapters stay text-only (adapter boundary test). |
| A5 | `lib/extraction/adapters/validate.ts` | `const keys = [...values.map(fieldKey), ...missingFields]`. One loop over `new Set(keys)` pushes `unknown_field`, a second loop over `new Set(keys)` pushes `duplicate_field` (count > 1). The `reported*` sets go. Order is identical (VO-1). |
| A6 | `lib/ingestion/report-links.ts`, `outcome.ts`, `ingest-etf.ts` | Delete `isStorableReportUrl`, `UpsertReportLinkResult`, the `rejected_url` result and the `NoAdapterLinkOutcome` case. `upsertReportLink` returns `Promise<void>` (`await run([...])`, with no `rowsOf` no-op). |
| A7 | `lib/extraction/discovery.ts`, `ingest-etf.ts`, `filing-outcome.ts` | `found` = `ReportLink & { links: readonly [ReportLink, ...ReportLink[]]; truncated: boolean }` (spread kept, PL-2). Private `latestFiling(entries)` holds today's sort/dedupe/cap. `findLatestFilingLinks(html, url)` = `latestFiling(parseReportList(html, url).entries)` (exported for tests). `discoverLatestReport` parses once and checks `listFound`, then `latestFiling`. `ingestFiling` uses `discovery.links` and `discovery.truncated` directly. Delete the `outcomes.length === 0` branch in `combineFilingOutcomes` (precondition in its doc comment: one outcome per discovered link, at least one). |
| A8 | — | **Skipped** (§0.1, PL-1). |
| A9 | `lib/ingestion/default-deps.ts`, `discovery.ts`, `lib/deploy/migrate.ts`, `lib/smoke/deploy.ts`, `scripts/db-seed.ts`, `ingest-etf.ts` | Delete `createDefaultIngestDeps` and `findLatestReportLink`. `spawnDrizzleMigrate` always spawns `pnpm exec <command> …args` (same argv for `drizzle-kit`). Drop `PageOutcome.headers` (and from `requestPage`). Drop `SMOKE_LOCALES` and loop over `locales`. `seed(getDb())` with no runner argument (the default is the same `neonBatchRunner`). `ingestReport` is no longer exported. |
| A10 | `lib/cron/daily-handler.ts` | `redact` = `JSON.stringify(body, (_k, v) => typeof v === "string" ? redactSecrets(v, secrets) : v)`, imported from `../ingestion/job-run-summary` (same empty-secret skip). |
| A11 | `lib/cron/daily-job.ts` | One `fields: Omit<FinishRunInput, "finishedAt">`, one `etfs`, one `threw` flag. `const input = { finishedAt: deps.now(), ...fields }` stays **after** the try/catch, so `now()` is still called exactly twice. Results are unchanged. |
| A12 | `lib/health.ts` | Replace the two `select`s and the doubly wrapped probe with `buildHealthStatement(db, tables)`, one `db.execute`: `select (select count(*) from ${etfs})::int as "etf_count", (select count(*) from ${fieldCatalog})::int as "field_catalog_count", (select string_agg("t"."name", ',' order by "t"."name") from unnest(string_to_array(${list}::text, ',')) as "t"("name") where to_regclass('public.' \|\| "t"."name") is null) as "missing"`. Parse with `Number(...)`; `missing === null ? [] : split(",")`. Await the builder directly. Timeout race, late-rejection swallow, `logLoadError` and the error text are unchanged. Drop the `count` import. |
| A13 | `lib/ingestion/outcome.ts`, `ingest-etf.ts`, `lib/extraction/discovery.ts` | `formatFetchError(stage, kind, httpStatus)` → `` `${stage} ${kind}${status}` `` (no message parameter). The no-adapter `discovery_error` case reuses it (same output). Discovery and download fetch errors, thrown or returned, no longer read `.message`. `discoverLatestReport` forwards `result.message` without the `${symbol}: ` prefix. |

**Boundaries.** `lib/extraction` stays I/O-free in adapters. `lib/ingestion` alone writes `reports`/`job_runs`/
`etf_report_links` (BD-14/15/16 unchanged). `lib/cron/daily-job.ts` stays pure (BD-15). `daily-handler.ts` gains one
import from `lib/ingestion/job-run-summary`; no boundary test forbids it.

## 3. Deliberate test changes (each goes in HANDOVER as `deliberate test change: file, test, reason`)

- `test/helpers/ingest-fakes.ts`: remove `findReport`, `findReportCalls` and `findReportImpl` (A1). Add
  `foundDiscovery(link)` = `{ status: "found", ...link, links: [link], truncated: false }` (A7). `stubPipelineDeps` uses it.
  `FakeLinkStore` returns `void` (A6).
- Every `expect(store.findReportCalls).toHaveLength(0)` line: `ingest-etf.failures.test.ts` (IF-1a, IF-1b, IF-2a, IF-2b,
  IF-3 loop, IF-4a, IF-4b, IF-4c, IF-4e, IF-6c, IF-7a), `ingest-no-adapter.test.ts` (NA-1, NA-5), `ingest-etf.test.ts`
  (pre-date loop). Reason: the method is deleted (A1); IR-1..IR-3 prove no per-report read.
- `ingest-etf.test.ts`: local `FakeStore` loses `findReport*`. The "US-014 AC5" line `findReportCalls toHaveLength(1)` is
  removed. **IE-6b-iii** is deleted (it rejects `findReport`; IE-4 still covers a rejected `saveReport`). The IE-2 fixture
  gets `links`/`truncated` (A7).
- `ingest-etf.failures.test.ts` IF-8b **"findReport throws"** case deleted (A1). IF-8b found fixtures use `foundDiscovery`
  (A7). IF-3 `detailPrefix` strings become exact expected details without the message (`discovery http_error 503`,
  `discovery network`, `…; download http_error 404`, `…; download network`, `…; download not_pdf`), asserted with
  `toBe` (A13, stronger).
- `ingest-filing.test.ts` MF-4: the two `findReportCalls` lines become
  `expect(store.saveReportCalls.map((c) => c.reportDate)).toEqual(["2026-09-19"])` (same meaning: the URL-skipped
  link never reaches persist). MFP-7: `saveReportCalls toHaveLength(1)` becomes "the 2026-09-22 row is `ok` with
  `sourceUrl` `https://x/a.pdf` and the second save returned `already_ok`" (stored once; the pre-read is gone, A1).
  MF-3: expected detail ends `download http_error 500` (A13).
- `request-bound.test.ts`: `inMemoryStore` loses its `findReport` method. Type-required (A1); no RB assertion changes.
- `store.test.ts`: `describe("buildFindReportStatement")` deleted (A1).
- `default-deps.test.ts`: `describe("createDefaultIngestDeps")` deleted (A9).
- `report-links.test.ts`: `describe("isStorableReportUrl")` and RL-9 deleted. The "storable URL" test drops only
  `expect(result).toBe("written")` and keeps the one-statement assertions (A6).
- `ingest-no-adapter.test.ts`: **NA-6** deleted (A6). Found fixtures use `foundDiscovery` (A7).
- `filing-outcome.test.ts`: the empty-input case (`combineFilingOutcomes("AAA", [], false)`) deleted (A7).
- `outcome.test.ts` `formatFetchError` cases: new signature and message-free expectations (A13).
- `discovery.test.ts`: `findLatestReportLink` import becomes a local `latest()` helper (A9, PL-6). Assertions unchanged.
  DS-P1 is added.
- `discovery.filing.test.ts`: **FL-2** deleted (it compares the two functions; one is gone). FL-4 uses `latest()`, and
  `result.links!` becomes `result.links` (A7/A9).
- `report-latest.test.ts` `FOUND_DISCOVERY` and `lib/config/detect-adapter.test.ts` found fixture: add `links`/`truncated`
  (A7, type-only).
- `ingest-etf.pglite.test.ts` found fixture: `foundDiscovery` (A7).
- `lib/health.test.ts`: fakes return `execute` rows (`[{ etf_count: 3, field_catalog_count: 3, missing: null }]`) or
  reject or never settle through `execute` instead of `select().from()`. Expected statuses are unchanged. **HC-5** is
  deleted (counts and probe are one statement, so HC-1 covers it). HC-7 is added (A12).
- `app/health/page.failure.test.tsx` HP-F2: the never-settling fake is `execute`, not `select().from()` (A12).
- `lib/smoke/deploy.test.ts`: `SMOKE_LOCALES` becomes `locales` from `i18n/locale`. The `headers: new Headers(...)` key is
  dropped from `checkPage` literals (A9; SM-2's redirect verdict never read headers).
- New tests (not changes): IR-1..IR-3, HC-7, DS-P1, AE-1..AE-10, VO-1, FD-1..FD-5.

If any other test fails during the refactor, stop. Either it is one of the above categories (record it), or the change is
wrong (fix the code). An assertion is never loosened.

## 4. Data model
None. No migration. `reports`, `report_values`, `etf_report_links` and `job_runs` statements other than the deleted
`findReport` select are unchanged. The DEC-010 SQL guard is now the only "already ok" check. That is what the data-model
write rule already says ("every write statement is guarded `status <> 'ok'`").

## 5. Risks and planner-level points

- **PL-1 (A8 skipped).** Reason in §0.1. HANDOVER: `skipped: A8, run-deadline DL-5 and run-daily RD-2a/RD-4 pin the
  run-level inactive filter deliberately; AC4 requires deadline tests unchanged`. Option for the tech-lead later: delete
  DL-5 and the inactive cases and drop `isActive`/`parsePgBoolean` (about 12 lines).
- **PL-2 (A7 keeps the `found` spread).** Removing it would touch `lib/config/detect-adapter.ts` (outside the story's
  file list) and the CLI. Making `links` required and non-empty is enough to remove both unreachable branches.
- **PL-3 (A12 one statement, not `db.batch`).** Reason in §0.4. `::int` casts and `Number()` keep `etfCount` a number on
  both drivers. `string_agg` avoids depending on array parsing in the drivers. If the `etfs` table itself is missing, the
  statement fails and the status is `dbConnected: false` with the error, the same as today.
- **PL-4 (A13 = fetch path only).** Reason in §0.5. The broader reading (also removing raw DB, adapter and abort messages)
  would change IE-4, IE-6b-ii, IE-6c, RD-3a/b, DJ-5a, the `/admin/operations` texts and P15. That is not named as an
  allowed change. Recommendation: fetch path only.
- **PL-5.** The `ok` outcome's `sourceUrl` stays in the cron JSON (§0.5). FD-* covers failing-fetch runs only, as AC5 says.
- **PL-6.** `findLatestReportLink` is deleted, and discovery tests use a local helper with identical assertions.
- Risk: `httpStatus` in the discovery `fetch_error` may now be present as `undefined` where it used to be absent (thrown
  discover). `toEqual`, `toMatchObject` and `JSON.stringify` all treat these the same. Keep `httpStatus` out of the
  thrown branch if a test uses `"httpStatus" in`.
- Risk: A1 adds one no-op write batch when a later link of the same filing resolves to an already `ok` date (rare: a
  catch-up row with a duplicate date). It is net fewer requests: one read is removed per downloaded report.
- Risk: the `toString`-counting fake in DS-P1 relies on `RegExp.prototype.exec` converting its argument to a string
  (standard behaviour). If it proves brittle, fall back to a source-scan test: one `parseReportList(` call inside
  `discoverLatestReport`.
- Smallest design: no new module except two helpers in `text.ts` and one private `latestFiling`. No new abstraction.
  Adapters stay one per format.

## 6. Decisions needed

| # | Type | Question | Status |
|---|---|---|---|
| — | — | None open. PL-1..PL-6 are TECHNICAL and resolved in this plan within the review's rules (skip clause, smallest change). The tech-lead may overrule them at the Sprint 12 audit. | Not blocked |

No PRODUCT item. The only behaviour change is A13 (fetch details), which the story names as allowed.
