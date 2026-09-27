# US-030 plan — No-adapter degradation path, end to end
_Planner: story-planner (opus), 2026-09-27. Round 0._

Sources read: `backlog/stories/US-030.md` (incl. its tech-lead review, points 1–7 binding),
`backlog/sprints/sprint-07.md` (decisions 4–10), DEC-018 (§2, §4, §5), `architecture/data-model.md`
("Write rules"), and the code in `lib/ingestion/`, `lib/cron/`, `lib/config/`, `lib/monitoring/`,
`components/`, `app/etf/`, `app/api/cron/daily/`, `test/helpers/`, `drizzle/`.

No open TECHNICAL decision. The PRODUCT items (#4, #5, #9, #10) already ship isolated defaults per
the sprint file. So this plan is **not** blocked.

---

## 1. Acceptance criteria → proving tests

Test ids are new unless marked "changed". Every new test file stubs global `fetch` to throw
("real network forbidden") in `beforeEach`, as the existing ingestion tests do (AC10).

### AC1 — Schema and migration
| Check | Test |
|---|---|
| `etfReportLinks` in `lib/db/schema.ts` has `etf_id` integer PK NOT NULL, `source_url` text NOT NULL, `discovered_at` timestamptz NOT NULL with no default, and FK → `etfs.id` ON DELETE CASCADE | `lib/db/schema.test.ts`: **changed** "exports exactly the seven documented tables" → eight; **changed** "schema module exports" → eight keys; new `SC-9 etf_report_links columns`; new `SC-10 etf_report_links FK` (one FK, `etf_id → etfs.id`, cascade). The existing "exactly the three documented FKs" test iterates only its three tables and stays unedited. |
| `drizzle/0001_etf_report_links.sql` is additive | `lib/db/schema.test.ts` new `MG-1`: the journal has exactly 2 entries, idx 0 = `0000_init`, idx 1 = `0001_etf_report_links`, and each `.sql` exists. `MG-2`: the 0001 SQL has exactly one `create table`, which is `"etf_report_links"`, and exactly one `on delete cascade`. Every `alter table` in it targets `"etf_report_links"`. It contains no `drop`, and no `alter table` on any of the seven existing tables. The existing test that reads `entries[0]` stays unedited. |
| The PGlite helper applies every journal migration, in order | `test/helpers/pglite.migrations.test.ts` new: `PM-1` `createEmptyTestDatabase()` has `etf_report_links` (`select to_regclass('etf_report_links')` is not null). `PM-2` deleting an `etfs` row deletes its link row. `PM-3` every `drizzle/*.sql` file is listed in the journal, so no migration file can be silently skipped. |
| `data-model.md` documents the table and its write rule | Reviewer check (doc text). No automated test. |
| No agent applies the migration to Neon | **MANUAL-QA** (sprint-07 step 1): the user runs `DATABASE_URL=<neon-url> pnpm db:migrate` locally **before** deploying. Then `select * from etf_report_links;` in the Neon SQL editor returns an empty table, not an error. |

### AC2 — The form path stores the link (`lib/config/etfs.report-link.pglite.test.ts`, new)
Real `detectAdapter` with a mocked `fetchImpl` over `test/fixtures/bvb/BTBETRETF-instrument-2026-09-23.html`, routed at the new symbol's `bvbUrl`. The fixed clock `now` is `2026-09-27T08:00:00Z`.
- `RL-1` `detected` (default registry + the real PDF fixture): `etf_report_links` holds one row: `etf_id` = the new id, `source_url` = the fixture's newest PDF URL, `discovered_at` = the clock. The returned `AddEtfResult` is `toEqual` to today's shape, with no extra key. `adapter_key` is `brd-depositary`.
- `RL-2` table-driven. `no_match` (empty registry), `ambiguous` (two always-match adapters), `unreadable` (PDF route returns `%PDF-1.4 garbage`), `fetch_error` (PDF route 500). Each one: link row written, reason and `adapter_key` exactly as today.
- `RL-3` `not_found` (page with no `gv5News`) and discovery `error` (page 500): no link row.
- `RL-4` for every RL-1..RL-3 case: `reports`, `report_values` and `tracked_fields` row counts are 0 (FR4.2).
- `RL-5` `detectEtfAdapter` re-detect. With a newer clock, a found link replaces `source_url` and `discovered_at`. A later re-detect whose discovery is `not_found`, and another whose discovery is `error`, leave that row byte-identical. The returned `DetectEtfAdapterResult` shape is unchanged.
- `RL-6` `listEtfs` and the US-024 operations ETF read model return the same values for the ETF as before (`adapterAvailable: false`, adapter-missing flag).
- `RL-7` (AC8) the runner throws only for statements whose SQL contains `etf_report_links`. `addEtf` still returns `{ ok: true, action: "added", … }` and the `etfs` row exists. `detectEtfAdapter` still returns ok and has updated `adapter_key`.
- `RL-8` (AC8) the fixture's newest depositary row href is rewritten to `javascript:alert(1)`, and it is the only depositary row. Discovery gives `not_found`, so no link row is written.
- `RL-9` is a unit test in `lib/ingestion/report-links.test.ts`. `upsertReportLink` with a non-http(s) or non-`.pdf` URL makes no `run` call and returns `rejected_url` (defence in depth behind discovery's own rule).
- `lib/config/detect-adapter.test.ts`: DA-1, DA-4, DA-6, DA-7 and DA-8b are **changed**. Their `toEqual` gains `reportUrl: NEWEST_PDF_URL`, which is an additive, specified field (Task 2). DA-2, DA-3 and DA-8 are unchanged, and they now also prove there is no `reportUrl` when discovery did not find one. `lib/ingestion/request-bound.test.ts` RB-4 is **changed** the same way (`reportUrl: ICBETNETF_PDF_URL`).

### AC3 — The daily run's no-adapter branch
`lib/ingestion/ingest-no-adapter.test.ts` (new, unit, fetch spy + `FakeLinkStore`). Each test runs for `adapterKey: null` **and** for `"unknown-key"`:
- `NA-1` `found`: exactly 1 `fetch` call, to the instrument page; 0 download calls; `store.findReport`/`saveReport` 0 calls; `links.upsert` called once with `{ etfId, sourceUrl: <fixture newest PDF>, discoveredAt: <clock> }`. Outcome is `no_adapter`, detail `…; report link stored`.
- `NA-2` `not_found` and `error`: 1 fetch, 0 upserts. The detail says no link was stored, with the reason (`not_found: list_not_found`, or `discovery http_error 503`).
- `NA-3` no `reportDate` on the outcome (IF-1d stays green).
- `NA-4` (AC8) `discover` throws, or `links.upsert` rejects: `no_adapter`, one-line detail, and it resolves (`await expect(...).resolves`).
- `NA-5` isolation: a no-adapter ETF followed by the BTBETRETF ETF (adapter registered) gives `no_adapter` then `ok`. That is 3 fetch calls in total (1 + 2) and 1 `saveReport`.
- `NA-6` (AC8) discovery `found` with a URL that fails `isStorableReportUrl` (injected `discover` stub): no upsert. Detail `report link not stored: rejected url`.
- `NA-7` the outcome detail never contains the error text of a failed link write (sentinel in the thrown error → absent from the outcome and from `formatRunLog`).

`lib/ingestion/ingest-no-adapter.pglite.test.ts` (new, shipped statements):
- `NAP-1` real `createDrizzleReportLinkStore(db.mockDb, db.runner)` + `discoverLatestReport` over the fixture: a row is upserted. A second run with a later clock updates it. A third run whose page returns 500 leaves it unchanged. `reports`/`report_values` stay empty.
- `NAP-2` the default wiring path, with `getDb`/`neonBatchRunner` mocked to PGlite (the `app/chat/actions.pglite.test.ts` pattern) and global `fetch` routed to the fixtures. `runDailyIngestion(createDailyRunDeps({ now }), { startedAt, now })` stores the link row. This proves `createDailyRunDeps` wires `links` and `now`.
- `lib/ingestion/request-bound.test.ts` new `RB-5`: a no-adapter ETF over the BTBETRETF page makes exactly 1 request, which is ≤ `MAX_REQUESTS_PER_ETF`.

**Changed US-014 tests (sprint decision 7).** Each one is replaced by the AC3 behaviour and still asserts the new counts. No line is only dropped.
| Test | Today | After (AC3) |
|---|---|---|
| `ingest-etf.failures.test.ts` IF-1a "zero fetch/store calls" | `fetch` never called | Renamed "one discovery, no download, no store call". `discover` spy called once, `download` 0 times, `findReport`/`saveReport` 0 times, detail `no adapter: adapter_key not set; …` |
| IF-1b | exact detail string | Same assertions, plus `discover` called once. The detail keeps its prefix `no adapter: adapter_key "unknown-key" is not registered` and gains the link suffix. |
| IF-1c | `fetchImpl` called 2 times | 3 times (1 discovery for the no-adapter ETF + 2 for the next ETF); `saveReport` still 1 |
| IF-8a | 8 triggers | 9: `not_attempted` is produced via `runDailyIngestion` with a spent budget (AC7). The `no_adapter` trigger is unchanged apart from the `links`/`now` deps. |
| `ingest-etf.test.ts` "a call with no adapter makes zero fetch calls" | `fetch` never called | Renamed "no adapter makes exactly one discovery request and no download". The fixture page is routed, so exactly 1 call to the instrument page URL. |

Type-only edits, with no assertion changed: every `IngestDeps` literal and helper (`realDeps`, `makeDeps`, `stubPipelineDeps`, the IF-8b `build`s) gains `...linkDeps()`, i.e. `{ links: new FakeLinkStore(), now: FIXED_NOW }` from `test/helpers/ingest-fakes.ts`. The table cases "no adapter: null key/unknown key" in `ingest-etf.test.ts` keep their assertions (`no_adapter`, 0 store calls). `run-daily.test.ts` RD-* calls gain the second `budget` argument (`roomyBudget()`), with assertions unchanged. The same goes for the two `runDailyIngestion` calls in `lib/cron/daily-handler.test.ts` (H-15a and line 340). No other US-012/US-014 expectation changes.

### AC4 — Visible everywhere, with the link
- **Home loader**, `lib/monitoring/home-links.pglite.test.ts` (new, shipped `createHomeTableLoader`, rows inserted with explicit timestamps):
  - `HL-1` link only (no reports) → `latestPdfUrl` = link URL, `adapterAvailable: false`.
  - `HL-2` report `fetched_at` 10:00 is newer than link `discovered_at` 09:00 → the report's URL.
  - `HL-3` link 11:00 is newer than report 10:00 → the link's URL.
  - `HL-4` report `fetched_at` NULL + link → the link (tech-lead point 6).
  - `HL-5` equal timestamps → the report (strict `>`, documented).
  - `HL-6` neither → `null`, and `latestPdfUrl` never equals `bvb_url` in any case.
  - `HL-7` an inactive ETF's link does not produce a row.

  The existing `home.pglite.test.ts` AC4 tests stay unedited: newest-of-any-status, no report → null.
- **Home render**, `components/HomeTable.test.tsx` new `HT-L`. A row with `adapterAvailable: false` and `latestPdfUrl` set renders `<a href=… target="_blank" rel="noopener noreferrer">SYM</a>` **and** the marker, in ro and en.
- **Detail page**:
  - `lib/monitoring/history.pglite.test.ts`: **changed** line 113 `toEqual` gains `adapterAvailable: true` (additive). New `HP-A` covers NULL key → false, unregistered key → false, registered key → true, using the same rule as `home.ts`.
  - `components/EtfDetail.test.tsx` new `ED-M1`: the marker appears before the `noTrackedFields`/`noHistory` text when `adapterAvailable` is false, and is absent when true.
  - `ED-M2`: ro shows `EtfDetail.extractionUnavailable` (ro) and not the en text, and vice versa.
  - `app/etf/[symbol]/page.test.tsx`: fixture types gain `adapterAvailable`. One new case renders the marker through the page.
- **Dashboard.** Existing US-024 coverage already shows the flag. New `components/admin/OperationsDashboard.test.tsx` `OD-NA`: a run log line `XYZ no_adapter no adapter: adapter_key not set; report link stored` renders the translated `no_adapter` text in ro and en.
- **Formatters.** No new value, date or timestamp is rendered. The link is an attribute and the marker is a message. The reviewer checks that no new `toLocale*`/`Intl` call is added.

### AC5 — The same end state via the chat (`app/chat/add-paths.pglite.test.ts`, new)
This test uses two PGlite databases, both seeded. The mocks are the ones in `app/chat/actions.pglite.test.ts`: `getDb`, `neonBatchRunner`, provider registry, `next/cache`. `detectAdapter` is mocked to `{ adapterKey: null, reason: "no_match", reportUrl: URL }`. `Date` is faked to a fixed instant.
- `AP-1` DB A: `addEtfAction` with form `{ symbol: "XYZ", name: "XYZ" }`. DB B: `sendChatMessageAction("add ETF XYZ")`, where the fake provider returns `{"action":"add_etf","symbol":"XYZ","name":null}`, so the name defaults to the symbol. The test compares, in each database, the `etfs` row without `id`/`created_at`, the `etf_report_links` row without `etf_id`/`discovered_at`, and the home-table row from `createHomeTableLoader`. They are deep-equal.
- `AP-2` the chat reply is `messageKey: "addedNoAdapter"`. `ChatReply` rendered in ro and en shows each locale's `addedNoAdapter` text and not the other locale's.
- `AP-3` in both databases `reports`/`report_values`/`tracked_fields` are empty for XYZ.

### AC6 — Recovery (`lib/ingestion/recovery.pglite.test.ts`, new)
- `RC-1` An ETF with `adapter_key` NULL goes through `ingestEtf`, and the link is stored with the clock at `2026-01-01`. Then `setEtfAdapter({ adapterKey: "brd-depositary" })` and `trackField` (shipped `lib/config`). The next `ingestEtf` over the BTBETRETF fixtures gives `ok`, 2 requests, and exactly one `reports` row with `status = 'ok'` (DEC-010 path).
- `RC-2` `createHomeTableLoader` then gives `adapterAvailable: true`, the values, and `latestPdfUrl` = the report's `source_url`. The report's `fetched_at` (real download clock) is newer than the 2026-01-01 link.
- `RC-3` The same recovery after a re-detect that returns `detected` (real `detectAdapter` over the fixtures). The `reports` row count is exactly 1, and `createEtfHistoryLoader` returns exactly 1 row, so there is no backfill.

### AC7 — Run deadline guard
- `lib/ingestion/run-deadline.test.ts` (new). The fake clock is a mutable `t`, and the fake `ingest` advances it; nothing sleeps.
  - `DL-1` A at start+1 s (fits), advance 30 s. B at 31 s: `31 000 + 24 000 = 55 000 ≤ 60 000`, so it starts; advance 10 s. C at 41 s does not fit, so it gets `not_attempted`, and so does D. `ingest` is called exactly for A and B.
  - `DL-2` exact equality (`now + worstCase === deadline`) starts the ETF.
  - `DL-3` A's and B's outcomes are the real ones (`toBe` the returned objects).
  - `DL-4` the `not_attempted` detail is one line, with no newline.
  - `DL-5` an inactive ETF after the deadline is still skipped, not reported.
  - `DL-6` `summarizeRun` counts `not_attempted` as an error: status is `partial` with A ok, and `failed` when every ETF is `not_attempted`.
  - `DL-7` the guard uses `etfWorstCaseMs()` and `runDeadlineMs()`. The source of `run-daily.ts` contains no numeric literal other than the named constants' definitions (reviewer check plus a small source-scan test).
- `lib/cron/daily-job.test.ts` new `DJ-S`: `runIngestion` receives `{ startedAt }` equal to (the same instant as) the value passed to `startRun`. `now()` was read before `failStaleRuns` (call-order spy).
- `lib/cron/deadline.pglite.test.ts` (new) `DJP-1`: `runDailyJob` + real `createDrizzleJobRunStore` on PGlite + `runDailyIngestion` with the fake clock and fake ingest (A ok, B `not_attempted`). The `job_runs` row is `partial`, `finished_at` is not NULL, `errors_count = 1`, and the log has one line per ETF, including `B not_attempted …`.
- `lib/cron/default-deps.test.ts` new `CD-3`: calling the `runIngestion` arg captured from the `runDailyJob` mock with `{ startedAt }` calls `createDailyRunDeps` with a `now` function (mocked `loadEtfs` → `[]`).
- `app/api/cron/daily/route.test.ts`:
  - **RT-7b replaced** by "RT-7b: one ETF's worst case plus allowances fits in CRON_MAX_DURATION_S". It asserts `MAX_REQUESTS_PER_ETF × CRON_FETCH_TIMEOUT_MS + PARSE_ALLOWANCE_MS + FINISH_RESERVE_MS ≤ CRON_MAX_DURATION_S × 1000`.
  - It also computes `maxFitting = floor((CRON_MAX_DURATION_S×1000 − PARSE_ALLOWANCE_MS − FINISH_RESERVE_MS) / CRON_FETCH_TIMEOUT_MS)`, asserts `MAX_REQUESTS_PER_ETF ≤ maxFitting`, and asserts `etfWorstCaseMs(maxFitting + 1) > CRON_MAX_DURATION_S × 1000`, so the check fails if the constant grows past the budget.
  - It has no ETF count.
  - New `RT-7d`: `route.maxDuration === CRON_MAX_DURATION_S`.
  - RT-7a and RT-15 are unedited.
- `lib/ingestion/outcome.test.ts` OC-8a **changed** from 8 codes to 9 (`not_attempted` last). `job-run-summary.test.ts` JS-3a **changed**: `not_attempted` is added to its error-code list. `lib/admin/operations-messages.test.ts` OM-1 iterates `INGEST_OUTCOME_CODES` and forces both catalogue keys with no edit. `lib/admin/run-log.test.ts` line 112's hard-coded list gains `not_attempted` so the parser round-trips it.
- `OD-NA2` in `OperationsDashboard.test.tsx`: a `not_attempted` log line renders the translated text in ro and en, and not the other locale's.

### AC8 — Failure handling and link safety
NA-4, NA-6, NA-7 (ingestion), RL-7, RL-8, RL-9 (config/store). Pages:
- `app/page.test.tsx`: new case. A loader rejection with `relation "etf_report_links" does not exist` renders the existing translated `Home.loadError` and not the message text (US-016 AC9 pattern).
- `app/etf/[symbol]/page.test.tsx`: the existing error case is unchanged.

### AC9 — Bilingual
- The existing ro/en key-parity test passes with the new keys `EtfDetail.extractionUnavailable` and `Admin.operations.outcome.not_attempted`.
- ED-M2, OD-NA2 and AP-2 are the per-locale render tests.

### AC10 — Offline and shipped statements
- Each PGlite test above executes the shipped builders: `createHomeTableLoader`, `createEtfHistoryLoader`, `addEtf`, `detectEtfAdapter`, `createDrizzleReportLinkStore`, `createDrizzleJobRunStore`.
- Every new file stubs global `fetch` to throw and uses fixtures through an injected or stubbed `fetchImpl`.
- Tester check: `grep -L "stubGlobal(\"fetch\"" <new test files>` is empty.

### AC11 — Gates
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and
`env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build`. There is no `package.json` dependency change. The tester confirms the manifests are absent from "Files changed" (LB-7 still green).

**MANUAL-QA** (live, user; sprint-07 steps 1 and 4):
1. Migrate Neon before deploying (AC1 row above).
2. Add an unmonitored fund unit through `/admin/etfs`, then (after removing it) through `/chat`. Each time:
   - the admin list shows adapter "none";
   - the home row shows "extraction unavailable", and its symbol opens that fund's newest report PDF (or is plain text if bvb.ro lists none);
   - `/etf/<SYMBOL>` shows the marker;
   - after the next run, `/admin/operations` shows `partial` with a translated "adapter missing" line;
   - remove it at the end.
3. After the next scheduled run, the Vercel function duration is well under 60 s and no `not_attempted` line appears for the current ETF count.

---

## 2. Files and boundaries

**New**
- `lib/ingestion/report-links.ts` is the only writer of `etf_report_links`. It contains:
  - `ReportLinkStore = { upsertReportLink(i: { etfId; sourceUrl; discoveredAt: Date }): Promise<"written" | "rejected_url"> }`;
  - `isStorableReportUrl(url)`: absolute `http:`/`https:` with a pathname ending `.pdf`, the same rule as `discovery.ts` `resolvePdfHref`;
  - `buildUpsertReportLinkStatement(db, input)`: `insert … on conflict ("etf_id") do update set "source_url" = excluded."source_url", "discovered_at" = excluded."discovered_at"`;
  - `createDrizzleReportLinkStore(db, run = neonBatchRunner(db))`: one statement per call, never batched with a `reports` write (DEC-018 §4).
- `drizzle/0001_etf_report_links.sql` + `drizzle/meta/0001_snapshot.json` + journal entry. These are generated, never hand-written: `env -u DATABASE_URL pnpm db:generate --name etf_report_links`.
- Tests listed in §1, plus `FakeLinkStore`, `linkDeps()` and `roomyBudget()` in `test/helpers/ingest-fakes.ts`.

**Changed**
- `lib/db/schema.ts`: adds `etfReportLinks`.
- `test/helpers/pglite.ts`: reads `drizzle/meta/_journal.json`, sorts by `idx` and applies each `${tag}.sql` split on `--> statement-breakpoint`.
- `lib/ingestion/outcome.ts`:
  - `not_attempted` is appended to `INGEST_OUTCOME_CODES`;
  - `(Base & { code: "not_attempted" })` joins the union;
  - a `formatNoAdapterDetail(base, link)` helper gives one line built from fixed words, `kind` and `httpStatus`, never an error message.
- `lib/ingestion/ingest-etf.ts`:
  - `IngestDeps` gains `links: ReportLinkStore` and `now: () => Date` (separate from `store`, tech-lead point 4);
  - the `!adapter` branch becomes `ingestNoAdapter(etf, deps)`: one `discover`, an upsert only on `found` with a storable URL, each step in its own try, always returns `no_adapter`.
  - The adapter path is byte-for-byte unchanged. The header comment is updated.
- `lib/ingestion/run-daily.ts`:
  - `CRON_MAX_DURATION_S = 60`, `PARSE_ALLOWANCE_MS = 5_000` and `FINISH_RESERVE_MS = 5_000`;
  - `etfWorstCaseMs(requests = MAX_REQUESTS_PER_ETF)`, `runDeadlineMs(startedAt)` and `canStartEtf(now, startedAt)`;
  - `RunBudget = { startedAt: Date; now: () => Date }`;
  - `runDailyIngestion(deps, budget)`: the guard runs after the `isActive` skip and before `ingest`.
- `lib/ingestion/default-deps.ts`: `createDailyRunDeps({ now, fetchTimeoutMs? })` (`now` required, because BD-3 forbids a clock in `lib/ingestion`) wires `links: createDrizzleReportLinkStore(db)` and `now`. `createDefaultIngestDeps(now)` gets the same.
- `lib/cron/daily-job.ts`: `runIngestion: (ctx: { startedAt: Date }) => Promise<DailyRunSummary>`, called with the `startedAt` already taken before the stale sweep.
- `lib/cron/default-deps.ts`: one `const now = () => new Date()` shared by `runDailyJob`, `createDailyRunDeps({ now })` and the budget.
- `lib/config/detect-adapter.ts`: `DetectionResult` gains `reportUrl?: string`, set whenever discovery returned `found` (including a later `internal_error`, Task 2 "whatever the adapter outcome"). `DetectionReason` is unchanged. BC-3 stays green, because the file still writes nothing.
- `lib/config/etfs.ts`:
  - `EtfConfigDeps` gains `now: () => Date`;
  - `addEtf` runs the link upsert after the insert, as its own `run`, keyed by the returned id, only when `reportUrl` is present, in a `try` whose failure is swallowed;
  - `detectEtfAdapter` selects `"id"` too and does the same after its `adapter_key` update.
  - `AddEtfResult`/`DetectEtfAdapterResult` are unchanged, so admin `result-messages` and chat `reply-messages` stay byte-identical.
- `lib/config/default-deps.ts`: `createEtfConfigDeps` adds `now: () => new Date()`.
- `lib/monitoring/home.ts`: `buildLatestReportLinksStatement` becomes one SQL statement (it stays five statements per batch). The SQL is in §4.
- `lib/monitoring/history.ts`: `buildHistoryEtfStatement` also selects `adapter_key`. `createEtfHistoryLoader(db, run?, registry = defaultAdapterRegistry)`. `EtfHistory.etf.adapterAvailable` uses the same rule as `home.ts`.
- `components/EtfDetail.tsx`: `{!etf.adapterAvailable && <p data-extraction-unavailable>{t("extractionUnavailable")}</p>}` directly under the `<h1>`, and nothing else.
- `app/api/cron/daily/route.ts`: unchanged (the literal `maxDuration = 60` stays).
- `messages/ro.json`, `messages/en.json`:
  - `EtfDetail.extractionUnavailable` has the same text as `Home.extractionUnavailable` ("extragere indisponibilă" / "extraction unavailable");
  - `Admin.operations.outcome.not_attempted` is "neîncercat (limita de timp a rulării)" / "not attempted (run time limit)".
- `dev_minions/architecture/data-model.md`:
  - a new `etf_report_links` table section;
  - a Write-rules bullet: one row per ETF, one upsert statement, written only by detection (add/re-detect) and the daily run's no-adapter branch, never batched with a `reports` write, never read as a report, a failed write never fails the ETF insert or the outcome, a run that finds nothing keeps the row;
  - the `job_runs.log` bullet mentions `not_attempted`.
- Tests changed as listed in §1. `test/helpers/ingest-fakes.ts` gains the fakes.
- `lib/ingestion/boundaries.test.ts` new `BD-16`: across `lib/**` non-test files, only `lib/ingestion/report-links.ts` contains `insert into "etf_report_links"` or `update "etf_report_links"`. Also, the only reader outside tests is `lib/monitoring/home.ts`.

**Boundaries.**
- `lib/config/etfs.ts` imports the statement builder from `../ingestion/report-links`, the same direction as its existing `../ingestion/store` import. BC-2 stays green because this is not concrete I/O.
- `app/` gets no SQL (`app/actions.boundary.test.ts` stays green).
- Adapters are untouched (no I/O, US-009).

Optional, no AC: fix the Sprint 4 audit N6 cosmetic test names in `EtfDetail.test.tsx`/`page.test.tsx` while those files are open.

---

## 3. Data model and migration
- There is one additive table, as in §2 and DEC-018 §4. Here is the Drizzle definition:
  `etfId: integer("etf_id").primaryKey().references(() => etfs.id, { onDelete: "cascade" })`,
  `sourceUrl: text("source_url").notNull()`,
  `discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull()`.
- The migration is generated locally with `DATABASE_URL` unset (`drizzle-kit generate` never connects). `0000_init.sql` is untouched.
- **Never** run `pnpm db:migrate` (the user does it, MANUAL-QA 1). The QA checklist lists the migration first, before the deploy. Deploying first gives the home page its translated error state until the migration runs. Daily run and add/re-detect survive a missing table, by AC8.

---

## 4. Risks and the smallest design

- **R1 — Link-rule comparison across drivers.** PGlite returns `timestamptz` as `Date`, and Neon HTTP returns it as a string. So the comparison lives in SQL, never in TS. The statement:
  ```sql
  select "e"."id" as "etf_id",
         case when "l"."source_url" is not null
                and ("r"."source_url" is null or "r"."fetched_at" is null or "l"."discovered_at" > "r"."fetched_at")
              then "l"."source_url" else "r"."source_url" end as "source_url"
  from "etfs" "e"
  left join (select distinct on ("etf_id") "etf_id", "source_url", "fetched_at" from "reports"
             where "source_url" is not null order by "etf_id", "report_date" desc, "id" desc) "r" on "r"."etf_id" = "e"."id"
  left join "etf_report_links" "l" on "l"."etf_id" = "e"."id"
  where "e"."is_active" = true and ("r"."source_url" is not null or "l"."source_url" is not null)
  ```
  "Newest report" keeps US-016's order, and a tie goes to the report. HL-1..HL-7 pin the behaviour.
- **R2 — `discovered_at` vs `fetched_at` come from two clocks.** `fetched_at` comes from `downloadReportPdf`'s `new Date()`. `discovered_at` comes from the injected `now`, which in production is `new Date()` on the same server. The only real case where they compete is a same-day re-detect, where both URLs are the newest discovery anyway.
- **R3 — Deps churn.**
  - `IngestDeps`, `EtfConfigDeps`, `createDailyRunDeps` and `runDailyIngestion` gain required members. That is deliberate: optional members would let production silently skip the link or the guard.
  - The price is type-only edits in existing tests, done with the `linkDeps()`/`roomyBudget()` helpers.
  - The reviewer diffs those files and confirms that only deps literals and the tests listed in §1 changed.
  - `app/**` tests that mock `createEtfConfigDeps: () => ({})` are unaffected.
- **R4 — Guard constants are estimates.**
  - `PARSE_ALLOWANCE_MS` (5 s) covers `unpdf` text extraction plus the Neon report batch.
  - `FINISH_RESERVE_MS` (5 s) covers `summarizeRun` + `finishRun` + the response, plus boot time before `startedAt`.
  - The per-ETF check is 24 s, so an ETF starts only while `now ≤ startedAt + 36 s`. Worst case, with every request timing out, 3 ETFs finish and the 4th is `not_attempted`. Typically many more fit.
  - `fetchOnce` enforces a hard per-request timeout (`lib/extraction/http.ts`), so `CRON_FETCH_TIMEOUT_MS` is a true bound. Parse time is not; the allowance is the documented assumption.
- **R5 — Detail text safety.** The `no_adapter`/`not_attempted` details are built only from fixed words, the discovery `kind` and `httpStatus`. They never contain `discovery.message`, a DB error text or the URL. `formatRunLog` redaction remains the second line (NA-7).
- **R6 — Reactivation.** `addEtf`'s reactivate path runs no detection, so it writes no link and keeps any old row (cascade only on delete). This is existing behaviour and is not changed.
- **Extensibility kept minimal.**
  - `ReportLinkStore` is one method.
  - Only a URL access is stored. DEC-018 §2's form-post descriptor does not exist in the code today (US-029 needed none), so there is nothing to exclude beyond `status === "found"` + `isStorableReportUrl`.
  - There is no table-missing fallback in the loader (tech-lead point 7).

---

## 5. Decisions needed

No TECHNICAL item is open. DEC-018 §4–§5 and tech-lead points 1–7 settle the storage, the upsert statement, the deadline formula and the wiring. The constant values in R4 are a design choice inside DEC-018 §5, and the reviewer or tech-lead may adjust them without changing the design.

| # | Type | Question | Isolated default shipped | Code holding it |
|---|---|---|---|---|
| sprint #4 | PRODUCT | Where does the symbol link when no PDF URL is known? | Yes: plain text, as in US-016 AC4 | `lib/monitoring/home.ts` `buildLatestReportLinksStatement`, `components/HomeTable.tsx` (unchanged) |
| sprint #5 | PRODUCT | What is "a link to its report"? | Yes: the newest depositary PDF link discovery finds, kept until a newer one is found | `lib/ingestion/ingest-etf.ts` `ingestNoAdapter`, `lib/config/detect-adapter.ts` `reportUrl`, `lib/config/etfs.ts` link upserts, `lib/monitoring/home.ts` link rule |
| sprint #9 | PRODUCT (carried) | Should re-detect keep a working adapter on a transient error? | Yes: unchanged, US-020 AC7's literal reading | `lib/config/etfs.ts` `detectEtfAdapter` (its `adapter_key` update line is untouched) |
| sprint #10 | PRODUCT | Should the detail page show the marker? | Yes: the marker is shown | `components/EtfDetail.tsx` marker line + `lib/monitoring/history.ts` `adapterAvailable`. Removing it drops AC4's detail-page bullet only |

All four are already on the user's list (`status.md` P12–P15, HANDOVER "Waiting on the user"). Nothing new to add.
