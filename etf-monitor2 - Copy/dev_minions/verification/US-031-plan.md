# US-031 plan — End-to-end verification on the real deployment
_Planner: story-planner (opus), 2026-09-28. Round 0._

Sources read: `backlog/stories/US-031.md` (incl. its tech-lead review, points 1–5 binding),
`backlog/sprints/sprint-07.md` (decisions 11, 12, DoD, manual QA), DEC-018 §5 (request budget),
`architecture/data-model.md` ("Write rules"), `verification/US-030-plan.md` (format and the
seams it added), and the code in `app/api/cron/daily/`, `lib/cron/`, `lib/ingestion/`
(`default-deps`, `run-daily`, `ingest-etf`, `load-etfs`, `job-run-summary`, `outcome`),
`lib/extraction/` (`discovery`, `pdf`, `http`), `lib/monitoring/{home,history}.ts`,
`lib/admin/{operations,run-log}.ts`, `lib/db/{index,seed,seed-data}.ts`, `lib/health.ts`,
`app/health/`, `components/FieldChart*`, `app/layout.tsx`, `i18n/`, `messages/*.json`,
`test/helpers/pglite.ts`, `test/fixtures/` (+ `bvb/README.md`, `expected.json`), `scripts/`,
`package.json`, `vitest.config.ts`, README.

US-029 shipped the **ADAPTER** branch (`intercapital-nav`, `ICBETNETF-2026-09-24.pdf`), and
US-029 and US-030 are both Awaiting QA, so this story is eligible (tech-lead point 5).

No open TECHNICAL decision. The one PRODUCT item (#12) ships its isolated default. So this plan is
**not** blocked.

---

## 1. Acceptance criteria → proving tests

Every new test file that is not the smoke module stubs global `fetch` to a guard (the pipeline test)
or to a thrower ("real network forbidden"). Test ids are new unless marked "changed".

### AC1 — The whole pipeline, offline (`test/e2e/daily-pipeline.pglite.test.ts`, new)

**What is real and what is replaced.** The test calls the shipped `handleDailyCron` with the
shipped `createDailyCronDeps(...)` (section 2.1). From there, everything is production code:
`readEnv` (reads the stubbed env), `runDailyJob`, the Drizzle job-run store, `runDailyIngestion`
with the deadline guard, `createDrizzleEtfLoader`, `ingestEtf`, `discoverLatestReport`,
`downloadReportPdf`, `extractPdfText` (`unpdf` 0.11.0), `defaultAdapterRegistry` (both adapters),
`selectValuesToPersist`, the Drizzle report store and the report-link store. Replaced, and only
these:
1. **The database runner.** The `database` option carries `{ db: mockDb, run: runner }` from
   `createEmptyTestDatabase()` (every journal migration). The PGlite runner stands in for
   `neonBatchRunner`, as in every PGlite test.
2. **Global `fetch`.** `vi.stubGlobal("fetch", guard.fetch)`, from the fixture-web helper
   (section 2.2).

The environment is also controlled, but no production module is swapped for it:
- `CRON_SECRET` and `DATABASE_URL` are stubbed to sentinels (`vi.stubEnv`), so `readEnv` and the
  redaction see them (tech-lead point 1).
- `lib/db/index` is wrapped with `vi.mock(…, importOriginal)`, so that `getDb` becomes a spy that
  throws. The test asserts it has 0 calls (tech-lead point 1).
- The clock: `vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime(...)`. Only `Date` is
  faked. Timers stay real, so `fetchOnce`'s timeout still works. Risk R2 gives the reason and the
  fallback.

**Database setup (per test, no shared state between `it`s).** `createEmptyTestDatabase()`, then the
shipped `seed(db.mockDb, db.runner)`, which gives 3 BRD ETFs tracking `units_in_circulation` and
`nav_per_unit`, plus the full catalogue. Then two setup inserts in SQL:
- `ICBETNETF`: `adapter_key 'intercapital-nav'`, `bvb_url …?s=ICBETNETF`, tracking `nav_per_unit`
  (order 0) and `units_in_circulation` (order 1). These are the US-029 D1 shared keys.
- `NOADAPTER`: `adapter_key NULL`, `bvb_url …?s=NOADAPTER`, and no tracked fields.

The load order is by symbol, which gives **BTBETRETF, ICBETNETF, NOADAPTER, PTENGETF, TVBETETF**.

**URL → fixture map, "day A"** (used in run 1):
| URL | Served |
|---|---|
| `…FinancialInstrumentsDetails.aspx?s=BTBETRETF` / `TVBETETF` / `PTENGETF` | `test/fixtures/bvb/<SYM>-instrument-2026-09-23.html` |
| the three newest hrefs in `test/fixtures/bvb/README.md` §7 (`…_22-09-2026.pdf`) | `test/fixtures/<SYM>-2026-09-21.pdf` |
| `…?s=ICBETNETF` | `bvb/ICBETNETF-instrument-2026-09-27.html` |
| `…/ICBETNETF_20260925110032_2026-09-24-BET-ETF-Official-NAV.pdf` (README §8) | `ICBETNETF-2026-09-24.pdf` |
| `…?s=NOADAPTER` | derived: the BTBETRETF page with every `BTBETRETF` replaced by `NOADAPTER` |

Serving the 21 September PDF behind a URL whose filename says 22-09 and whose filing stamp says
23.09 is deliberate (story Notes). A stored `report_date` of `2026-09-21` can then only have come
from the PDF's own text. It rules out both the filing stamp and the URL.

**Tests:**
- `DP-0` fixture self-checks, with no production parser used:
  - every mapped file exists;
  - the NOADAPTER page contains no `BTBETRETF`, and its newest href is the expected
    `https://bvb.ro/infocont/infocont26/NOADAPTER_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf`;
  - the "no rows" page (AC2) still contains `id="gv5News"` and has no `<tr>` inside that table.
- `DP-1` (one run, clock `2026-09-23T10:05:00Z`). `GET /api/cron/daily` with
  `Authorization: Bearer <sentinel>`:
  - **Response.** 200. The JSON has `status: "partial"`, and `etfs` in load order with codes
    `ok, ok, no_adapter, ok, ok`. The BRD ETFs have `reportDate` `2026-09-21` and ICBETNETF has
    `2026-09-24`.
  - **`job_runs`.** Exactly 1 row: `status 'partial'`, `etfs_processed 5`, `errors_count 1`,
    `finished_at` not null. `log` **equals** these six lines:
    `partial: 5 processed, 1 errors` / `BTBETRETF ok 2026-09-21 stored 2 values` /
    `ICBETNETF ok 2026-09-24 stored 2 values` /
    `NOADAPTER no_adapter no adapter: adapter_key not set; report link stored` /
    `PTENGETF ok 2026-09-21 stored 2 values` / `TVBETETF ok 2026-09-21 stored 2 values`.
  - **`reports`.** One `ok` row per BRD ETF, with `report_date::text = '2026-09-21'` (not
    `2026-09-23`, the filing stamp, and not `2026-09-22`, the URL filename), `source_url` = the §7
    href, `error_message` null. One `ok` ICBETNETF row with `2026-09-24`. No row for NOADAPTER.
  - **`report_values`.** For each report, exactly the tracked keys. `raw_value` and
    `numeric_value::text` are **read from `test/fixtures/expected.json`**: the entry whose `file`
    was served. They are never compared with adapter output. If Postgres renders a `numeric` with
    a different scale, the comparison becomes `numeric_value = $expected::numeric` in SQL, never
    a float.
  - **`etf_report_links`.** One row, for NOADAPTER: `source_url` = the derived href,
    `discovered_at` = the frozen clock. No row for the other four.
  - **Fetch guard.** The recorded `(method, url)` list **equals** the expected 9-call sequence:
    `GET` page + PDF for BTBETRETF, the same for ICBETNETF, the NOADAPTER page only, then page +
    PDF for PTENGETF and for TVBETETF. The unknown-URL branch was hit 0 times. For each ETF, the
    number of calls is ≤ `MAX_REQUESTS_PER_ETF` (DEC-018 §5), and NOADAPTER has exactly 1.
  - `getDb` spy: 0 calls.
  - **Home loader** (`createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner)`):
    - The columns are exactly `nav_per_unit` and `units_in_circulation`, with the catalogue labels.
    - The BRD rows have `valueDate '2026-09-21'`, cells whose value equals `expected.json`'s
      `numericValue` with `delta` null, `latestPdfUrl` = the §7 href, and
      `adapterAvailable: true`.
    - The ICBETNETF row shows `2026-09-24`, its values and its PDF link.
    - The NOADAPTER row has `adapterAvailable: false`, `valueDate` null, every cell
      `{ tracked: false }`, and `latestPdfUrl` = the stored link.
  - **History loader** (`createEtfHistoryLoader(db.mockDb, db.runner)`): every ETF with a report
    has exactly 1 row with its date and values. NOADAPTER has `rows: []` and
    `etf.adapterAvailable: false`.
  - **Operations loader** (`createOperationsLoader(db.mockDb, defaultAdapterRegistry, db.runner)`):
    - `runs` has length 1, `status partial`, `etfsProcessed 5`, `errorsCount 1`.
    - `log.entries` has 5 `etf` entries with those codes.
    - `etfs`: NOADAPTER has `adapterAvailable: false` and `lastOk: null`. The others have
      `lastOk.reportDate` as above.
    - `parseErrors` is empty.
  - **Secrets.** Neither sentinel appears in the response text, in `job_runs.log`, or in any
    loader output (a JSON-stringified scan).
- `DP-3` bad bearer. Same setup, `Authorization: Bearer wrong`: the response is 401, the body has
  no sentinel, `job_runs` has 0 rows, and the fetch guard has 0 calls. This proves that the auth
  path and `readEnv` are the real ones.

### AC2 — Re-run and a missing day (same file)
- `DP-2`, one self-contained test with three runs:
  1. **Run 1**, at `2026-09-23T10:05Z` with map day A, as in DP-1. Snapshot every `reports` and
     `report_values` row (`select *` ordered by id).
  2. **Run 2**, at `2026-09-23T10:20Z` with map day A:
     - codes `already_ingested ×4` (BTBETRETF, ICBETNETF, PTENGETF, TVBETETF) and `no_adapter`;
       status `partial`, 1 error;
     - the `reports` and `report_values` snapshots are `toEqual` to run 1's (counts and every
       column, `fetched_at` included). No `ok` row changed (DEC-010);
     - the fetch sequence is the same 9 calls (`already_ingested` is decided after the download,
       `ingest-etf.ts` `persist`).
  3. **Run 3**, at `2026-09-24T10:05Z` with map **day B**. Day B is day A with two changes: the
     BRD PDF hrefs serve `<SYM>-2026-09-22.pdf`, and the PTENGETF page is the derived "no rows"
     page (the `gv5News` table body emptied).
     - Codes: BTBETRETF `ok` 2026-09-22, ICBETNETF `already_ingested`, NOADAPTER `no_adapter`,
       PTENGETF `missing` with reason `no_report_entries`, TVBETETF `ok` 2026-09-22. Status
       `partial`, 2 errors. The log line is `PTENGETF missing no report found: no_report_entries`.
     - PTENGETF still has exactly 1 `reports` row (2026-09-21). There is no 2026-09-22 row of any
       status. Every row from the run-1 snapshot is unchanged.
     - The fetch sequence is 8 calls: the PTENGETF page only, no PDF. The unknown-URL branch was
       hit 0 times.
     - **Home loader.** PTENGETF shows `valueDate '2026-09-21'` and the 21 September
       `expected.json` values with `delta` null. BTBETRETF and TVBETETF show `2026-09-22` with
       the 22 September values and a non-null `delta` (previous day 2026-09-21 is `ok`). This
       proves the missing ETF did not stop the others.
     - `job_runs` has 3 rows, all finished.
     - No sentinel appears in any of the three responses or logs.

### AC3 — Deployment smoke script (`lib/smoke/deploy.test.ts`, new)
All tests inject a recording `fetchImpl`, and global `fetch` is stubbed to throw.
| Id | Rule proven |
|---|---|
| SM-1 | Every request is `method: "GET"` with no body and `redirect: "manual"`. Its URL's origin equals the base origin. The page list × `["ro","en"]` gives exactly 20 requests, in list order. |
| SM-2 | A 302 whose `Location` is another origin gives a FAIL line `redirect`, and `fetchImpl` is called once for that page (not followed). A same-origin 307 is also a FAIL `redirect` (tech-lead point 3). |
| SM-3 | `SMOKE_PAGES` has no path containing `/api/`, and every path starts with `/`. The request headers are exactly `accept`, `cookie`, `user-agent`. There is no `authorization` and no `next-action`. `cookie` is exactly `NEXT_LOCALE=<locale>`, built from `LOCALE_COOKIE`. |
| SM-4 | A page passes only on 200 + `<html lang>` equal to the requested locale + none of its failure texts in the markup. Each of these fails independently: a missing `lang`, `lang="en"` on a `ro` request, and the page's `loadError` text inside a `<p role="alert">`. |
| SM-5 | **The failure texts come from `messages/<locale>.json`.** Every key in `SMOKE_PAGES` resolves, in both catalogues, to a non-empty string with no `{` (no ICU argument). The test builds its failing bodies from `en.Home.loadError` and `ro.Home.loadError`, never from a literal. If a key is renamed, this test fails. |
| SM-6 | **Failure text only inside `<script>` does not fail.** The root layout passes every message to `NextIntlClientProvider`, so the RSC payload in `<script>` holds every `loadError` text on every page (risk R1). A body with the text only inside `<script>…</script>` gives PASS. The same text in the markup gives FAIL. |
| SM-7 | A text containing `'`, `"` or `&` is matched in both raw and React-escaped form (`&#x27;`, `&quot;`, `&amp;`). This is a unit test of the matcher with synthetic strings. |
| SM-8 | A 500 gives a FAIL line and exit code 1. A network rejection gives FAIL `network`. A `fetchImpl` that never settles gives FAIL `timeout` after exactly `SMOKE_REQUEST_TIMEOUT_MS` (fake timers: not yet failed at −1 ms, failed at the constant), and the run moves on to the next page. When every page passes, the exit code is 0. |
| SM-9 | A body holding a sentinel string, in the markup, in `lang`, in a 500 body and in a `Location` header, never appears in any output line. Reasons come from a closed vocabulary (`http-status`, `redirect`, `timeout`, `network`, `wrong-lang`, `error-text:<key>`), and notes are key names only. |
| SM-10 | **Unconfigured `/chat` is not a failure.** A `/chat` body showing `Chat.replies.unavailableNoApiKey`'s text gives `PASS … note=Chat.replies.unavailableNoApiKey`, exit 0. A `/chat` body showing `Chat.loadError` gives FAIL. |
| SM-11 | Base URL rule. Accepted: `https://etf-monitor2.vercel.app` and `…/`, `http://localhost:3000`, `http://127.0.0.1:3000`. Rejected, with exit 2, one usage line and 0 requests: `http://example.com`, `http://localhost.evil.com`, `ftp://…`, `https://u:p@host` (credentials), a non-root path, a query or hash, no argument, two arguments, and garbage. The rejection line never echoes the argument. |
| SM-12 | Source scan of `lib/smoke/deploy.ts` and `scripts/smoke-deploy.ts`: no `process.env`, and no import of `lib/db`, `lib/cron`, `lib/ingestion`, `next` or `@neondatabase/serverless` (`test/helpers/module-specifiers.ts`). The CLI imports only `../lib/smoke/deploy`. |
| SM-13 | Output shape: exactly one line per page × locale (20), each matching `^(PASS|FAIL) (ro|en) /\S* (\d{3}|-)( \S+)?$`, then one summary line `SUMMARY <passed>/<total> passed`. |
| SM-14 | `package.json` `scripts["smoke:deploy"] === "tsx scripts/smoke-deploy.ts"`. `README.md` contains `pnpm smoke:deploy` (AC6). |

### AC4 — `/health` survives the likely failures
- **`lib/health.test.ts`.** Three existing tests are unchanged (the success path, and the two
  rejection shapes). New tests:
  - `HC-1` A `from()` that never settles (fake timers): the result is still pending at
    `HEALTH_QUERY_TIMEOUT_MS - 1`, and resolves to `{ dbConnected: false, timedOut: true }` at
    `HEALTH_QUERY_TIMEOUT_MS`. No real wait.
  - `HC-2` On the success path the timer is cleared (`vi.getTimerCount() === 0` after the result).
  - `HC-3` A query that rejects **after** the timeout causes no unhandled rejection
    (`process.on("unhandledRejection")` spy has 0 calls, after `vi.runAllTimersAsync()`). This
    shows the timed-out query is not awaited and is not left dangling with an unhandled rejection
    (tech-lead point 4).
  - `HC-4` `HEALTH_QUERY_TIMEOUT_MS` is ≥ 5 000 and ≤ 10 000 (rationale in section 4).
- **`app/health/page.failure.test.tsx`** (new). It renders the **real** `app/health/page.tsx`,
  with the real `loadHealthStatus` and the real `getHealthStatus`. Only `@/lib/db` `getDb` is
  mocked (`importOriginal`, so `MissingDatabaseUrlError` stays real), plus the same
  `next-intl/server` catalogue stub as `page.test.tsx`, which is environment, not the unit.
  - `HP-F1` (`ro` and `en`). `getDb` throws `new MissingDatabaseUrlError()`. `HealthPage()`
    resolves, without throwing. The HTML contains `Health.dbUnreachable` and the substring
    `DATABASE_URL is not set`, which is decision 12's default: the message is shown, as in US-006
    AC2. It contains neither `Health.dbConnected` nor `postgresql://`. If the `catch` in
    `loadHealthStatus` is removed, this test fails (Sprint 1 audit W4).
  - `HP-F2` (`ro` and `en`). `getDb` returns a fake whose `select().from()` never settles. With
    fake timers, advance by `HEALTH_QUERY_TIMEOUT_MS`. The HTML contains `Health.dbUnreachable`
    and `Health.dbTimeout` (the new fixed, translated text). It contains no `dbConnected` and no
    `Error:` prefix.
- `app/health/page.test.tsx` is **unchanged**: the success-path rendering and the existing failure
  rendering.

### AC5 — Chart tooltip wiring (`components/FieldChart.test.tsx`, additions only)
The existing `recharts` mock already captures `Tooltip`'s props.
- `FC-TT1` `ro`: render `FieldChart` with labels `{ series: "VUAN", date: "Dată" }` and take
  `captured.tooltip.content`. Assert it is a function, call it with
  `{ active: true, payload: [{ payload: { date: "2026-09-21", value: 54.1373, display: "54.1373" } }] }`,
  and render the result. The HTML contains `Dată: 21.09.2026` and `VUAN: 54,1373`.
- `FC-TT2` `en`: the same call gives `Date: 2026-09-21` and `NAV per unit: 54.1373`.
- `FC-TT3` The value comes from the stored string, not the float: with `value: 54.137299999` and
  `display: "54.1373"`, the output is still `54,1373` (ro).
- `FC-TT4` `{ active: false, payload: [...] }`, `{ active: true, payload: [] }` and
  `{ active: true }` each render `""`.

### AC6 — Runbook and README
- README gains a "Deployment smoke check" section, covering what the command requests, what it
  never does, its exit codes 0/1/2, and the WSL `NODE_EXTRA_CA_CERTS` note. SM-14 checks that
  the section exists. The reviewer checks the content.
- `dev_minions/verification/US-031-qa.md` holds MANUAL-QA 1–7 (section 6) and ends with the files
  changed. It is **written during implementation** as a deliverable, so that the reviewer can
  check AC6. Loop step 7 then adds the verification evidence. This is a reviewer check.

### AC7 — Offline and gates
- DP-1's guard shows the pipeline test reached no network: the exact sequence, 0 unknown URLs, and
  `getDb` 0 calls. The smoke tests stub global `fetch` to throw and use only the injected
  `fetchImpl`. The health, chart and seam tests need no network.
- No new dependency: `package.json` changes only in `scripts`. This is a reviewer check (no
  manifest diff outside `scripts`), and the tester runs `pnpm install --frozen-lockfile`.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and
  `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u CRON_SECRET pnpm build`.
- Unchanged and still green: `lib/cron/default-deps.test.ts`, `lib/ingestion/default-deps.test.ts`,
  `lib/ingestion/default-deps.cron.test.ts`, `lib/cron/daily-handler.test.ts`,
  `app/api/cron/daily/route.test.ts`, `app/health/page.test.tsx` (tech-lead point 1).

---

## 2. Files and boundaries

### 2.1 The seam (tech-lead point 1; decision 11 "byte-for-byte production default")
- **`lib/ingestion/default-deps.ts`** (changed):
  - New exported type `DatabaseAccess = { db: Db; run: BatchRunner }`.
  - `createDailyRunDeps(options: { now; fetchTimeoutMs?; database?: DatabaseAccess })`. When
    `database` is present, it uses `database.db` and passes `database.run` to
    `createDrizzleReportStore`, `createDrizzleReportLinkStore` and `createDrizzleEtfLoader`.
    When it is absent, it calls `getDb()` and passes no runner, exactly as today. Passing
    `undefined` hits the same default parameter, `neonBatchRunner(db)`.
  - `createDefaultJobRunStore(database?: DatabaseAccess)`, the same rule.
  - `createDefaultIngestDeps` is untouched. The function names are unchanged, so
    `lib/cron/default-deps.test.ts`'s module mock (which only knows these two names) keeps
    working unedited.
- **`lib/cron/default-deps.ts`** (changed):
  - New `export function createDailyCronDeps(options: { database?: DatabaseAccess } = {}): DailyCronDeps`.
    It holds today's body, with `options.database` passed to both factories (type-only import).
  - `export const defaultDailyCronDeps: DailyCronDeps = createDailyCronDeps();`
  - `readEnv` still reads `process.env` there, and only there.
- `app/api/cron/daily/route.ts`, `lib/cron/daily-handler.ts`, `lib/cron/daily-job.ts` and
  `lib/ingestion/run-daily.ts` are **unchanged**.
- **Seam tests, in new files** (the existing ones stay unedited):
  - `lib/ingestion/default-deps.seam.test.ts`:
    - `DS-1` With `DATABASE_URL=""` and a PGlite `database`, `createDailyRunDeps` and
      `createDefaultJobRunStore` do not throw. `loadEtfs()` returns the seeded ETFs through the
      PGlite runner.
    - `DS-2` Without `database`, the existing `MissingDatabaseUrlError` behaviour holds (one
      assertion, mirrors DD-15).
  - `lib/cron/default-deps.seam.test.ts`:
    - `DS-3` With `../ingestion/default-deps` mocked, `createDailyCronDeps({ database })` passes
      the same `database` object to both factories.
    - `DS-4` `defaultDailyCronDeps` passes `undefined`.

### 2.2 Pipeline test
- **`test/e2e/daily-pipeline.pglite.test.ts`** (new): DP-0..DP-3.
- **`test/e2e/fixture-web.ts`** (new, test-only helper, not a `*.test.ts`), with these exports:
  - `FIXTURE_URLS` (page and PDF URLs per symbol);
  - `dayAMap()`, `dayBMap()` (URL → `() => Response`);
  - `deriveSymbolPage(html, from, to)`, `withoutReportRows(html)`;
  - `createFetchGuard(map)`, which returns `{ fetch, calls: {method,url}[], rejected: string[], setMap(map) }`.
    An unknown URL is pushed to `rejected` and rejects with a `TypeError`, the shape of a real
    network failure.
  - `expectedValues(file, fieldKeys)`, read from `test/fixtures/expected.json`.
  - It reuses the `readBytes` pattern of `ingest-icbetnetf.pglite.test.ts`.
- `beforeEach`/`it` timeouts are 120 000 ms. The PGlite setup is 60 000 ms, as in the existing
  PGlite files. Each `it` builds and closes its own database (no order dependence, Sprint 3 N5
  lesson).

### 2.3 Smoke script
- **`lib/smoke/deploy.ts`** (new, pure logic, no `process.*`):
  - `SMOKE_REQUEST_TIMEOUT_MS = 30_000`.
  - `SMOKE_LOCALES = locales` (from `i18n/locale.ts`).
  - `SMOKE_PAGES`: a readonly list of `{ path, failureKeys, noteKeys? }` (section 5).
  - `parseBaseUrl(arg) → { ok: true; origin } | { ok: false }`.
  - `buildRequest(origin, path, locale) → { url, init }`, with `method "GET"`,
    `redirect "manual"`, `cache "no-store"`, and headers `accept: text/html`,
    `cookie: NEXT_LOCALE=<l>`, `user-agent: etf-monitor2-smoke/0.1`.
  - `visibleMarkup(html)`: strips `<script…>…</script>`, case-insensitive.
  - `htmlLang(html)`.
  - `containsText(markup, text)`: raw form, or the React-escaped form.
  - `checkPage(response|error, page, locale, messages) → { verdict, status, reason?, note? }`.
  - `formatLine(result)`.
  - `runDeploySmoke(argv, { fetchImpl }) → Promise<{ lines: string[]; exitCode: 0|1|2 }>`.
  - Requests are sequential. The body read is included in the timeout race (AbortController, the
    same pattern as `lib/extraction/http.ts`, but not imported from it, so the smoke module does
    not depend on the extraction layer).
  - The messages come from static JSON imports of `messages/ro.json` and `messages/en.json`.
- **`scripts/smoke-deploy.ts`** (new, thin CLI, the `scripts/report-latest.ts` pattern): it
  prints `lines` with `console.log` and sets `process.exitCode`. It passes
  `process.argv.slice(2)` and `globalThis.fetch`. Nothing else.
- **`package.json`**: `"smoke:deploy": "tsx scripts/smoke-deploy.ts"` (scripts only).

### 2.4 `/health`
- **`lib/health.ts`** (changed):
  - `export const HEALTH_QUERY_TIMEOUT_MS = 8_000`.
  - `HealthStatus` gains a third member, `{ dbConnected: false; timedOut: true }`. The existing
    `{ dbConnected: false; error: string }` shape is unchanged, so existing test literals still
    type-check.
  - `getHealthStatus` races the two-count `Promise.all` against a timer that **resolves** to the
    timeout status. It clears the timer in `finally`, and attaches a no-op `.catch` to the query
    promise, so a late rejection is swallowed and not awaited. The existing `try/catch` for a
    synchronous throw or a rejection is kept, with the same messages as today.
- **`app/health/page.tsx`** (changed, render only). When `"timedOut" in status`, the
  `<dd className="mt-1 text-sm text-red-600">` shows `t("dbTimeout")` instead of
  `t("dbError", { message })`. `loadHealthStatus` and the `error` rendering are **unchanged**
  (decision 12 default).
- **`messages/en.json`, `messages/ro.json`**: `Health.dbTimeout`, en "The database did not answer
  in time.", ro "Baza de date nu a răspuns la timp.". The key-parity test covers it (FR8.1). A
  fixed text with no number and no connection detail.

### 2.5 Other
- `components/FieldChart.test.tsx`: FC-TT1..4 appended. `FieldChart.tsx` is unchanged.
- `README.md`: the new section, placed after "Health check".
- `dev_minions/verification/US-031-qa.md`: the runbook (AC6).

Boundaries:
- `lib/smoke/` imports only `i18n/locale.ts` and `messages/*.json`.
- `scripts/smoke-deploy.ts` imports only `lib/smoke/deploy`.
- `lib/cron/default-deps.ts` gains only a type import.
- No file in `lib/ingestion` gains a `process.env` read (BD scan, unchanged).

---

## 3. Data model and migrations
None. No schema, migration, seed or write-rule change. The pipeline test applies the existing
journal (`0000_init`, `0001_etf_report_links`) through `createEmptyTestDatabase()`, and the shipped
seed.

---

## 4. Risks and the smallest design

- **R1 — every message is in every page's HTML** (found while planning). `app/layout.tsx` passes
  `getMessages()` to `NextIntlClientProvider`, so the RSC payload (`<script>self.__next_f.push…`)
  contains every `loadError`, `dbUnreachable` and `Chat.replies.*` text on every page. A naive
  `body.includes(text)` would fail every page in production. Fix: search only
  `visibleMarkup(html)`, which strips `<script>` elements. SM-6 proves both directions. The
  layout itself is not changed (out of scope).
- **R2 — clock.** A real clock makes the job-run and link timestamps non-deterministic. It also
  lets the US-030 deadline guard (36 s start budget for 5 ETFs) mark an ETF `not_attempted` if
  the machine is very loaded, and concurrent-load timeouts have already hit PGlite tests
  (`deadline.pglite`, CPS-1). Faking **only `Date`** freezes `now()`, so the guard always passes
  and every timestamp is exact. `setTimeout` stays real, so `fetchOnce`'s timer and PGlite are
  unaffected. This is the environment's clock, not a production module; `lib/cron/default-deps.ts`'s
  `now` is still the real `() => new Date()`.
  - **Fallback**, if PGlite or `unpdf` misbehave with a frozen `Date`: a real clock, with
    timestamps asserted between before-and-after bounds. The implementer records which variant
    shipped in HANDOVER. Either way, no clock seam is added to production code.
- **R3 — duration under load.** DP-2 parses 8 PDFs. Mitigations: generous per-test timeouts, one
  database per `it`, and no parallelism inside the file. If the full suite still times out under
  concurrency, it is reported as the known flaky pattern, never "fixed" by weakening an
  assertion.
- **R4 — `unpdf` making a network call** (e.g. standard fonts). The guard would record it in
  `rejected`, and DP-1 would fail. That is a finding to investigate, **not** a URL to add to the
  map.
- **R5 — smoke false positives in production.**
  - Pages must not redirect. The list uses canonical paths with no trailing slash.
  - `/etf/BTBETRETF` uses a seeded symbol (tech-lead point 3). A test asserts it is in
    `seedEtfs`.
  - Vercel Deployment Protection on production would give 401 or a redirect, which is a correct
    FAIL. The runbook says so.
  - A deployment made before `pnpm db:migrate` shows `Home.loadError`, a correct FAIL.
- **R6 — timeout values.**
  - `HEALTH_QUERY_TIMEOUT_MS = 8 000`. Neon's free tier sleeps after 5 min of inactivity and
    resumes on the next query (requirements §4), which takes a few seconds. 8 s leaves room above
    that. It is also below the 10 s default duration Vercel applies to a Hobby function that sets
    no `maxDuration` without Fluid compute (`/health` sets none), and well under 60 s. So a
    hanging query renders the failure state instead of a platform timeout.
  - `SMOKE_REQUEST_TIMEOUT_MS = 30 000`: above a cold function start plus a Neon wake-up, and
    below the 60 s `maxDuration` of `/chat`, so a hung page is reported by the script before
    Vercel returns 504.
- **Smallest design.** One seam: an optional parameter on two existing factories, plus one
  factory wrapping the existing constant. One pure module with a two-line CLI. One constant and
  one union member for `/health`. Test additions for the chart. No new abstraction, dependency or
  production behaviour beyond the `/health` timeout.

---

## 5. Smoke page list (`SMOKE_PAGES`)
Each page is requested in `ro` and `en`. Failure texts are read from the catalogue of the
requested locale. Notes turn a PASS into `PASS … note=<key>` and never fail a page.
| Path | Failure keys | Note keys (legitimate unconfigured states) |
|---|---|---|
| `/` | `Home.loadError` | — |
| `/etf/BTBETRETF` | `EtfDetail.loadError` | — |
| `/chat` | `Chat.loadError` | `Chat.replies.unavailableNotConfigured`, `…UnknownProvider`, `…NotImplemented`, `…NoApiKey`, `…NoModel` |
| `/health` | `Health.dbUnreachable` | — |
| `/admin` | — (status + `lang` only) | — |
| `/admin/etfs` | `Admin.etfs.loadError` | — |
| `/admin/etfs/BTBETRETF/fields` | `Admin.fields.loadError` | — |
| `/admin/ai` | `Admin.ai.loadError` | — |
| `/admin/cron` | `Admin.cron.loadError`, `Admin.cron.unrecognisedSchedule` | — |
| `/admin/operations` | `Admin.operations.loadError` | — |

`Admin.cron.unrecognisedSchedule` counts as a failure: the committed `vercel.json` is pinned
once-a-day (`lib/cron/vercel-config.test.ts`), so seeing it live means the deployment and the repo
disagree. No `/api/` path and no Server Action are ever requested.

---

## 6. Runbook content (`verification/US-031-qa.md`, MANUAL-QA 1–7)
1. **Smoke.** In WSL, run `export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt`, then
   `pnpm smoke:deploy https://etf-monitor2.vercel.app`, then `echo $?`. Expected: 20 `PASS` lines
   and `SUMMARY 20/20 passed`, exit 0, and no page text printed. `/chat` may say
   `note=Chat.replies.unavailable…` only if no provider or key is configured.
2. **RO/EN.** Switch the language with the header switcher on: home, `/etf/BTBETRETF`, `/chat`,
   `/health`, `/admin`, `/admin/etfs`, `/admin/etfs/BTBETRETF/fields`, `/admin/ai`,
   `/admin/cron`, `/admin/operations`. Expected: no raw key (e.g. `Home.loadError`) anywhere.
   Numbers have no thousands separator, with a decimal comma in RO and a dot in EN. Dates are
   `DD.MM.YYYY` in RO and ISO in EN (DEC-007, P5).
3. **`/health`.** It shows "Connected" / "Conectat", with the ETF count and the field-catalogue
   count (16 catalogue rows after the Sprint 7 seed).
4. **One chat command per provider.**
   - In `/admin/ai`, choose Gemini and its model. In `/chat`, send "also track VUAN for
     TVBETETF". The reply is correct and in the current language, and `/admin/etfs` →
     TVBETETF → Fields lists it. Undo it with "stop tracking VUAN for TVBETETF", or in the fields
     page.
   - Repeat with Groq.
5. **Scheduled cron run.** After the next **scheduled** run (not Vercel's "Run" button),
   `/admin/operations` shows a new run whose start time is inside the `vercel.json` hour (shown
   on `/admin/cron`), with one translated line per active ETF.
6. **No secret in the logs.** Vercel → project → Logs, filtered on `/api/cron/daily` for that run,
   and on one `/chat` POST. No API key, `CRON_SECRET` or `DATABASE_URL` value (or part of one,
   e.g. the Neon host or password) appears.
7. **Duration.** Vercel → project → Logs (or Observability) → that cron invocation. Its duration
   is well under 60 s. Write the number into `US-031-qa-run.md`.

The runbook also notes that if Vercel Deployment Protection is on for production, step 1 fails
with 401 or a redirect by design.

---

## 7. Decisions needed

| # | Type | Question | Status |
|---|---|---|---|
| 11 (sprint) | TECHNICAL | What the agent delivers for a live-deployment story | **Decided** (tech-lead, 2026-09-27). This plan implements (a) pipeline test, (b) read-only smoke, (c) runbook, with the `redirect: "manual"` rule. |
| 12 (sprint) | PRODUCT | `/health` renders the database exception text | **NEEDS USER — isolated default ships.** Unchanged, in `app/health/page.tsx` `loadHealthStatus` + the `t("dbError", { message })` line. The new timeout state uses a fixed translated text either way. If the PO picks the recommendation (known-safe messages only), the change is confined to those two places in `app/health/page.tsx`. |
| P-1 (plan) | TECHNICAL | Fake `Date` in the pipeline test vs. a real clock | Resolved in this plan (R2): Date-only fake, with a real-clock fallback. No production seam. Not open. |
| P-2 (plan) | TECHNICAL | How the smoke check avoids the RSC payload's copy of every message | Resolved in this plan (R1): strip `<script>` before matching. Not open. |
| P-3 (plan) | TECHNICAL | `/chat` unconfigured, and `/admin/cron` unrecognised schedule | Resolved in this plan (section 5): the first is a PASS with a note, the second a FAIL. Not open. |

No TECHNICAL item is open, and the only PRODUCT item has an isolated default → **not blocked**.

---

## 8. Files changed (expected)
- new: `test/e2e/daily-pipeline.pglite.test.ts`, `test/e2e/fixture-web.ts`
- new: `lib/smoke/deploy.ts`, `lib/smoke/deploy.test.ts`, `scripts/smoke-deploy.ts`
- new: `lib/ingestion/default-deps.seam.test.ts`, `lib/cron/default-deps.seam.test.ts`
- new: `app/health/page.failure.test.tsx`
- new: `dev_minions/verification/US-031-qa.md` (the runbook; completed at loop step 7)
- changed: `lib/ingestion/default-deps.ts` (optional `database`, `DatabaseAccess` type)
- changed: `lib/cron/default-deps.ts` (`createDailyCronDeps`; `defaultDailyCronDeps` built from it)
- changed: `lib/health.ts` (`HEALTH_QUERY_TIMEOUT_MS`, `timedOut` state), `lib/health.test.ts`
  (HC-1..HC-4 appended)
- changed: `app/health/page.tsx` (render the timeout state only)
- changed: `messages/en.json`, `messages/ro.json` (`Health.dbTimeout`)
- changed: `components/FieldChart.test.tsx` (FC-TT1..FC-TT4 appended)
- changed: `package.json` (`scripts.smoke:deploy` only), `README.md` ("Deployment smoke check")
- unchanged (must stay green unedited): `app/api/cron/daily/route.ts` + test,
  `lib/cron/daily-handler.ts` + test, `lib/cron/daily-job.ts`, `lib/cron/default-deps.test.ts`,
  `lib/ingestion/default-deps.test.ts`, `lib/ingestion/default-deps.cron.test.ts`,
  `app/health/page.test.tsx`, `components/FieldChart.tsx`, `drizzle/`, `data-model.md`
