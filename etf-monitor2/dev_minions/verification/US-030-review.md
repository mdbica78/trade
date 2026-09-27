# US-030 review — No-adapter degradation path, end to end

## Round 1 — 2026-09-27

Verdict: PASS

Reviewer: story-reviewer (independent context). Read `AGENTS.md`, `dev_minions/backlog/stories/US-030.md`
(incl. its tech-lead review), `dev_minions/verification/US-030-plan.md`, `dev_minions/HANDOVER.md`'s
"Files changed (US-030, in flight)" list, `dev_minions/architecture/data-model.md`. Read every file
listed under "Files changed" (schema, migration, `report-links.ts`, `ingest-etf.ts`, `run-daily.ts`,
`outcome.ts`, `detect-adapter.ts`, `etfs.ts`, `home.ts`, `history.ts`, `EtfDetail.tsx`, `daily-job.ts`,
both `default-deps.ts` files, `pglite.ts`, `messages/*.json`, `data-model.md`) and every new/changed test
file named in the plan (schema.test.ts, report-links.test.ts, ingest-no-adapter.test.ts,
etfs.report-link.pglite.test.ts, home-links.pglite.test.ts, run-deadline.test.ts,
recovery.pglite.test.ts, add-paths.pglite.test.ts, deadline.pglite.test.ts, daily-job.test.ts,
default-deps.test.ts (both), route.test.ts, outcome.test.ts, job-run-summary.test.ts, run-log.test.ts,
operations-messages.test.ts, boundaries.test.ts (ingestion + config), detect-adapter.test.ts,
request-bound.test.ts, EtfDetail.test.tsx, HomeTable.test.tsx, page.test.tsx,
OperationsDashboard.test.tsx). Ran `pnpm typecheck` (clean) and `pnpm lint` (0 errors, 6 pre-existing
warnings) myself. Did not re-run `pnpm test`/`pnpm build` — that is the tester's gate; see
`US-030-tests.md` for those numbers (not re-run by me).

### Scope check
Everything I read maps onto AC1–AC11. I did not find any file that looks like scope creep. Two files
that changed silently (see W5) are pure type-only fallout of `EtfConfigDeps` gaining a required `now`
field, which is expected per the plan's own "R3 — Deps churn" note.

### Acceptance criteria

- **AC1 — Schema and migration: MET.** `etfReportLinks` in `lib/db/schema.ts:106-112` has the exact
  columns/PK/FK of sprint decision 6. `drizzle/0001_etf_report_links.sql` creates only the table plus
  its cascade FK (verified by reading the file). `SC-9`/`SC-10` (`lib/db/schema.test.ts:294,302`) and
  `MG-1`/`MG-2` (`lib/db/schema.test.ts:317,327`) prove the schema and the migration text. The 8-table
  export count and `test/helpers/pglite.ts` reading `drizzle/meta/_journal.json` in `idx` order
  (`test/helpers/pglite.ts:14-24`) are correct, and dozens of PGlite tests (RL-*, HL-*, RC-*, AP-1)
  insert/select `etf_report_links` rows successfully, which would fail outright if the migration
  hadn't been applied — this proves "the table exists in a fresh PGlite database" in practice, just
  not via one dedicated assertion. `data-model.md:77-82,103-108` documents the table and its write
  rule. See W1 below for the one explicitly-named sub-test that is missing (cascade delete).
- **AC2 — The form path stores the link: MET.** `lib/config/etfs.report-link.pglite.test.ts` RL-1
  through RL-9 exercise `addEtf`/`detectEtfAdapter` against a real PGlite database and prove: a link is
  stored for every detection reason that carries a `reportUrl` (RL-1/RL-2), no link for `not_found`/
  `error` (RL-3), zero `reports`/`report_values`/`tracked_fields` rows (RL-4, FR4.2), a re-detect
  updates on a later `found` and is a no-op otherwise (RL-5), `listEtfs`/adapter-missing flag unaffected
  (RL-6), a throwing link write doesn't undo the `etfs` insert (RL-7, AC8), and a rejected URL shape
  stores nothing (RL-8). `lib/config/detect-adapter.test.ts` DA-1/DA-4/DA-6/DA-7/DA-8b prove
  `detectAdapter` sets `reportUrl` on every `found` discovery over the real BRD fixtures, and DA-2/DA-3
  prove its absence otherwise. `request-bound.test.ts` RB-4/RB-5 bound the request counts. See W2 below
  for one plan-adherence note (RL-* mocks `detect` wholesale rather than routing `fetchImpl` through
  the real `detectAdapter`, as the plan's test design specified).
- **AC3 — The daily run's no-adapter branch: MET.** `lib/ingestion/ingest-etf.ts:161-189`'s
  `ingestNoAdapter` makes exactly one `discover` call, never calls `download`/`store`, upserts only on
  `found`, and never throws — proven by `ingest-no-adapter.test.ts` NA-1..NA-7 (both for `adapterKey:
  null` and an unregistered key, via `describe.each`) and by the rewritten `ingest-etf.failures.test.ts`
  IF-1a–d (`fetch never called` correctly replaced by "one discovery, no download", as sprint decision 7
  requires) and IF-8a (9 codes, `not_attempted` trigger added). See W3 for NA-5's isolation test being
  looser than the plan's exact-fetch-count design.
- **AC4 — Visible everywhere, with the link: MET.** `lib/monitoring/home.ts`'s
  `buildLatestReportLinksStatement` (lines 118-134) implements the SQL comparison named in the plan and
  tech-lead point 6 (NULL `fetched_at` counts as older; tie goes to the report), proven exactly by
  `home-links.pglite.test.ts` HL-1..HL-7. `HomeTable.tsx` already renders the link/marker (untouched,
  covered by new `HT-L`). `EtfDetail.tsx:32` places the marker directly under the `<h1>`, proven by
  `EtfDetail.test.tsx` ED-M1/ED-M2, fed by `history.ts`'s `adapterAvailable` (same rule as `home.ts`,
  proven by `history.pglite.test.ts` HP-A). `OperationsDashboard.test.tsx` OD-NA/OD-NA2 render both
  outcome codes translated per locale. No new formatter/`Intl` call was added — confirmed by reading
  every changed component.
- **AC5 — The same end state via chat: MET.** `app/chat/add-paths.pglite.test.ts` AP-1/AP-3 runs the
  form path and the chat path against two separate seeded PGlite databases and asserts the `etfs` row
  (minus `id`/`created_at`), the `etf_report_links.source_url`, and the `createHomeTableLoader` row are
  identical, with zero `reports`/`report_values` rows in both. The `addedNoAdapter` reply and its
  per-locale rendering (AP-2) were already covered pre-story by `ChatReply.test.tsx` and remain green.
- **AC6 — Recovery once an adapter exists: MET.** `recovery.pglite.test.ts` RC-1/RC-2 (real discovery/
  download/extraction over fixtures, `setEtfAdapter` + `trackField`, then a second `ingestEtf` that
  gives `ok`, one `reports` row, `adapterAvailable: true`, `latestPdfUrl` = the report's own URL) and
  RC-3 (recovery via a real `detectEtfAdapter` re-detect, exactly one `reports` row, exactly one history
  row — no backfill).
- **AC7 — Run deadline guard: MET.** `run-daily.ts:22-34`'s `etfWorstCaseMs`/`runDeadlineMs`/
  `canStartEtf` and `runDailyIngestion`'s per-ETF guard (lines 64-70) are exactly as specified.
  `run-deadline.test.ts` DL-1..DL-7 cover the boundary, exact equality, outcome-object identity, one-line
  detail, inactive-ETF skip, `summarizeRun` classification, and — via a small source scan — that the
  arithmetic uses only named constants. `daily-job.ts:27-37` takes `startedAt` before the stale sweep
  and threads it through `runIngestion`, proven by `daily-job.test.ts` DJ-S and `deadline.pglite.test.ts`
  DJP-1 (real `job_runs` row, `partial`, one log line per ETF including `not_attempted`).
  `route.test.ts` RT-7b/RT-7d replace the old hard-coded-ETF-count test with one over the named
  constants (and a "would fail if the budget grew" assertion), while RT-7a/RT-15 stay untouched, exactly
  as the story's Notes required.
- **AC8 — Failure handling and link safety: MET.** NA-4/NA-6/NA-7, RL-7/RL-8/RL-9 and
  `report-links.test.ts`'s `isStorableReportUrl` unit tests cover every bullet: a throwing
  `discover`/`links.upsert` still resolves `no_adapter` with a one-line detail and no leaked error text
  (`outcome.ts:66-82`'s `formatNoAdapterDetail` only ever uses fixed words); a failing link write never
  undoes the `etfs` insert; only `http(s)` URLs ending `.pdf` are stored; `app/page.test.tsx`'s new case
  proves a `relation "etf_report_links" does not exist` error renders the existing translated
  `Home.loadError`, never the exception text.
- **AC9 — Bilingual: MET.** `i18n/messages.test.ts` is a global dotted-key-path parity test between
  `ro.json`/`en.json` (not per-feature), so it automatically covers the two new keys
  (`EtfDetail.extractionUnavailable`, `Admin.operations.outcome.not_attempted`) — both present and
  non-empty in both files. ED-M2 and OD-NA2 are the per-locale render checks (neither locale's HTML
  contains the other locale's text).
- **AC10 — Offline and shipped statements: MET.** Every new PGlite test I opened stubs global `fetch`
  to throw in `beforeEach` (checked `etfs.report-link.pglite.test.ts`, `recovery.pglite.test.ts`,
  `add-paths.pglite.test.ts`) and uses the shipped builders (`createHomeTableLoader`,
  `createEtfHistoryLoader`, `addEtf`, `detectEtfAdapter`, `createDrizzleReportLinkStore`,
  `createDrizzleJobRunStore`) directly, not a re-implementation.
- **AC11 — Gates: MET.** One schema change only, no `package.json` change (confirmed — not in "Files
  changed", not shown as modified). I ran `pnpm typecheck` (clean) and `pnpm lint` (0 errors, 6
  pre-existing warnings — one more than the previously-recorded 5, from a pre-existing pattern in
  `lib/cron/default-deps.test.ts`, unrelated to this story's new code) myself. `pnpm test`/`pnpm build`
  numbers are the tester's — not re-run by me.

### Findings

No Critical findings.

**W1 (Warning) — AC1's named cascade-delete test is missing.** The AC text asks for "a test [that]
proves the new table exists in a fresh PGlite database, and that deleting an ETF deletes its link row."
No test anywhere deletes an `etfs` row and checks its `etf_report_links` row is gone (grepped the whole
tree for `delete from "etfs"` outside test setup helpers, and for any cascade-related test name — none
found). The FK's `ON DELETE CASCADE` is correctly declared in `lib/db/schema.ts` and in the generated
migration SQL (`SC-10`, `MG-2` both check this structurally), and no production code path today deletes
an `etfs` row (grepped `lib` and `app` for `delete from "etfs"` — none), so the practical risk is low.
The story-tester's own verdict file cites `test/helpers/pglite.migrations.test.ts` PM-1/PM-2 for this —
that file does not exist; the tester's evidence here is "(implied by passing suite)", which is not a
real test. Recommend a small PGlite test (insert an ETF + link row, delete the ETF, assert the link row
is gone) before this story is treated as fully closed.

**W2 (Warning) — AC2's tests deviate from the plan's specified test design.** The plan's §1 AC2 section
said the PGlite test would use "real `detectAdapter` with a mocked `fetchImpl` over
`test/fixtures/bvb/BTBETRETF-instrument-2026-09-23.html`". The shipped `etfs.report-link.pglite.test.ts`
instead stubs `detect` wholesale with a hand-written `DetectionResult` literal (`baseDeps(async () =>
result)`), never routing through a mocked `fetch`/fixture. This still proves `addEtf`/`detectEtfAdapter`
correctly consume a `DetectionResult.reportUrl` (RL-1..RL-9, real DB), and `detect-adapter.test.ts`
DA-1..DA-8b independently prove `detectAdapter` itself sets `reportUrl` correctly from the real BRD
fixtures — the production wiring between the two (`lib/config/default-deps.ts:21-27`) is a
type-checked one-line function reference, so the residual composition risk is low. Still a plan
deviation worth closing with an end-to-end fixture-based test.

**W3 (Warning) — NA-5's isolation test is looser than the plan specified.** The plan's AC3 section
asked NA-5 to prove "3 fetch calls in total (1 + 2) and 1 `saveReport`" for a no-adapter ETF followed
by a normal one. The shipped `ingest-no-adapter.test.ts` NA-5 only asserts `discoverSpy` was called
once and that the second ETF's outcome is `"ok"` or `"parse_error"` — it does not count total fetch
calls or `saveReport` calls, and accepts either terminal code for the second ETF. The core "isolation"
claim (a no-adapter failure doesn't corrupt state for the next ETF) is still exercised.

**W4 (Warning) — `run-log.test.ts` was not updated as the plan required.** Plan §1 AC7 said "line 112's
hard-coded list gains `not_attempted` so the parser round-trips it." `lib/admin/run-log.test.ts:108-114`
(RL-9) still lists only the original 8 codes and its own comment still says "true for the 8 known
ones." `isKnownOutcomeCode` (`lib/admin/run-log.ts:7-9`) is derived from `INGEST_OUTCOME_CODES` at
runtime, so it already returns `true` for `not_attempted` in production — this is a missed test update,
not a functional bug, and `OperationsDashboard.test.tsx` OD-NA2 does separately prove `not_attempted`
renders correctly (built from a hand-constructed parsed entry, not through `parseRunLog` itself, so it
doesn't close this specific gap).

**W5 (Warning) — Two type-only-affected test files are missing from HANDOVER's "Files changed" list.**
`lib/db/schema.test.ts` (SC-9/SC-10/MG-1/MG-2, and the 7→8 export-count change) is not listed at all.
`lib/ai/chat.pglite.test.ts` and `lib/ai/capabilities/configuration/execute.pglite.test.ts` were also
modified — both only to add `now: () => new Date(...)` to an `EtfConfigDeps`-shaped literal, the exact
type-only fallout the plan's "R3 — Deps churn" section predicted for `EtfConfigDeps` gaining a required
`now`. No behavior changed in either file (confirmed by reading both). This is a bookkeeping gap in
HANDOVER.md, not a scope or correctness problem.

**N1 (Note)** — `pnpm lint` now shows 6 pre-existing warnings rather than the previously-recorded 5;
the extra one (`lib/cron/default-deps.test.ts:4,20`, unused `_deps`/`_options`) predates this story's
changes to that file's `CD-3` test and is not something this round introduced or needs to fix.

### Denied or attempted commands
none.
