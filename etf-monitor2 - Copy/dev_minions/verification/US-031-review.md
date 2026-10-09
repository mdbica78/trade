# US-031 review — End-to-end verification on the real deployment

## Round 1 — 2026-09-28
Verdict: PASS

Reviewer: `story-reviewer` (fresh context, independent of the implementer). Sources read: `AGENTS.md`,
`dev_minions/backlog/stories/US-031.md` (incl. tech-lead review points 1-5), `dev_minions/verification/US-031-plan.md`,
`dev_minions/HANDOVER.md` "Files changed (US-031, in flight)", and every file it lists, in full. All test
commands below were run by me in this round; nothing here is copied from another agent's claim.

### Files changed — scope check
`git status` was not run (forbidden). Cross-checked HANDOVER's "Files changed (US-031, in flight)" list against
what actually exists on disk (`find`/`ls` on `lib/smoke/`, `test/e2e/`) and against the provided git-status
snapshot in my delegation context (informational only, not something I ran): every new/changed path in that
snapshot (`README.md`, `app/health/page.tsx`, `components/FieldChart.test.tsx`, `lib/cron/default-deps.ts`,
`lib/health.test.ts`, `lib/health.ts`, `lib/ingestion/default-deps.ts`, `messages/en.json`, `messages/ro.json`,
`package.json`, plus the new files `app/health/page.failure.test.tsx`, `lib/cron/default-deps.seam.test.ts`,
`lib/ingestion/default-deps.seam.test.ts`, `lib/smoke/deploy.ts`, `lib/smoke/deploy.test.ts`,
`scripts/smoke-deploy.ts`, `test/e2e/daily-pipeline.pglite.test.ts`, `test/e2e/fixture-web.ts`, plus the two
verification docs) matches HANDOVER's list exactly. No file outside that list was touched — in particular
`app/api/cron/daily/route.ts`, `lib/cron/daily-handler.ts`, `lib/cron/daily-job.ts` are untouched, as tech-lead
point 1 required, and confirmed green (see below). `package.json` changed only in `scripts` — `pnpm-lock.yaml`
does not appear in the changed-file list, so no new dependency was added.

### Acceptance criteria

- **AC1 (whole pipeline, offline)** — MET. `test/e2e/daily-pipeline.pglite.test.ts` `DP-1`
  (lines 120-302) drives `handleDailyCron` via the real `createDailyCronDeps({ database })` and the real
  `daily-handler`/`daily-job`/`run-daily`/`ingest-etf`/`discovery`/`pdf`/adapter registry, with only
  `lib/db/index`'s `getDb` mocked (asserted 0 calls, line 254-255) and global `fetch` stubbed to a recording
  guard (`test/e2e/fixture-web.ts` `createFetchGuard`). It asserts: HTTP 200 with `status: "partial"` and the
  five load-ordered outcome codes (line 126-131); one `job_runs` row with the exact 6-line log (line 146-155);
  one `ok` report per BRD ETF with `report_date '2026-09-21'` — the PDF's own footer date, not the 22-09
  filename or the 23-09 filing-stamp page (line 157-172, `fixture-web.ts` day-A map, line 60-76 of that file);
  `report_values` read from `test/fixtures/expected.json`, never adapter output (line 174-214); no `reports`
  row for `NOADAPTER` (216-219) and exactly one `etf_report_links` row for it (221-227); the fetch-guard
  sequence equals the expected 9-call list with 0 rejected and ≤`MAX_REQUESTS_PER_ETF` per symbol (229-252);
  the shipped home/history/operations loaders show the right values, markers and flags (257-294); and no
  sentinel (`CRON_SECRET`/`DATABASE_URL`) appears anywhere (296-301). I ran this test myself — passes (see
  "Tests run" below).
- **AC2 (re-run and a missing day)** — MET. `DP-2` (304-374): a second run over the same map gives
  `already_ingested` for all 4 adapter-backed ETFs, `reports`/`report_values` snapshots `toEqual` the first
  run's (321-322), and the fetch sequence is unchanged at 9 calls (323); a third run with `dayBMap()` (PTENGETF's
  page emptied of report rows) gives PTENGETF `missing` with `reason "no_report_entries"` (341), no new PTENGETF
  row and the run-1 snapshot rows unchanged for the other IDs (350-353), while BTBETRETF/TVBETETF both advance
  to `2026-09-22` with a non-null `delta` and PTENGETF's home row still shows `2026-09-21` with `delta null`
  (357-373) — proving the missing ETF didn't stop or corrupt the others. Passes.
- **AC3 (deployment smoke script)** — MET. `lib/smoke/deploy.ts` + `lib/smoke/deploy.test.ts` (20 tests,
  SM-1..SM-14 plus a few extra unit checks) prove: GET-only, `redirect: "manual"`, same-origin, 20 requests in
  order (SM-1); any 3xx (same- or cross-origin) fails as `redirect` and is not followed (SM-2/SM-2b); no `/api/`
  path, exactly the `accept`/`cookie`/`user-agent` headers, cookie `NEXT_LOCALE=<locale>` (SM-3); pass only on
  200 + matching `<html lang>` + no failure text (SM-4); failure texts come from `messages/<locale>.json`, not
  literals (SM-5); a script-only occurrence of the text does not fail (SM-6, the R1 risk fix — I confirmed
  `visibleMarkup` strips `<script>…</script>`, `deploy.ts` line 108-110); raw/escaped text matching (SM-7); 500 /
  network / timeout give the right reason and exit 1, all-pass gives exit 0 (SM-8/8b/8c); no sentinel leaks and
  reasons come from a closed vocabulary (SM-9); an unconfigured `/chat` is a PASS with a note, `Chat.loadError`
  still fails (SM-10); the base-URL rule (SM-11); no `process.env` and no forbidden import, CLI imports only the
  module (SM-12); output shape (SM-13); `package.json`/`README.md` wiring (SM-14). Passes.
- **AC4 (`/health` hardening)** — MET. `lib/health.ts`: `HEALTH_QUERY_TIMEOUT_MS = 8_000` (between 5-10s, HC-4),
  `getHealthStatus` races the query against a timer, clears it in `finally`, and attaches a no-op `.catch` to
  the query so a late rejection is swallowed (line 24-41). `lib/health.test.ts` HC-1 (not-before/at-exactly the
  timeout), HC-2 (timer cleared on success), HC-3 (no `unhandledRejection` after a post-timeout rejection), HC-4
  (bound check) — all new, all pass. `app/health/page.failure.test.tsx` HP-F1/HP-F2 render the **real**
  `HealthPage()`/`loadHealthStatus` (only `@/lib/db`'s `getDb` mocked) for both locales: a thrown
  `MissingDatabaseUrlError` renders `dbUnreachable` + "DATABASE_URL is not set" and never `dbConnected`; a
  never-settling query renders `dbUnreachable` + the new `dbTimeout` text and never an `Error:`/`Eroare:` prefix.
  `app/health/page.test.tsx` is untouched and still passes (3 tests, confirmed by running it). `messages/en.json`
  /`ro.json` both carry `Health.dbTimeout`, confirmed by `i18n/messages.test.ts` (the key-parity test) passing.
- **AC5 (chart tooltip wiring)** — MET. `components/FieldChart.test.tsx` `FC-TT1..FC-TT4` capture the actual
  function passed as `Tooltip`'s `content` prop (via the existing `recharts` mock) and call it directly:
  `ro` → "Dată: 21.09.2026" / "VUAN: 54,1373" (FC-TT1); `en` → "Date: 2026-09-21" / "NAV per unit: 54.1373"
  (FC-TT2); the display string wins over the float even when they'd round differently (FC-TT3); inactive/empty
  payload renders `""` (FC-TT4). `components/FieldChart.tsx` is confirmed unchanged (`ChartTooltipContent`
  already existed from US-019); the test exercises the real wiring, not a copy of the function. Passes.
- **AC6 (runbook and README)** — MET. `README.md` "Deployment smoke check" (after "Health check") documents what
  the command requests, what it never does, and exit codes 0/1/2, plus the WSL `NODE_EXTRA_CA_CERTS` note
  (verified by reading the section, lines 109-137). `dev_minions/verification/US-031-qa.md` contains MANUAL-QA
  1-7 verbatim from the story, each with the exact place to look and the expected result, and ends with a
  "Files changed" section. `SM-14` mechanically checks the `package.json` script and the README mention.
- **AC7 (offline and gates)** — MET. No test in the changed set reaches a live resource: the pipeline test's
  fetch guard rejects any unmapped URL (asserted 0 rejections) and `getDb` is asserted never called; the smoke
  tests only use an injected `fetchImpl`, with global `fetch` never stubbed to a real implementation. No new
  runtime dependency: `package.json`'s only diff is the `scripts` block (confirmed by reading the file), and
  `pnpm-lock.yaml` is absent from the changed-file list. I ran, myself, in this round: `pnpm typecheck` (clean,
  0 errors), `pnpm lint` (0 errors, 8 pre-existing-pattern warnings — 2 new ones in
  `lib/cron/default-deps.seam.test.ts` follow the exact same "unused mock parameter" shape already accepted in
  `lib/cron/default-deps.test.ts`, not a new category of warning), the full set of new/changed test files plus
  every file the plan named "must stay green unedited" (`lib/cron/default-deps.test.ts`,
  `lib/ingestion/default-deps.test.ts`, `lib/ingestion/default-deps.cron.test.ts`,
  `lib/cron/daily-handler.test.ts`, `app/api/cron/daily/route.test.ts`, `app/health/page.test.tsx`,
  `lib/ingestion/boundaries.test.ts`, `i18n/messages.test.ts`) — 91 tests total across these runs, all green —
  and `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u CRON_SECRET pnpm build`, which compiled and
  generated all 12 routes including the unchanged `/api/cron/daily`. I did not run the full `pnpm test` suite
  myself (that is the tester's gate) — not re-run by me.

### Non-negotiable rules (AGENTS.md) — checked
- Deterministic extraction, no AI: unaffected by this story; the pipeline test exercises the existing
  deterministic adapters unmodified.
- Adapter per report format: unaffected.
- Missing day stays empty: re-confirmed end-to-end by AC2/DP-2 (no row, other ETFs unaffected).
- next-intl ro+en for every string: `Health.dbTimeout` present in both catalogues and covered by the key-parity
  test; the smoke script's failure/note texts are read from the catalogues, not hand-written (SM-5).
- Number display (DEC-007): FC-TT1/2/3 confirm the tooltip renders the locale's decimal mark from the stored
  display string.
- No secrets in code or logs: DP-1/DP-3 scan for both sentinels in every surface (response, `job_runs.log`,
  loader output); the smoke module never reads `process.env` (SM-12) and never prints a body (SM-9).
- No weakened/skipped tests: none of the "must stay green unedited" files were touched; all still pass.
- No scope creep: the changed-file list matches HANDOVER's declaration exactly; no unrelated file was touched.

### Findings
- **W1 (non-blocking).** `DP-3` ("a wrong bearer never reaches the pipeline",
  `test/e2e/daily-pipeline.pglite.test.ts` line 376-393) does not keep a reference to its `FetchGuard` object
  and never asserts `guard.calls`/`guard.rejected` is empty, even though the plan's own test spec
  (`US-031-plan.md` §"AC2 — Re-run..." — actually under "AC1..." test list, "DP-3 bad bearer" bullet) promises
  "the fetch guard has 0 calls" as evidence that the auth path runs before any I/O. The test only checks
  `response.status === 401`, no secret in the body, and 0 `job_runs` rows. This is not a criterion failure —
  `lib/cron/daily-handler.ts` (unchanged, already unit-tested) checks the bearer synchronously before calling
  `deps.run`, so no fetch call is structurally possible on the 401 path — but the specific evidence the plan
  promised for this test is missing. Recommend adding the `guard.calls`/`guard.rejected` assertion; cheap,
  test-only, no re-review needed if fixed as a follow-up.
- **N1 (note).** `HP-F1` (`app/health/page.failure.test.tsx`) checks the HTML does not contain
  `Health.dbConnected`, but AC4's own wording ("It contains neither `Health.dbConnected` nor `postgresql://`.")
  is not fully mirrored — there is no explicit assertion that no `postgresql://` string appears. Not a real gap
  today (`MissingDatabaseUrlError`'s message is "DATABASE_URL is not set", which contains no connection string),
  but the assertion the AC text specifically calls out is absent from the test.
- **N2 (note).** `test/e2e/fixture-web.ts`'s `expectedValues` takes only `(file)`, not `(file, fieldKeys)` as the
  plan's file list describes (§2.2); harmless — the caller filters/labels the keys it needs — but a small
  drift from the plan's stated signature, worth a one-line HANDOVER correction next time the plan format is
  reused as a reference.

No Critical finding. Every acceptance criterion is MET with a test I ran myself and file:line evidence traced
through the actual test files, not the planner's description of them.

Denied or attempted commands: none. I did not run `git` in any form (the delegation prompt's git-status
snapshot is informational context provided to me, not something I executed).
