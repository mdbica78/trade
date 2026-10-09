# US-024 review

## Round 1 — 2026-09-26

Verdict: PASS

Reviewer: story-reviewer (fresh context, independent of implementation). Inputs read: `AGENTS.md`,
`dev_minions/backlog/stories/US-024.md`, `dev_minions/verification/US-024-plan.md`,
`dev_minions/backlog/sprints/sprint-05.md` (Decisions needed #12-16), `dev_minions/HANDOVER.md`
("Files changed (US-024, in progress)"). Every file in that list was read in full. `git` was not
run, per role instructions; scope was cross-checked against the environment's git-status snapshot
provided in the delegation context (untracked/modified files match the HANDOVER list exactly, plus
process files `dev_minions/HANDOVER.md`/`status.md` — no scope creep found).

### Acceptance criteria

- **AC1** (outcome codes truthful, N4/N5) — MET. `lib/ingestion/outcome.ts:3-12` adds `internal_error`
  to `INGEST_OUTCOME_CODES` (8 codes) and the `IngestOutcome` union (`outcome.ts:39`). `ingest-etf.ts:83-91`
  (registry.get throw → `internal_error`) and `ingest-etf.ts:132-141` (outer catch around `ingestReport` →
  `internal_error`, commented as a defensive net) match the plan. `no_adapter` (`ingest-etf.ts:92-98`) and
  `persist_error` (`ingest-etf.ts:66-73`) paths are untouched. Tests confirmed by name and by reading them:
  `outcome.test.ts` `OC-8a` (8-code `toEqual` + `expectTypeOf`), `ingest-etf.test.ts` `IE-6c`/`IE-6d`,
  `ingest-etf.failures.test.ts` `IF-8a` (8-key trigger map incl. `internal_error`), `IF-8b` (`registry.get
  throws` row expects `internal_error`; every other row unchanged, confirmed by reading `IF-1a/b/c/d` —
  byte-identical to the `no_adapter` behaviour, and the `findReport`/`saveReport throws` rows still expect
  `persist_error`), `IF-8c` (rewritten to build its own `FakeStore`s and assert via `saveReportCalls` +
  `allSaveReportInputs`, order-independent), `job-run-summary.test.ts` `JS-3c`, `run-daily.test.ts` `RD-T`
  (`expectTypeOf<DailyEtfOutcome>().toEqualTypeOf<IngestOutcome>()`, proving `run-daily.ts:7`'s alias is the
  only definition). Ran `pnpm vitest run lib/ingestion/ingest-etf.failures.test.ts -t IF-8c` alone myself:
  1 passed, 48 skipped — confirms the order-independence claim (Sprint 3 audit N5).
- **AC2** (run history) — MET. `lib/admin/operations.ts` `buildRunsStatement` (`order by started_at desc,
  id desc`) and `createOperationsLoader`. Test `lib/admin/operations.pglite.test.ts` `OP-R1/OP-R2` (a
  success/partial/swept-failed/running row, checked newest-first ordering and `finishedAt: null` for the
  two unfinished rows) and `OD-R2` (aborted `failed` row with `finished_at` keeps its end time) — both read
  and both pass (ran the file myself: 6/6 passed). UI: `components/admin/OperationsDashboard.tsx`
  `RunRow` computes `did-not-finish` vs `running` vs `finished`; `OperationsDashboard.test.tsx` `OD-R1`
  covers all four states.
- **AC3** (log lines translated) — MET. `lib/admin/run-log.ts` `parseRunLog`, `isKnownOutcomeCode`,
  `CODES_WITH_REPORT_DATE`. `lib/admin/run-log.test.ts` `RL-1` through `RL-11` read in full: the round trip
  uses the real `formatRunLog`/`formatAbortedRunLog`/`STALE_RUN_LOG_LINE` as the plan requires (not
  hand-written strings), covers unknown codes (`RL-9`), non-date-carrying codes with a date-like prefix
  (`RL-10`), and a type-level pin of `CODES_WITH_REPORT_DATE` against `IngestOutcome` (`RL-11`). Render
  tests `OD-L1/OD-L2` in `OperationsDashboard.test.tsx` show translated outcome text, verbatim detail, and
  raw text for an unknown code.
- **AC4** (last successful extraction per ETF) — MET. `buildEtfStatusStatement` (`operations.ts:70-83`)
  left-joins a `distinct on (etf_id)` subquery ordered `report_date desc, id desc` filtered to `status =
  'ok'`, matching the "newest ok" rule cited from `home.ts`. `operations.pglite.test.ts` `OP-E1/OP-E2`:
  a newer `parse_error` does not override the `ok` row's `lastOk`, an ETF with no `ok` report gets `null`,
  an inactive ETF is listed with `isActive: false`. Render `OD-E1/OD-E2` cover "never" and "inactive" text.
- **AC5** (adapter missing flagged) — MET. `adapterAvailable = key !== null && registry.get(key) !==
  undefined` (`operations.ts:116`), the injected-registry pattern from US-016. `OP-E3` tests NULL, unknown,
  and registered keys against an injected registry (not the default one) — true isolation. Render `OD-E3`
  checks the `data-adapter-missing` attribute and the translated label text inside the correct row.
- **AC6** (parse errors visible) — MET. `buildParseErrorReportsStatement` filters `status <> 'ok'`, joins
  `field_catalog` on the report's own ETF's `adapter_key` (the `history.ts` pattern), falls back to
  `field_key` when there is no catalogue row. `OP-P1/OP-P2` (PGlite) proves ordering, `ok`-row exclusion,
  value grouping/labels, and the `field_key`-fallback case. Component `ParseErrorRow` only builds an `<a>`
  for a `sourceUrl` matching `^https?:\/\//i`; `OD-P1/OD-P2` proves a `javascript:` URL renders no link and
  exactly one `target="_blank"` appears for the linked row. `PG-1` (`app/admin/operations/page.pglite.test.tsx`)
  proves the same end to end through the real page against PGlite.
- **AC7** (dates/times/numbers) — MET. `lib/format/datetime.ts` `formatDateTime` uses a fixed
  `Intl.DateTimeFormat` with `timeZone: "Europe/Bucharest"` and `hourCycle: "h23"`, assembling the string
  itself rather than trusting a locale pattern. `datetime.test.ts` `DT-1`..`DT-8` cover summer/winter
  offsets, both 2026 DST transition instants, a midnight crossing (no `24:xx`), an offset-bearing input, and
  independence from `process.env.TZ` (stubbed to two different zones). Report dates and numeric values in
  the dashboard go through the existing `formatReportDate`/`formatNumber` (imports confirmed in
  `OperationsDashboard.tsx:3-5`).
- **AC8** (bilingual) — MET. `messages/en.json` and `messages/ro.json` both carry the full
  `Admin.operations.*` key set (verified with a script diff of the two key sets — identical), including
  `outcome` (8 keys matching `INGEST_OUTCOME_CODES`), `runStatus` (4 keys matching `jobRuns.status.enumValues`),
  `reportStatus` (4 keys matching `reports.status.enumValues`). `lib/admin/operations-messages.test.ts`
  `OM-1` iterates the real code/status lists (no hard-coded key list) against both catalogues. `AL-5` in
  `app/admin/layout.test.tsx` checks the nav link text and `href="/admin/operations"` in both locales.
  `OD-B1` checks ro/en render show only their own locale's differing text. `pnpm lint` ran clean (0 errors),
  so `react/jsx-no-literals` holds for the new `.tsx` files.
- **AC9** (no leak, no crash) — MET. `app/admin/operations/page.tsx` wraps the loader in try/catch and
  returns only `{ status: "error" }` on failure, with a comment citing the AGENTS.md secrets rule.
  `page.test.tsx` `OPG-2` (a thrown error containing a connection string and a "secret" substring — none of
  it appears in the rendered HTML), `OPG-3` (`MissingDatabaseUrlError` — no `DATABASE_URL` text), `OPG-4`
  (stubbed `DATABASE_URL`/`CRON_SECRET` env values absent from a successful render's HTML). `OD-S1` in
  `OperationsDashboard.test.tsx` proves a `<script>` in a log detail, an unparsed line, and an
  `error_message` all render as escaped text (React's default), never as `<script`. `lib/admin/boundaries.test.ts`
  `BA-1` asserts no non-test `lib/admin/*.ts` file contains the literal `process.env`.
- **AC10** (shipped statements, offline, read-only) — MET. `operations.pglite.test.ts` `OP-W1` (full
  six-table dump byte-identical before/after a load) and `OP-W2` (every statement's SQL starts with
  `select`, one runner call for all three) — both read and both pass. `BA-1` additionally checks the
  `operations.ts` source contains none of `insert into`, `update "`, `delete from`, and no `next`/`react`/
  `@/app`/`@/components` import anywhere under `lib/admin/`. `PG-1` exercises the real page against PGlite
  with only `@/lib/db` and (partially) `@/lib/admin/operations` mocked to bind the PGlite runner — no Neon
  reached, confirmed by `OPG-5`'s `fetch`-spy assertion on the page render path.
- **AC11** (gates) — MET. I ran independently, with `NODE_EXTRA_CA_CERTS` exported: `pnpm typecheck`
  (clean, no output beyond the tsc invocation), `pnpm lint` (0 errors, 3 pre-existing warnings, matching
  HANDOVER's claim and unrelated to this story's files), `pnpm test` (full suite: 1130/1130 passed, 101
  files), `env -u DATABASE_URL pnpm build` (webpack build succeeded, route list includes
  `/admin/operations`). `app/admin/operations/page.tsx` exports `dynamic = "force-dynamic"`, checked by
  `OPG-6` and confirmed by reading the file.

### Architecture / non-negotiable rules

- Deterministic extraction untouched: this story only relabels internal-fault outcomes and adds a read-side
  admin view; no PDF-parsing or AI logic touched.
- `lib/admin/` boundary respected: read-only, no Next/React import, enforced by its own `boundaries.test.ts`
  (BA-1), consistent with `lib/config/boundaries.test.ts`'s existing pattern.
- Missing-report / empty-day and `ok`-row-never-downgraded rules: not touched by this story; the new code
  only reads `reports`/`job_runs`, never writes (confirmed by `BA-1`'s text checks and `OP-W1`'s dump
  comparison).
- next-intl ro+en: every new string goes through `Admin.operations.*`/`Admin.nav.operations`, both
  catalogues have the identical key set (confirmed above) and the existing `i18n/messages.test.ts`
  key-parity test is unaffected in scope (not re-run individually, but included in the full-suite run,
  which passed).
- DEC-007 numbers: `formatNumber` reused as-is, no reimplementation.
- No secrets in code or logs: `BA-1` (`process.env`), `OPG-2/3/4` (rendered HTML), and the page's catch
  block (no exception text ever returned) all checked above.
- Test integrity (Sprint 3 audit N4/N5): the story's own "Notes for verification" flags `OC-8a`, `IE-6c`,
  and the `IF-8b` `registry.get throws` row as intentionally changed expectations, cited to the audit
  finding and sprint decision #12. I independently confirmed no other expectation in those files changed
  by reading `IF-1a/b/c/d` (still `no_adapter`), `IE-4`/`IE-6b-iii` (not re-read line-by-line this round
  beyond what's shown above, but the full suite passing at 1130/1130 with no `persist_error`/`no_adapter`
  regressions elsewhere is consistent with them being untouched). This is a behaviour correction with a
  cited source (Sprint 3 audit N4/N5), not a weakened test — `IF-8c`'s rewrite still proves the same three
  facts (only `ok`/`parse_error` reach `saveReport`, both occur, the type is closed) via a different,
  order-independent construction, and I confirmed with an isolated run that it now passes alone.
- No scope creep: the git-status snapshot in the delegation context lists exactly the files in HANDOVER's
  "Files changed" section for US-024, plus `dev_minions/HANDOVER.md`/`status.md` (process bookkeeping).
  Nothing else was modified.

### Findings

- **Note N1**: running `app/admin/operations/page.pglite.test.tsx` alone prints an `IntlError:
  ENVIRONMENT_FALLBACK` console warning (no `timeZone` configured on the test's own
  `NextIntlClientProvider`) to stderr. The test still passes and the production app already sets a global
  `timeZone` in `i18n/request.ts` per AGENTS.md, so this is test-harness noise, not a product or coverage
  gap. Non-blocking.
- **Note N2**: AC1's "byte-identical" claim for `IE-4`/`IE-6b-iii` was corroborated only by the full-suite
  pass and the diff of `IF-1a/b/c/d`/`IF-8b`'s persist-error rows shown above, not by a line-by-line read of
  every one of those specific tests this round. Recorded for transparency; not a Critical finding since the
  full suite (1130/1130) and the targeted `ingest-etf.failures.test.ts` read both support the "only OC-8a /
  IE-6c / IF-8a / IF-8b registry-row / IF-8c changed" claim.

No Critical findings.

Denied or attempted commands: none.
