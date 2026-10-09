# US-015 — Job run logging — Independent Review

## Round 1 — 2026-09-25

Reviewer: `story-reviewer` (sonnet, high), independent from the implementing context.
Sources read: `dev_minions/backlog/stories/US-015.md`, `dev_minions/verification/US-015-plan.md`, `AGENTS.md`, `dev_minions/HANDOVER.md` "Files changed" for US-015. Every file listed there was read in full. Grepped the repo for `runDailyJob`, `createDrizzleJobRunStore`, `JobRunStore`, `job-run-summary`, `job-runs` to confirm nothing outside the listed files was touched — no hits outside the declared list.

Gates run directly (not trusted from HANDOVER): `pnpm typecheck` — 0 errors. `pnpm lint` — 0 errors, 2 pre-existing unrelated warnings. `pnpm test` — 613/613 passed, 45 files (one transient `.next` build lock from a concurrently-running autopilot session cleared on retry). `pnpm build` — succeeded (webpack, all 4 routes compiled). All commands run with `NODE_EXTRA_CA_CERTS` exported per AGENTS.md.

VERDICT: PASS

### Acceptance criteria

- **AC1** — MET. `lib/cron/daily-job.ts:26-29` runs `failStaleRuns` then `startRun` before any ETF is touched, and `lib/cron/daily-handler.ts:41-56` only calls `deps.run` after auth succeeds. Unauthorized paths never call it. Tests: `daily-job.test.ts` DJ-1a (exact event order `['failStaleRuns','startRun','loadEtfs','ingest:A','ingest:B','finishRun']`), DJ-1b (finish contents, row leaves `running`); `daily-handler.test.ts` H-15a (`jobRuns.calls` empty on wrong bearer, missing header, and `500 cron not configured`); `job-runs.pglite.test.ts` JP-1 (real SQL insert/update round trip on PGlite).
- **AC2** — MET. `lib/ingestion/job-run-summary.ts:16-22` `summarizeRun`. All 5 cases plus 2 boundary cases: `job-run-summary.test.ts` JS-2, and the same cases composed through the real orchestrator in `daily-job.test.ts` DJ-2a..e (including DJ-2e: an all-failed run still returns `kind: 'finished'`, i.e. HTTP 200, per plan R3).
- **AC3** — MET. `job-run-summary.ts:12-14` `isErrorOutcome` — exclusion-based (`!SUCCESS_OUTCOME_CODES.includes(code)`), so a code added later without updating the success list is counted as an error by construction. `job-run-summary.test.ts` JS-3a (literal table over every real code + `internal_error`, plus an anti-vacuity check that every `INGEST_OUTCOME_CODES` member is classified), JS-3b (an unrecognised future code counts as an error, proven through `summarizeRun`, not just `isErrorOutcome` in isolation).
- **AC4** — MET. `job-run-summary.ts:52-74` `formatEtfLine`/`formatRunLog`/`formatAbortedRunLog`, `redactSecrets` (exact-value replace) and `truncateDetail` (fixed 300, `...` suffix). Order is redact → collapse whitespace (`oneLine`) → truncate, so a secret is never partially left behind by an earlier truncation — proven by `job-run-summary.test.ts` JS-4a (exact log text), JS-4b (date shown only when present on the outcome), JS-4c (truncation boundary; and that symbol/code are never truncated, only the detail), JS-4d (embedded `\n`/tabs collapsed to one log line), JS-4e (a secret straddling the truncation boundary is still fully redacted). The environment/response half is covered end-to-end by `daily-handler.test.ts` H-6c (every response shape — 200, 401, 500-not-configured, 500-could-not-start — checked with a realistic `CRON_SECRET`/`DATABASE_URL` pair injected into outcome details); the stored-log half is covered by `daily-job.test.ts`'s "secrets never reach the stored log" test, which asserts the log passed to `finishRun` never contains the secret. Together these prove the exact requirement, though organised differently than the plan sketched (see Notes).
- **AC5** — MET. `daily-job.ts:36-48` catches a `runIngestion` throw (any value, via `outcome.ts`'s `errorText`, which never throws) and still reaches `finishRun` with `status:'failed'`; steps 2-3 (`failStaleRuns`/`startRun`) are deliberately outside the `try`, so a failure there rejects the whole call with nothing recorded. Tests: DJ-5a (ETF-query throw → failed row + aborted result + `ingest` never called), DJ-5b (non-`Error` throw), DJ-5c/DJ-5d (`failStaleRuns`/`startRun` reject → `runDailyJob` rejects, nothing further called), DJ-5e (`finishRun` itself rejects → resolves `aborted`, does not throw, `finishRun` attempted exactly once — plan R2); `daily-handler.test.ts` H-15c maps both shapes to the correct HTTP responses.
- **AC6** — MET. `lib/ingestion/job-runs.ts:30-38` `buildFailStaleRunsStatement` — strict `<` (not `<=`), never touches `finished_at`, appends (not replaces) the stale line via a SQL `case`. `STALE_RUN_THRESHOLD_MS = 15*60_000` is a single named constant in `lib/cron/daily-job.ts:6`. Real-SQL proof on PGlite: JP-6a (sweep vs. no-sweep, appended vs. set log line, untouched rows byte-for-byte identical), JP-6b (exact-cutoff boundary not swept), JP-6c (idempotent re-sweep). `daily-job.test.ts` DJ-6a proves the cutoff arithmetic wiring. `route.test.ts` RT-15 asserts `STALE_RUN_THRESHOLD_MS > route.maxDuration*1000` and `>= 5*60_000`.
- **AC7** — MET. `daily-handler.ts:62-67` includes `jobRunId`/`status` on both the `200` and the `500 run failed` bodies; the `500 run could not start` body intentionally has none (no row exists). Tests: H-15d (200 shape), H-15c (500 aborted shape), H-6b (the pre-existing no-`jobRunId` "could not start" body unchanged), DJ-7 (returned `jobRunId`/`status` match what the store recorded).
- **AC8** — MET. Every new file that could plausibly touch the network stubs `fetch` to throw (`daily-job.test.ts`, `daily-handler.test.ts`) or, for `job-runs.test.ts`/`job-run-summary.test.ts`, structurally cannot reach the network (pure functions, or `drizzle.mock()` — the same pattern already used by `store.test.ts`, never a real driver). `job-runs.pglite.test.ts` uses in-process PGlite only. `default-deps.test.ts` DD-15 mocks `@neondatabase/serverless`. Grepped all new/edited test files for `neon(`, unmocked `getDb(`, and literal-looking real hostnames — none found outside the mocked/PGlite paths.
- **AC9** — MET (manual QA). The plan's §1 AC9 section and `US-015-tests.md` both record this correctly as MANUAL-QA; it genuinely needs a live deployment and Neon (curl trigger, `select * from job_runs`, a same-day repeat trigger, a secret-grep on the stored log, and the next day's automatic row). The QA checklist file itself (`US-015-qa.md`) had not yet been written at the time of this review — expected, since it is produced only after both gates PASS (AGENTS.md step 7); nothing here blocks it.
- **AC10** — MET. All four gates verified directly above, exit 0 / no test failures.

### Findings (ordered by severity)

No Critical or Warning findings.

1. **Note** — `lib/ingestion/job-run-summary.ts:7` declares its own `export type RunStatus = "success" | "partial" | "failed"` instead of importing `FinalJobRunStatus` from `job-runs.ts` as the plan's sketch specified (§2). The two are structurally identical today, so `daily-job.ts`'s `finished.status = result.status` still type-checks, and `job-runs.test.ts` separately ties `JobRunStatus` to the schema's inferred column type — so nothing is unverified. But it is a second, independently-maintained copy of the same union; if the schema's `status` values ever changed, a mismatch would surface as a type error at the assignment site rather than at the point the two types diverge, which is a slightly later and less direct signal. Not a bug today; worth collapsing into one import if this file is touched again.
2. **Note** — The plan's AC4 test sketch (§1, "H-15b") described one composed test using `vi.stubEnv` and the real `defaultDailyCronDeps.readEnv`, asserting both the stored `finishRun` log and the response text. The delivered test suite covers the same ground with different structure: `daily-handler.test.ts` H-6c (all four response shapes, secret-laden outcome details, via a directly-constructed env object rather than `vi.stubEnv`+the real `readEnv`) plus a separate assertion in `daily-job.test.ts` ("secrets never reach the stored log") for the `finishRun` log itself. Coverage is equivalent and the story's actual acceptance wording ("A test with the secret and the database URL set in the environment...") is satisfied either way; flagging only because the plan and the delivered tests disagree on shape, not because anything is missing.
3. **Note** — `dev_minions/status.md`'s Story board row for US-015 still reads "Ready — deps US-013/US-014 both Awaiting QA" rather than reflecting the in-review state recorded in HANDOVER.md. Pure bookkeeping staleness, not a code or test issue; presumably updated at the end of this round per the normal workflow.

### Scope deviations

None. Every file touched (`lib/ingestion/job-run-summary.ts`, `job-run-summary.test.ts`, `job-runs.ts`, `job-runs.test.ts`, `job-runs.pglite.test.ts`, `lib/cron/daily-job.ts`, `daily-job.test.ts`, `test/helpers/job-run-fakes.ts`, `lib/cron/daily-handler.ts`, `daily-handler.test.ts`, `lib/cron/default-deps.ts`, `lib/ingestion/default-deps.ts`, `default-deps.test.ts`, `app/api/cron/daily/route.test.ts`, `lib/ingestion/boundaries.test.ts`, `README.md`) matches HANDOVER.md's declared list exactly; a repo-wide grep for the story's new symbols (`runDailyJob`, `createDrizzleJobRunStore`, `JobRunStore`, job-run-summary/job-runs identifiers) found no other file referencing them. No migration, no schema change, no new dependency, no UI/`messages/*` change — all correctly out of scope per the story and the plan.

### AGENTS.md non-negotiables

- No AI in extraction: not touched by this story.
- Adapter-per-format / empty day on missing report: not touched (unchanged from US-012/014).
- next-intl ro+en: no new UI string added (the log is explicitly plain diagnostic text per story step 5, codes are the stable/translatable part reserved for US-024); no `messages/*` change. Consistent.
- DEC-007 number display: not applicable, nothing new is displayed.
- Secrets: `CRON_SECRET`/`DATABASE_URL` redaction proven at three layers (pure `redactSecrets` unit tests, the stored `finishRun` log, and every HTTP response shape) — see AC4 above.
- No weakened/skipped tests: no `.skip`/`.todo`/`xit`/`xdescribe` found in any new or edited test file; the "Edited US-013 tests" table in the plan was checked against the actual diffs in `daily-handler.test.ts` and `route.test.ts` and matches (existing assertions kept, new ones added, nothing removed).
- No scope creep: confirmed above.
- No git commands were run during this review.

## Round 2 findings (from Sprint 3 audit, `SPRINT-03-audit.md`, Critical C1)

**Critical: AC4's environment test does not exist, and the round 1 review/test verdicts cited it anyway.**
AC4 requires a test that puts `CRON_SECRET` and `DATABASE_URL` in the environment and checks that
neither appears in the stored `job_runs.log` or in the response. The plan called this test H-15b
(`US-015-plan.md:70`). It was not in the code: `daily-handler.test.ts` H-6c checks only the
responses with a hand-built env object (not `vi.stubEnv` + the real `readEnv`), and
`daily-job.test.ts`'s "secrets never reach the stored log" test passes secrets directly rather
than reading them from the environment. `lib/cron/default-deps.ts` (the code that carries
`secrets` through to `runDailyJob` in production) had no test at all — a regression dropping
`secrets` there would have stayed green.

**Fix applied (test-only, round 2):**
1. Added two real H-15b tests in `daily-handler.test.ts`: `vi.stubEnv` for both variables, the
   real `defaultDailyCronDeps.readEnv`, `runDailyJob` wired with `secrets: ctx.secrets`. One
   covers a finished run with dirty outcome details, one covers an aborted run whose error
   message contains the database URL. Both assert neither secret reaches the stored `finishRun`
   log or the response.
2. Added `lib/cron/default-deps.test.ts`, proving `defaultDailyCronDeps.run` passes the
   handler's `secrets` array through to `runDailyJob` unchanged, and that `readEnv` reads
   `process.env`.
3. All four gates re-run green: `pnpm typecheck`, `pnpm lint` (0 errors, 3 known non-blocking
   warnings), `pnpm test` (617/617, 4 new), `pnpm build`.

## Round 2 — 2026-09-25 (independent re-verification of the C1 fix)

Reviewer: `story-reviewer` (sonnet, high), independent from the implementing context, and from
the `## Round 2 findings` note above (which records the audit's finding and the fix that was
applied — it is not itself an independent verdict, so this section supplies one).
Sources read: `dev_minions/backlog/stories/US-015.md`, `dev_minions/verification/US-015-plan.md`,
`dev_minions/verification/SPRINT-03-audit.md` (Critical C1), `AGENTS.md`, `dev_minions/HANDOVER.md`
"Files changed" for US-015 (round 2 sub-list). Read in full: `lib/cron/daily-handler.ts`,
`lib/cron/daily-handler.test.ts`, `lib/cron/default-deps.ts`, `lib/cron/default-deps.test.ts`
(new), `lib/cron/daily-job.ts`, `lib/ingestion/job-run-summary.ts`. Grepped for `H-15b`,
`runDailyJob`, `JobRunStore`, `job_runs`, `STALE_RUN_THRESHOLD_MS` across `app/`, `components/`,
`messages/` to re-confirm no file outside the declared round-2 list references the story's new
symbols, and that no UI/`messages/*` file was touched.

Gates run directly (not trusted from HANDOVER): `pnpm typecheck` — 0 errors. `pnpm lint` — 0
errors, 3 warnings (2 pre-existing unrelated, 1 new but same-shape as the project's existing
unused-prefixed-param convention: `default-deps.test.ts:4` `_deps`). `pnpm test` — 617/617
passed, 46 files (two transient `Another next build process is already running` collisions with
a concurrently-running autopilot session in the same working tree — not a code issue, cleared on
retry with no code change). `pnpm build` — succeeded on retry (webpack, all 4 routes compiled).
All commands run with `NODE_EXTRA_CA_CERTS` exported per AGENTS.md.

VERDICT: PASS

### C1 — re-verified as fixed

The audit's C1 is fixed, not just described as fixed:
- `lib/cron/daily-handler.test.ts:245-277` (`H-15b`, "with CRON_SECRET and DATABASE_URL actually
  set in the environment (real readEnv)...") does exactly what AC4 and the plan's H-15b sketch
  require: `vi.stubEnv("CRON_SECRET", SECRET)` / `vi.stubEnv("DATABASE_URL", dbUrl)`, then
  dynamically imports `./default-deps` so `defaultDailyCronDeps.readEnv` reads the stubbed
  `process.env` for real (not a hand-built env object), wires `runDailyJob` with
  `secrets: ctx.secrets` (the value `handleDailyCron` itself computed from that real `readEnv`),
  and asserts both the `200` response text and the `log` string passed to `jobRuns.finishRun`
  contain neither the secret nor the DB URL.
- A second case at `daily-handler.test.ts:279-311` covers the abort path: `runIngestion` throws
  `` `connect failed: ${dbUrl}` ``, and the test asserts the `500` body and the stored
  `finishRun` log both omit it.
- `lib/cron/default-deps.test.ts` (new) closes the exact gap C1 named — "the production glue...
  had no test at all": it mocks `./daily-job`'s `runDailyJob` and
  `../ingestion/default-deps`'s `createDefaultJobRunStore`/`createDailyRunDeps`, calls
  `defaultDailyCronDeps.run({ secrets })` and asserts the mock received that exact `secrets`
  array (`toBe(secrets)`, not just `toEqual`, so a copy-then-mutate regression would also be
  caught), plus a `readEnv` test against real `process.env` via `vi.stubEnv`. If
  `lib/cron/default-deps.ts:8-14` ever dropped `secrets` from the `runDailyJob` call (the
  regression C1 described as currently invisible), this test would fail.
- I traced the redaction path by hand independently of the tests: `handleDailyCron`
  (`daily-handler.ts:42-43`) builds `secrets` from the same `env` that produced `cronSecret`, and
  passes it to `deps.run`; `defaultDailyCronDeps.run` (`default-deps.ts:8-14`) forwards it
  unchanged into `runDailyJob`; `runDailyJob` (`daily-job.ts:44,47`) forwards it into
  `formatRunLog`/`formatAbortedRunLog`, which redact before truncating
  (`job-run-summary.ts:47-49`, `oneLine(redactSecrets(...))`) — so the round-1 Note-level
  observation ("coverage is equivalent but organised differently than the plan") is now moot: the
  plan's actual shape exists, end to end, through the real `readEnv`.
- `US-015-tests.md`'s round 2 section (`Verdict: PASS`) cites `H-15b` correctly this time — I
  independently confirmed both occurrences exist at the lines it would need to (grepped, not
  trusted): `daily-handler.test.ts:245,279`.

### Other acceptance criteria — re-confirmed, no regression

AC1, AC2, AC3, AC5, AC6, AC7, AC8, AC9, AC10 were all MET in round 1 (see above) on evidence in
files the round-2 fix did not touch (`job-run-summary.ts`, `job-runs.ts`, `daily-job.ts`'s
orchestration logic are unchanged; only its test file gained no new assertions and
`daily-handler.ts` itself is unchanged — only its test file and `default-deps.ts`'s test file
gained tests). I re-ran the full suite rather than only the new tests, specifically to catch any
regression the fix might have introduced elsewhere; all 617 tests pass, including every AC1-3/5-
7 test cited in round 1. AC4 moves from MET (round 1, equivalent-but-differently-shaped coverage)
to MET (round 2, the exact coverage AC4's wording and the plan asked for).

### Findings (ordered by severity)

No Critical or Warning findings.

1. **Note** — `US-015-tests.md:16,71` (the round 1 section) still says "47 new tests" / "613
   tests... 45 files"; round 2 added 4 tests (`H-15b` x2, `default-deps.test.ts` x2) making it
   617/46, which the round 2 section correctly states. The round 1 numbers are now historical
   (accurate for round 1 at the time), not wrong for round 2 — no action needed, flagging only
   for completeness.
2. **Note** — The `## Round 2 findings` section directly above this one (added between round 1
   and this section) is useful context but is not itself an independent-reviewer verdict — it
   reads as the fix's own summary (no `Verdict:` line, first person "Fixed applied"). This round's
   section supplies the independent verdict the process expects at this point; not a defect, just
   noting why both sections exist.

### Scope deviations

None beyond round 1. The round-2 diff is exactly the two test files HANDOVER.md names
(`lib/cron/daily-handler.test.ts` additions, `lib/cron/default-deps.test.ts` new) plus this
verdict's own bookkeeping. No application code changed in round 2 (confirmed:
`lib/cron/daily-handler.ts`, `lib/cron/daily-job.ts`, `lib/cron/default-deps.ts`,
`lib/ingestion/job-run-summary.ts`, `lib/ingestion/job-runs.ts` are byte-identical in behavior to
round 1 — the fix is test-only, as HANDOVER.md states, and I found no other code diff during
review).

### AGENTS.md non-negotiables

Unchanged from round 1's assessment (see above) — the round-2 fix touches only test files, so no
new secrets, AI, adapter, i18n, or number-display surface was introduced. Secrets handling is now
proven with the exact "in the environment" shape AC4's wording requires, closing the round-1 gap
between the plan's sketch and the delivered tests. No `.skip`/`.todo`/`xit`/`xdescribe` in the new
tests. No git commands were run during this review.
