# US-037 plan: ingest every report in the newest filing, store every extracted field

> story-planner, 2026-09-29. Binding text: sprint-09 "Decisions needed" T-1, D-1, D-2, D-3 (Decided), P-3 (isolated
> default), `verification/SPRINT-09-review.md` §3 T-1 and §7, DEC-018 §5 as amended 2026-09-28, DEC-010 and the
> data-model "Write rules".
> No schema change, no migration, no new dependency. Data-only story: no design reference applies.

Nothing TECHNICAL is open (the planner-level details in §5 are resolved here), and P-3 ships its isolated default.
**Not blocked.**

## 0. Findings from the code that shape this plan

1. **The add-time budget test breaks at `MAX_REQUESTS_PER_ETF = 5`.** `app/chat/page.test.tsx` CPG-4b computes
   `AI_PROVIDER_TIMEOUT_MS (20 000) + MAX_REQUESTS_PER_ETF × 7 000 + 15 000`. At 5 that is 70 000 > 60 000. That test
   models add-time **detection** (US-020/US-029), which stays single-link (discovery + one PDF = 2 requests). The fix is to
   point CPG-4b and PG-7b (`app/admin/etfs/page.test.tsx`) at the new `MIN_REQUESTS_PER_ETF` (= 2), which is the same
   value they use today. The fix is not to loosen them. RB-4 proves detection's request count against that constant (§3).
2. **The e2e day-B trick conflicts with URL identity.** `test/e2e/fixture-web.ts` `dayBMap()` serves the 22 Sept PDF
   at the **same URL** that served the 21 Sept PDF on day A. Once links are skipped by `source_url`, day B would skip
   that URL, and DP-2 would fail. BVB never does this: every filing gets a new time-stamped filename. So `dayBMap()` must
   serve the new report under a new URL, with the page's newest-row href rewritten to it (§3, deliberate change).
3. **Drizzle expands a JS array in `sql```** as `($1, $2, …)` (`node_modules/drizzle-orm/sql/sql.js:93-102`). So
   `"source_url" in ${urls}` is one statement with one parameter per URL, and it behaves the same on neon-http and PGlite.
   `= any(${urls}::text[])` would render as `= any(($1, $2)::text[])`, which is invalid. The URL read uses `in (…)`,
   which means the same thing as T-1's `= any(...)` (PL-7). An empty list is never queried.
4. `lib/ingestion/ingest-etf.test.ts` BD-3 forbids `new Date(`, `Date.now(` and the word `publishedAt` in every non-test
   file under `lib/ingestion/`. The new code must not mention them. Links are mapped as whole `ReportLink` objects.
5. Existing exact-`detail` assertions exist in about ten tests (listed in §3). D-2 says the ETF detail **always** carries
   the four counts, so those expectations change on purpose, one by one.
6. There is no "manual run" button on `/admin/cron`. The same-day manual run the story's "known limit" refers to is the
   README's `curl … /api/cron/daily` trigger (or Vercel's cron "Run" action). Nothing is built for this. It is information
   only (§6).

## 1. Acceptance criteria → tests

Test ids are new unless marked "existing". Every PGlite test applies every migration (`test/helpers/pglite.ts`). Every
network call goes through a counting/recording fake `fetch`, and global `fetch` is stubbed to throw.

| AC | Proof |
|---|---|
| **AC1** Every report in the filing (FR3.1, DEC-010) | **MF-1** (`lib/ingestion/ingest-filing.test.ts`, unit): discovery returns 3 links. Download and extract are stubbed so each PDF's text carries a different report date (`2026-09-18/19/20`). The row title, `publishedAt` and URL names carry decoy dates, and `Date` is faked to 2031. Asserts 3 `saveReport` calls, each with the date from its own text, its own `sourceUrl`, its own values, and exactly one `reportDate` per call (one batch per report). Processing order is newest first. **MFP-1** (`lib/ingestion/ingest-filing.pglite.test.ts`): a BTBETRETF page built from the committed fixture. Its newest row holds two anchors, `URL_OLD` → `BTBETRETF-2026-09-21.pdf` and `URL_NEW` → `BTBETRETF-2026-09-22.pdf`. The URL names and the row title carry decoy dates, and `Date` is faked. The real discovery, download, `unpdf` and adapter run with the shipped `createDrizzleReportStore`. Reads back 2 `reports` rows: `2026-09-22`/`URL_NEW` and `2026-09-21`/`URL_OLD`, both `ok`, each with the values of `expected.json` for its file. |
| **AC2** Every field (FR3.1, FR7.3, P1, US-014 AC5) | **SV-1..SV-5** (`select-values.test.ts`, rewritten): every extracted value is returned in adapter order, whatever is tracked. Zero tracked keys → complete with every value. A tracked key missing or unknown → incomplete, `missingFieldKeys` in tracked order and de-duplicated, values = every found value. Inputs are not mutated. **MFP-2**: an ETF tracking 2 fields gets one `report_values` row for **every** key of the `expected.json` entry (8 BRD keys; the entry's key set equals the adapter's `fieldKeys`, checked by the existing `fixtures.test.ts:166`), with `numeric_value`/`raw_value` equal to it. **MF-6** (unit): a tracked key the adapter did not return → `parse_error`/`incomplete`, and `saveReport` gets every found value. Existing E2E-3 (`ingest-etf.pglite.test.ts`) stays unchanged. |
| **AC3** Idempotent by URL, completes on re-run (FR3.1, T-1 (a), FR4.1) | **MFP-3**: two runs of MFP-1's setup. On the second run, the recording fetch sees exactly `[page]`, the outcome is `already_ingested` with `reportDate` `2026-09-22`, and the `select * from "reports"` / `select * from "report_values"` snapshots, `fetched_at` included, are identical before and after. **MF-3** (unit): 3 links, and link 2's download returns HTTP 500. Links 1 and 3 are saved, and the outcome is `fetch_error` with detail `stored 2, already stored 0, failed 1, not attempted 0; download http_error 500: …`. A second `ingestEtf` on the same store calls `download` **only** with link 2's URL and saves it. Outcome `ok`, `stored 1, already stored 2, …`. **MFP-4**: the same over PGlite with the 2 real PDFs (`URL_NEW` 500 first, then fixed). **MF-4**: `findStoredReportUrls` is called exactly once per `ingestEtf`, with every kept URL, for 1, 3 and 4 links. `findReport` is never called for a URL-skipped link. **FS-1/FS-2** (`store.test.ts`): the read is one runner call holding one `select` statement, with no `insert`/`update`/`delete`, so it is outside any write batch. **DP-2** (existing, changed, §3): the second cron run over the same pages makes one request per ETF (`guard2.calls` 9 → 5), writes no `reports`/`report_values`, still writes its `job_runs` row (3 rows after 3 runs), and every adapter ETF is `already_ingested`. |
| **AC4** Never downgraded, duplicate date harmless (DEC-010) | **MFP-5**: a seeded `ok` report for `2026-09-22` with `source_url` `URL_X` and its values. A filing `[URL_OLD, URL_NEW]`, where `URL_NEW` serves the 22 PDF. `2026-09-22` keeps `URL_X`, status `ok`, and its original values, `fetched_at` unchanged. `2026-09-21` is stored. Outcome `ok`, `stored 1, already stored 1, …`. **MFP-6**: the same seeded `ok` row while the ETF also tracks `not_a_real_field` (the later link would be `parse_error`/incomplete). The row stays `ok` with unchanged values. **MFP-7**: two links in one filing that both serve the 22 PDF give one report (the newest link's URL). The second link is a no-op, outcome `ok`, `stored 1, already stored 1, …`. Existing IE-5a, IF-7a/b and the `store.pglite.test.ts` guard tests stay green. |
| **AC5** Deadline guard per download (DEC-018 §5 amended, FR13, US-030 AC7) | **DL-8** (`run-deadline.test.ts`): `canStartDownload` is true exactly at `now + CRON_FETCH_TIMEOUT_MS + PARSE_ALLOWANCE_MS === runDeadlineMs(startedAt)` and false 1 ms later. **MF-7**: `runDailyIngestion` runs with the shipped `canStartDownload` and a mutable fake clock. The ETF has 4 links: link 1 is already stored (URL skip), link 2 is downloaded, and its download stub advances the clock past the limit. Links 3 and 4 are `not_attempted` with **no** download call (the download spy holds only link 2). The ETF outcome is `not_attempted`, detail `stored 1, already stored 1, failed 0, not attempted 2; run time limit: …`. `summarizeRun` counts it as an error (`partial` next to an `ok` ETF), and `formatRunLog` writes one line per ETF. **MF-8**: a failed link plus a deadline cut → the failure code wins (D-2). **MF-9**: the first PDF is never guarded, even with a guard that is always false: 1 download, the rest `not_attempted`. **DD-G1** (`lib/ingestion/default-deps.guard.pglite.test.ts`): `createDailyRunDeps({ now, database })` (PGlite seam) with discovery and download mocked. `deps.ingest(etf, { canStartDownload: () => false })` over 2 links makes 1 download. The same with `() => true` makes 2. This proves the production wiring. |
| **AC6** Display unchanged by storage (FR7.3, P-1) | **DV-1** (in `ingest-filing.pglite.test.ts`): `seed()` (BRD ETFs tracking `nav_per_unit`, `units_in_circulation`), then MFP-1's ingest for BTBETRETF (8 fields stored per report). The shipped `createHomeTableLoader`'s `columns` are exactly the tracked-union keys, and every row's `cells` keys equal them. The shipped `createEtfHistoryLoader('BTBETRETF')` returns `fields` = the tracked keys, and every row's `values` keys = the tracked keys. Existing DP-1's `home.columns` assertion stays unchanged while 8 fields are now stored. |
| **AC7** Budget constants (DEC-018 §5 amended) | **RT-7b** (`app/api/cron/daily/route.test.ts`, existing): its assertions stay as they are (they are already over the constants: 5×7000+5000+5000 = 45 000 ≤ 60 000, `maxFitting` = 7). It is **extended** in place with: `MAX_REPORTS_PER_FILING === 4`; `MAX_REQUESTS_PER_ETF === 1 + MAX_REPORTS_PER_FILING`; a computed filing counter-case `etfWorstCaseMs(1 + (maxFitting - 1) + 1) > CRON_MAX_DURATION_S × 1000` (a filing cap one past the largest that fits fails); `MIN_REQUESTS_PER_ETF === 2`. RT-7d still asserts `route.maxDuration === CRON_MAX_DURATION_S`. **DL-9**: `canStartEtf` is true exactly at `now + etfWorstCaseMs(MIN_REQUESTS_PER_ETF) === deadline` and false 1 ms later. **DL-10**: the bodies of `canStartEtf` and `canStartDownload` contain no numeric literal (the DL-7 pattern). Existing DL-7 (5 constant lines), the "guard constants sanity" test, RT-15 (`STALE_RUN_THRESHOLD_MS`) and the timeout values stay unchanged. |
| **AC8** Request bound and truncation (DEC-018 §1/§5, D-1, US-007) | **RB-6** (`request-bound.test.ts`): the BTBETRETF page's newest row is rewritten to hold 6 anchors (ascending dates, as BVB lists them). Real discovery and real download run over a counting fetch that serves `%PDF-` bytes, and `extractText` is stubbed. Exactly `MAX_REQUESTS_PER_ETF` (5) calls: the page first, then the **4 newest** hrefs, newest first. The 2 oldest are never requested, and the detail contains `truncated`. **FL-1** (`lib/extraction/discovery.filing.test.ts`): for each BRD fixture, the rows above the three-link catch-up row are removed (test helper), and `findLatestFilingLinks` returns its three links newest first (`…20-09-2026.pdf`, `…19…`, `…18…`). The expected hrefs are read from the raw row by an independent regex, not through the parser. `truncated` is false. **FL-2**: on every committed page fixture (3 BRD + ICBETNETF), `findLatestFilingLinks(...).links[0]` deep-equals `findLatestReportLink(...)`. The existing `discovery.test.ts` and `discovery.icbetnetf.test.ts` stay unchanged and green (the README §7 URLs). **FL-3**: a 6-link row keeps the 4 newest with `truncated` true. A row repeating one href keeps it once (PL-6). No report row gives `null`. **FL-4**: `discoverLatestReport`'s `found` result carries `links` and `truncated`, with `pdfUrl`/`title`/`publishedAt` equal to `links[0]`. **DT-M1**: `detectAdapter` over a synthetic 3-link newest row makes ≤ `MIN_REQUESTS_PER_ETF` requests and downloads `links[0]` only. **NA-M1**: a no-adapter ETF over the same page makes 1 request and upserts `links[0]`'s URL. Existing RB-4 (tightened, §3), RB-5, `detect-adapter.test.ts` and `ingest-no-adapter.test.ts` stay unchanged. |
| **AC9** Docs (FR3.1) | `data-model.md` "Write rules" gains the text in §2.8. **DM-1** (`test/data-model-doc.test.ts`, the `readme-deployment.test.ts` pattern) asserts the three rules are present: per-filing batches with the URL skip, "every extracted field is stored", and "tracked fields select what is displayed, not what is stored". |
| **AC10** Offline and gates | Every new test stubs global `fetch` to throw and runs SQL on PGlite only. `package.json`/`pnpm-lock.yaml` and `drizzle/` stay untouched. The boundary tests (`lib/ingestion/boundaries.test.ts`, BD-3) stay green. `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` pass with `DATABASE_URL`, `CRON_SECRET` and `VERCEL_ENV` unset (quoted in HANDOVER by the implementer, re-run by the tester). |

**MANUAL-QA (live, optional, never blocking):** on the first Monday after the push, `/admin/operations` shows each BRD
ETF's line as `ok … stored 3, already stored 0, failed 0, not attempted 0; … values written`, or `stored N, already
stored M, …` after a re-run. `/etf/BTBETRETF` then has rows for Friday, Saturday and Sunday (sprint-09 manual step 3).
Codex can only check this against live bvb.ro and the production database, so it stays a user observation.

## 2. Files and boundaries

### 2.1 `lib/extraction/discovery.ts` (discovery only, no DB)
- `export const MAX_REPORTS_PER_FILING = 4;` (PL-1: defined where it is applied, imported by `run-daily.ts`).
- `export function findLatestFilingLinks(html, pageUrl): { links: ReportLink[]; truncated: boolean } | null`:
  - Candidates and comparator exactly as `findLatestReportLink` today.
  - Keeps the sorted candidates whose `rowIndex` equals `sorted[0].rowIndex`. Within one row the comparator already
    orders them by `linkIndexInRow` descending, so they are newest first (D-1).
  - De-duplicates by `pdfUrl`, keeping the first occurrence (PL-6).
  - Keeps the first `MAX_REPORTS_PER_FILING`; `truncated` = there were more.
- `findLatestReportLink` becomes `findLatestFilingLinks(html, pageUrl)?.links[0] ?? null`, with an identical result.
- `DiscoveryResult` `found` becomes `{ status: "found" } & ReportLink & { links?: readonly ReportLink[]; truncated?: boolean }`
  (PL-2). `discoverLatestReport` always sets both: `{ status: "found", ...links[0], links, truncated }`.
- Detection (`lib/config/detect-adapter.ts`), the no-adapter branch and `lib/extraction/report-latest.ts` read only
  `pdfUrl` (and `publishedAt`), so they are **unchanged**.

### 2.2 `lib/ingestion/run-daily.ts` (budget and run loop)
- `import { MAX_REPORTS_PER_FILING } from "../extraction/discovery";` and re-export it, so every budget constant can be
  imported from one module.
- `export const MIN_REQUESTS_PER_ETF = 2;` with a comment: discovery + one PDF. This is what `canStartEtf` reserves, and
  the most the add-time detection path makes.
- `export const MAX_REQUESTS_PER_ETF = 1 + MAX_REPORTS_PER_FILING;` on one line (DL-7's regex still counts it once).
  Its comment says: discovery + at most `MAX_REPORTS_PER_FILING` PDFs.
- `etfWorstCaseMs(requests = MAX_REQUESTS_PER_ETF)` is unchanged. Its comment notes that it models one parse
  allowance, and that every PDF after the first is additionally guarded by `canStartDownload` (review §7).
- `canStartEtf(now, startedAt)`: `now.getTime() + etfWorstCaseMs(MIN_REQUESTS_PER_ETF) <= runDeadlineMs(startedAt)`.
- `canStartDownload(now, startedAt)`: `now.getTime() + CRON_FETCH_TIMEOUT_MS + PARSE_ALLOWANCE_MS <= runDeadlineMs(startedAt)`.
- `DailyRunDeps.ingest: (etf: IngestEtfInput, run: { canStartDownload: () => boolean }) => Promise<IngestOutcome>`.
  The second argument is **required**. `runDailyIngestion` passes
  `{ canStartDownload: () => canStartDownload(budget.now(), budget.startedAt) }`. Existing test stubs with fewer
  parameters still type-check.
- `CRON_FETCH_TIMEOUT_MS`, `PARSE_ALLOWANCE_MS`, `FINISH_RESERVE_MS`, `CRON_MAX_DURATION_S` and `runDeadlineMs` are
  unchanged.

### 2.3 `lib/ingestion/store.ts` (the only SQL for reports)
- `ReportStore` gains `findStoredReportUrls(etfId: number, sourceUrls: readonly string[]): Promise<ReadonlyMap<string, string>>`
  (URL → `report_date` as `YYYY-MM-DD`).
- `buildFindStoredReportUrlsStatement(db, etfId, sourceUrls)`:
  `select "source_url", "report_date"::text as "report_date" from "reports" where "etf_id" = ${etfId} and "status" = 'ok' and "source_url" in ${[...sourceUrls]}`
  (`::text` avoids PGlite's `Date` parsing, see `home.ts` `toIsoDateString`). The store returns an empty map without
  querying when the list is empty. It runs as its own `run([statement])` call, like `findReport`, never inside a write
  batch.
- `buildSaveReportStatements` and `findReport` are unchanged (DEC-010 path untouched, BD-14a still true).

### 2.4 `lib/ingestion/select-values.ts`
- `values` = every value in `result.values` (a copy, in adapter order).
- `missingFieldKeys` = the de-duplicated tracked keys, in tracked order, that are absent from `values` (D-3).
- `complete` = no missing key. The comment is rewritten: every extracted field is stored (FR3.1, P1 answered). Tracked
  keys decide only `ok` vs `parse_error`, and what is displayed.
- The type `ValueSelection` is unchanged.

### 2.5 `lib/ingestion/outcome.ts` + new `lib/ingestion/filing-outcome.ts` (pure, no I/O)
- `outcome.ts`: `formatFilingCounts({ stored, alreadyStored, failed, notAttempted, truncated })` →
  `stored N, already stored M, failed K, not attempted J` plus `, truncated` when truncated. The code list is unchanged.
- `filing-outcome.ts`: `combineFilingOutcomes(symbol, outcomes: readonly IngestOutcome[], truncated: boolean): IngestOutcome`.
  - The per-link outcomes are in processing order (newest link first). Counting: `ok` → stored;
    `already_ingested` → already stored; `not_attempted` → not attempted; every other code → failed.
  - Priority (D-2):
    1. First failure in processing order: `{ ...thatOutcome, detail }`. Its own `reportDate` is kept or stays absent
       (IF-6c).
    2. Else any `not_attempted`: `{ code: "not_attempted", symbol, detail }`.
    3. Else any `ok`: `{ code: "ok", symbol, reportDate, sourceUrl, valuesWritten, detail }`. `reportDate` and
       `sourceUrl` come from the stored report with the greatest report date (ISO strings; a tie goes to the first
       processed, PL-9). `valuesWritten` is the sum over the stored reports.
    4. Else `already_ingested` with the first (newest) link's `reportDate` (D-2 tie-break 2).
  - Detail (PL-3), passed through `oneLine`:
    - failure: `counts; <failure detail>`
    - `not_attempted`: `counts; run time limit: remaining reports not downloaded before the deadline`
    - `ok`: `counts; <sum> values written`
    - `already_ingested`: `counts`
  - The counts come first, so `truncateDetail`'s 300-character cap can never cut them. No URL is added, and the failure
    detail is today's text.
  - An empty `outcomes` list is a programming error: return `internal_error`, detail `internal error: no report link`.

### 2.6 `lib/ingestion/ingest-etf.ts` (orchestration)
- `IngestDeps` gains `canStartDownload?: () => boolean` (optional, PL-4). When it is absent there is no run deadline
  (tests, one-off tools). The daily run always supplies it (§2.7, DD-G1).
- Unchanged: the registry lookup, the no-adapter branch (`discovery.pdfUrl` = newest link), and the discovery
  error/`missing` outcomes. These are decided before any link is known and keep today's detail text, with no counts.
- After a `found` discovery:
  1. `kept = discovery.links?.length ? discovery.links : [discovery]`, and `truncated = discovery.truncated === true`.
  2. One `store.findStoredReportUrls(etf.id, kept URLs)` call. If it rejects, every kept link becomes
     `persist_error` (`database read failed: <errorText>`) and no PDF request is made (PL-5).
  3. For each kept link, in order:
     - if its URL is in the map → `already_ingested` with the stored date, no request;
     - else, if a download already started in this ETF and `canStartDownload?.()` returns false → this link and every
       later link that still needs a download → `not_attempted`, no request;
     - else → `ingestReport(...)`, kept in its existing `try/catch` → `internal_error`.
  4. Return `combineFilingOutcomes(etf.symbol, outcomes, truncated)`.
- `ingestReport` and `persist` are unchanged, except that the selection now carries every value. One `saveReport` =
  one report = one DEC-010 batch.
- The comments are updated (the "future change" note on `ingestReport` is now fulfilled). No `new Date(`, no
  `publishedAt` (BD-3).

### 2.7 `lib/ingestion/default-deps.ts`
- `createDailyRunDeps(...).ingest = (etf, run) => ingestEtf(etf, { ...ingestDeps, canStartDownload: run.canStartDownload })`.
- `createDefaultIngestDeps` is unchanged (no guard). `lib/cron/default-deps.ts` is unchanged: it already passes
  `{ startedAt, now }` to `runDailyIngestion`.

### 2.8 Docs
- `dev_minions/architecture/data-model.md` "Write rules": add these bullets.
  - The daily run stores every report of the newest filing row (up to `MAX_REPORTS_PER_FILING`, newest first). Each
    report is its own DEC-010 batch, and no batch mixes two reports.
  - A link whose `source_url` already has an `ok` report for that ETF is skipped with no request. This is one read per
    ETF, outside any write batch.
  - A link resolving to an already-`ok` date is a no-op.
  - Every field the adapter extracts is stored. Tracked fields decide `ok` vs `parse_error` and select what is
    displayed, not what is stored.
  - Reports stored before US-037 keep only their tracked fields (P-3, no backfill).
  - The `job_runs.log` bullet gains the four counts.
  - The migrations line is not touched (US-047 rewrites it, sprint-09 carry-forward).
- `README.md` "Daily ingestion (cron)" first sentence: "downloads every report in the newest depositary filing (up to
  4) for every active ETF and persists every extracted field".

### 2.9 Test helpers
- `test/helpers/filing-page.ts` (new):
  - `withNewestRowHrefs(html, hrefs)` replaces the `<a href>` anchors of the first `gv5News` row with the given hrefs,
    in the given (ascending) order, in the page's single-quote markup;
  - `withoutRowsBefore(html, n)` drops the first `n` rows;
  - `rowHrefs(html, rowIndex)` is an independent regex read of a row's hrefs, for FL-1.
- `test/helpers/ingest-fakes.ts`:
  - `FakeStore` rows remember `sourceUrl`, and `seed(...)` gains an optional `sourceUrl`;
  - `FakeStore` gains `findStoredReportUrls` (answers from the `ok` rows, records calls, optional `findStoredReportUrlsImpl`);
  - new `filingDeps({ links, store, textFor, canStartDownload })` builds a stubbed multi-link `IngestDeps`, with a fake
    adapter that reads the report date from the stubbed text.

## 3. Existing tests whose expectations change (and the AC that replaces each)

Nothing else in US-012/US-014/US-029/US-030/US-031 changes. Every change below is to the expected value only. No
assertion is dropped.

| File | Test | Old → new | Replaced by |
|---|---|---|---|
| `lib/ingestion/select-values.test.ts` | "returns only the tracked keys' values…", "leaves untracked adapter fields absent", "zero tracked fields gives complete with zero values", "duplicate tracked keys…" | only tracked / none → every extracted value (de-duplication now concerns `missingFieldKeys`) | AC2 (SV-1..SV-5) |
| `lib/ingestion/ingest-etf.test.ts` | IE-1 | `values` 2 → 8 (every `expected.json` key); `valuesWritten` 2 → 8; detail `stored 2 values` → `stored 1, already stored 0, failed 0, not attempted 0; 8 values written` | AC2, Task 5 (D-2) |
| same | IE-3a (+ describe title) | writes only the 2 tracked keys → writes all 8 | AC2 |
| same | "US-014 AC5: an unknown tracked key…" | saved values `["units_in_circulation"]` → every one of the 8 found keys (status and error message unchanged) | AC2 bullet 2 (D-3) |
| same | IE-3c | `valuesWritten` 0 / values `[]` → 8 / all 8 | AC2 |
| same | IE-5a, IE-5d | detail `report already stored` → `stored 0, already stored 1, failed 0, not attempted 0` | Task 5 (D-2) |
| same | IE-5c | 2nd call "one discovery and one download", `fetch` ×4 → discovery only, ×3 | AC3 |
| same | local `FakeStore` | + `sourceUrl`, + `findStoredReportUrls` (needed by the interface) | — |
| `lib/ingestion/ingest-etf.failures.test.ts` | download-stage rows of the fetch-error table (`download http_error 404:`, `network:`, `not_pdf:`) | `detailPrefix` gains the `stored 0, already stored 0, failed 1, not attempted 0; ` prefix (discovery-stage rows unchanged) | Task 5 |
| same | unreadable-text (`startsWith("unreadable text:")`), format-not-recognised, extraction-failed, IF-5a, IF-6c | the same counts prefix before today's text | Task 5 |
| same | IF-7a | detail → `stored 0, already stored 1, failed 0, not attempted 0` | Task 5 |
| `lib/ingestion/ingest-etf.pglite.test.ts` | E2E-1, E2E-2 | `report_values` 2 → 8, each equal to `expected.json` | AC2 |
| `lib/ingestion/ingest-icbetnetf.pglite.test.ts` | IC-E2E-1 | 2 value rows → the 8 of `expected.json` for `ICBETNETF-2026-09-24.pdf` | AC2 |
| `lib/ingestion/request-bound.test.ts` | RB-1, RB-2 | `toHaveLength(MAX_REQUESTS_PER_ETF)` → `toHaveLength(MIN_REQUESTS_PER_ETF)` (single-link fixture rows) **and** `≤ MAX_REQUESTS_PER_ETF` | AC7, AC8 |
| same | RB-3, RB-4 | bound `MAX_REQUESTS_PER_ETF` → `MIN_REQUESTS_PER_ETF` (same value 2; not loosened to 5) | AC8 |
| same | `inMemoryStore` | + `sourceUrl` memory, + `findStoredReportUrls` | — |
| `app/api/cron/daily/route.test.ts` | RT-7b | extended in place (§1 AC7); existing lines verbatim | AC7 |
| `app/chat/page.test.tsx` CPG-4b, `app/admin/etfs/page.test.tsx` PG-7b | add-time budget | `MAX_REQUESTS_PER_ETF` → `MIN_REQUESTS_PER_ETF` (detection is single-link; the value is the same 2; §0.1) | AC8 (DT-M1, RB-4) |
| `test/e2e/fixture-web.ts` | `dayBMap()` | BTBETRETF/TVBETETF: same URL serves the new PDF → the page's newest-row href is rewritten to a new day-B URL (`…_20260924…`) that serves the 22 PDF (`FIXTURE_URLS.pdfDayB`) | AC3 (§0.2) |
| `test/e2e/daily-pipeline.pglite.test.ts` | DP-0 | + self-check that day B maps the new URLs and the day-B page contains them | AC3 |
| same | DP-1 | log lines `stored 2 values` → `stored 1, already stored 0, failed 0, not attempted 0; 8 values written`; BRD and ICBETNETF `report_values` → every `expected.json` key; `home.columns`, `callsPerSymbol ≤ 2`, history row counts unchanged | AC2, Task 5, AC6 |
| same | DP-2 | `guard2.calls` 9 → 5 (discovery only); `guard3.calls` 8 → 7 (ICBETNETF skipped by URL: 1 call); codes and home assertions unchanged | AC3 |
| `lib/ingestion/default-deps.cron.test.ts` | `deps.ingest(etf)` | + second argument `{ canStartDownload: () => true }` (type only) | — |

Unchanged on purpose (the reviewer can check): `discovery.test.ts`, `discovery.icbetnetf.test.ts`,
`detect-adapter.test.ts`, `ingest-no-adapter.test.ts`, `recovery.pglite.test.ts`, `run-daily.test.ts`,
`run-deadline.test.ts` DL-1..DL-7, `job-run-summary.test.ts`, `lib/admin/run-log.test.ts`, `store.pglite.test.ts`,
`lib/cron/*`, and every monitoring test.

## 4. Data model and migration

None. `reports` stays unique on `(etf_id, report_date)`. `report_values.field_key` has no foreign key, so every adapter
key is storable. No `drizzle/` file and no `pnpm db:generate`. `data-model.md` changes only in its prose (§2.8).

## 5. Risks, and the smallest design

- **Smallest design.** No schema change and no new outcome code. Discovery exposes the newest row's link list. One read
  query per ETF. A loop over the existing `ingestReport`/`persist`/`saveReport` path. One pure aggregator. One guard
  function. It is extensible only where T-1 asks: the cap is a constant, and the guard is injected.
- **URL identity assumption.** The design assumes BVB never serves new content under a URL already stored as `ok`. The
  filenames carry the filing timestamp, so this holds. If it ever broke, a report would be skipped, never overwritten
  (DEC-010 holds either way). The rule is documented in data-model.md.
- **Budget.** `canStartEtf` reserves discovery + one PDF + one parse (19 s). Every further PDF is guarded with fetch +
  parse (12 s) against the same deadline (55 s after start), so no path exceeds `maxDuration`. The known limit (T-1): a
  deadline-cut weekend report is fetched only by a same-day manual run (§0.6).
- **Detail text change.** The operations dashboard shows the new line as-is. The run-log parser is format-agnostic
  (`symbol code [date] rest`). No UI string changes, so there are no i18n keys.
- **PGlite time on WSL.** The new PGlite tests parse at most 2 real PDFs per run, with the same timeouts as E2E-1
  (30 s per test, 60 s `beforeEach`). RB-6 uses stubbed text, so it does no PDF parsing.
- **Optional weekend fixtures** (story note): not planned. AC1 is met without them.

### Decisions needed

| # | Type | Question | Resolution |
|---|---|---|---|
| T-1 | TECHNICAL | Several reports per filing | Decided (review §3, DEC-018 §5 amended). Implemented as §2. |
| D-1 | TECHNICAL | Link order and cap | Decided: newest first, the cap keeps the 4 newest (§2.1). |
| D-2 | TECHNICAL | ETF outcome, tie-breaks | Decided: §2.5. |
| D-3 | TECHNICAL | Status rule | Decided: unchanged (§2.4). |
| P-3 | PRODUCT | Backfill older reports? | **Isolated default ships:** no backfill; nothing is built. `lib/ingestion/select-values.ts` affects new writes only. Already on the user's list (sprint-09 P-3); nothing new. |
| PL-1 | TECHNICAL (planner) | Where `MAX_REPORTS_PER_FILING` lives | `lib/extraction/discovery.ts` (it applies the cap; extraction must not import ingestion), imported and re-exported by `run-daily.ts` next to the other budget constants. Not open. |
| PL-2 | TECHNICAL (planner) | `links`/`truncated` on the `found` result | Optional in the type, always set by `discoverLatestReport` (FL-4). A stub without them is a single-link discovery, so about 17 existing stubs stay valid. Not open. |
| PL-3 | TECHNICAL (planner) | Detail layout | The counts come first, then `; ` and the representative text (§2.5). Outcomes decided before any link is known keep today's text. Not open. |
| PL-4 | TECHNICAL (planner) | How the guard reaches `ingestEtf` | A guard function: optional in `IngestDeps`, required as `DailyRunDeps.ingest`'s second argument, wired by `createDailyRunDeps` (DD-G1). URL-skipped links are never guarded. "First PDF" = the first link that needs a download. Not open. |
| PL-5 | TECHNICAL (planner) | The URL read fails | `persist_error` for the ETF, no PDF request, every kept link counted as failed. Not open. |
| PL-6 | TECHNICAL (planner) | The same href twice in one row | Kept once (before the cap), so no duplicate request. Not open. |
| PL-7 | TECHNICAL (planner) | `= any(...)` vs `in (…)` | `in (…)` through Drizzle's array expansion: one statement, the same meaning, no driver difference in array parameters (§0.3). Not open. |
| PL-8 | TECHNICAL (planner) | Add-time budget tests and RB-3/RB-4 at `MAX_REQUESTS_PER_ETF = 5` | Bound by `MIN_REQUESTS_PER_ETF` (detection stays single-link, AC8), §0.1. Not open. |
| PL-9 | TECHNICAL (planner) | "Newest report stored" for the `ok` outcome | The greatest report date among the reports stored in this run. Not open. |

Nothing TECHNICAL is open. The only PRODUCT item has an isolated default. **Not blocked.**

## 6. Notes for the PO (information, nothing blocks)
- The story's "known limit" names "a manual run from `/admin/cron`". That page has no run button. The same-day manual
  run is the README's `curl` trigger, or Vercel's cron "Run" action. Nothing is built. A run button would be a new
  story, if wanted.

## 7. Implementation order
1. `discovery.ts` (`MAX_REPORTS_PER_FILING`, `findLatestFilingLinks`, wrapper, result type) + `test/helpers/filing-page.ts` + FL-1..FL-4. Existing discovery tests green.
2. `run-daily.ts` constants and guards + DL-8..DL-10 + RT-7b extension + CPG-4b/PG-7b re-pointed.
3. `store.ts` `findStoredReportUrls` + FS-1/FS-2 + an FS-P1 PGlite case in `store.pglite.test.ts` (only `ok` rows, only this ETF, only the listed URLs, date as text).
4. `select-values.ts` + SV-*. `outcome.ts` `formatFilingCounts` + `filing-outcome.ts` + FO-1..FO-8 (`filing-outcome.test.ts`: counts, priority, both tie-breaks, `valuesWritten` sum, truncated, the empty list, single-line detail).
5. `ingest-etf.ts` loop + `ingest-fakes.ts` + MF-1..MF-9; update the §3 unit tests.
6. `default-deps.ts` + DD-G1; `request-bound.test.ts` RB-6, DT-M1, NA-M1, RB-1..RB-4 edits.
7. PGlite: MFP-1..MFP-7, DV-1; the pglite/e2e updates in §3 (fixture-web day B).
8. Docs (data-model.md, README) + DM-1. Then all four gates with the three variables unset.

## 8. Files changed (expected)
- changed (source): `lib/extraction/discovery.ts`, `lib/ingestion/run-daily.ts`, `lib/ingestion/store.ts`,
  `lib/ingestion/select-values.ts`, `lib/ingestion/outcome.ts`, `lib/ingestion/ingest-etf.ts`,
  `lib/ingestion/default-deps.ts`
- new (source): `lib/ingestion/filing-outcome.ts`
- new (tests/helpers): `lib/extraction/discovery.filing.test.ts`, `lib/ingestion/filing-outcome.test.ts`,
  `lib/ingestion/ingest-filing.test.ts`, `lib/ingestion/ingest-filing.pglite.test.ts`,
  `lib/ingestion/default-deps.guard.pglite.test.ts`, `test/helpers/filing-page.ts`, `test/data-model-doc.test.ts`
- changed (tests/helpers): `test/helpers/ingest-fakes.ts`, `lib/ingestion/select-values.test.ts`,
  `lib/ingestion/ingest-etf.test.ts`, `lib/ingestion/ingest-etf.failures.test.ts`,
  `lib/ingestion/ingest-etf.pglite.test.ts`, `lib/ingestion/ingest-icbetnetf.pglite.test.ts`,
  `lib/ingestion/request-bound.test.ts`, `lib/ingestion/run-deadline.test.ts`, `lib/ingestion/store.test.ts`,
  `lib/ingestion/store.pglite.test.ts`, `lib/ingestion/default-deps.cron.test.ts`, `app/api/cron/daily/route.test.ts`,
  `app/chat/page.test.tsx`, `app/admin/etfs/page.test.tsx`, `test/e2e/fixture-web.ts`,
  `test/e2e/daily-pipeline.pglite.test.ts`
- changed (docs): `dev_minions/architecture/data-model.md`, `README.md`
- not touched: `drizzle/`, `lib/db/schema.ts`, `package.json`, `pnpm-lock.yaml`, `components/`, `app/globals.css`,
  `messages/*.json`, `lib/config/detect-adapter.ts`, `lib/monitoring/*`, `lib/cron/*`
