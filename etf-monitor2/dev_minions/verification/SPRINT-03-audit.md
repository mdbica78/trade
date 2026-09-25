# Sprint 3 audit: Automation & persistence

Auditor: tech-lead subagent (in-loop, DEC-009), 2026-09-25.
Scope: US-012, US-013, US-014 and US-015. All four are Awaiting QA and none is in progress. For each story I read the story, the plan
(where it bore on a criterion), the review and test verdicts, any `US-XXX-qa-run.md`, and the
changed code. I checked each acceptance criterion against the code and tests myself.

Commands I ran (with `NODE_EXTRA_CA_CERTS` exported):
- `pnpm test` (once): **45 files, 613/613 passed**, exit 0.
- `pnpm typecheck`: exit 0.
- `pnpm lint`: 0 errors. The 2 warnings are already known: `types.test.ts:10`, `load-etfs.test.ts:23`.

I ran no git command and read no `.env*` file.

Independent checks, beyond reading the code:
- **Neon HTTP batch result shape (US-012/013/015).** Offline, `rowsOf()` (`lib/ingestion/store.ts:37-46`) is only
  exercised through PGlite. I read the installed `drizzle-orm@0.45.3` `neon-http/session.js` `batch()`
  and `pg-core/query-builders/raw.js`, and the installed `@neondatabase/serverless@1.1.0` `transaction()`. In a
  batch, `db.execute(sql…)` is a `PgRaw` with `isResponseInArrayMode() === false`. The per-query
  `arrayMode` overrides the batch-level `arrayMode: true`, and `mapBatchResult` returns the full-results object.
  So production gets `{ rows: [ {col: value} ] }`, which `rowsOf` handles. `findReport`,
  `saveReport`'s `already_ok` detection, the ETF loader and `startRun` therefore read real columns, not
  `undefined`, on Neon. The first live trigger (US-013 AC9) is still the proof of record.
- **Cited test IDs.** I extracted every test id cited in the four `-review.md` and `-tests.md` files and
  looked each one up in `lib/`, `app/` and `test/`. All but one either exist or are unlabelled tests whose content matches the citation, or are
  earlier ids that later stories renamed (e.g. US-013's H-1f is now the composed H-15a). The one exception is C1.
- **Process.** I parsed the Sprint 3 autopilot logs (`autopilot-20260924-155941-a1`,
  `-20260924-223925-a1`, `-20260925-015357-a6`, `-20260925-093832-a1`: every `tool_use` and every
  `is_error` `tool_result`, subagents included). There is **no git command**, **no `.env*` read**, and **no
  permission denial** this sprint. The errors are all ordinary ones (a missing file, one
  concurrent-build lock, one malformed Read call, one failed Edit). The Codex loop is not in these logs and is out of scope.

Verdict: FINDINGS

There is one Critical finding, and it re-opens **US-015** for a small test-only fix round. The code
behaves correctly. What is missing is the test that AC4 names, and the test verdict cites that test
as if it existed.

## Per story

| Story | ACs checked against code/tests | Result |
|---|---|---|
| US-012 | AC1–AC9. Task-1 step order (adapter, then discover … persist). Report date only from `result.reportDate` (`ingest-etf.ts:218,242,257`). BD-3 source-scans for clock/`publishedAt`. Pattern (a): one `run()` per save, `report_id` resolved by subquery inside the batch, every statement guarded `status <> 'ok'`, `ok` set only in the final `UPDATE … RETURNING` (`store.ts:61-98`). PGlite proves rollback (PG-4b), the ordering (PG-4c) and the race guard (PG-5a). The AC3/AC7 "write nothing" paths were superseded by US-014, as the story's tech-lead review specified | OK. N6 |
| US-013 | AC1–AC10. Fail-closed on an unset or blank secret, before the header is read. Constant-time digest compare. `redact()` on every response (`daily-handler.ts:30-49`). The loader filters `is_active` in SQL and orders by `display_order, field_key` (proved on PGlite, LP-2b), and the runner also skips inactive ETFs. The loop is sequential and a throw becomes `internal_error`. `vercel.json` has one entry, `0 10 * * *`. The route exports exactly GET/runtime/dynamic/maxDuration=60. README §Daily ingestion covers AC8. AC9 is MANUAL-QA and still pending on the user | OK. N3 |
| US-014 | AC1–AC9. The adapter resolves before any fetch. `missing` carries its reason. Every `fetch_error` carries its kind and status. `canHandle` false stops `extract` (IF-4c), with no `detect` fallback (BD-14b). An incomplete extraction writes a `parse_error` row with the found values, and a violation with a valid date writes a `parse_error` row with no values. An invalid date writes no row. The `ok`-never-downgraded guard is in SQL on every statement (PG-14d/e cover the zero-values delete case the sprint review flagged). The closed vocabulary has a typed `Record` trigger map (IF-8a) | OK. N4, N5 |
| US-015 | AC1–AC3, AC5–AC8, AC10 hold. The sweep then start run before any ETF. Errors are counted by exclusion from the success set. The sweep uses a strict `<`, appends to the log and leaves `finished_at` NULL (JP-6a/b/c). The threshold (15 min) is greater than `maxDuration` (RT-15). `finishRun` is attempted once, and a `jobRunId`/`status` pair is in the 200 and 500 bodies. **AC4 is not met as written**: see C1 | **Re-open**: C1. N6 |

## Critical

**C1 (US-015): the AC4 test that uses secrets set in the environment does not exist. The test verdict cites it anyway.**
- US-015 AC4: "A test with the secret and database URL set **in the environment** asserts that neither
  value appears **in the log or in the response**." The plan specified that test as H-15b
  (`dev_minions/verification/US-015-plan.md:70`). It stubs `CRON_SECRET`/`DATABASE_URL` with `vi.stubEnv`, uses
  the real `defaultDailyCronDeps.readEnv` and `run: (ctx) => runDailyJob({… secrets: ctx.secrets})`, and
  asserts on both the stored `finishRun` log and the response. It also has an aborted-run case.
- No test with the id H-15b, or with that content, exists anywhere in `lib/`, `app/` or `test/`.
  `dev_minions/verification/US-015-tests.md:30,49,64` nevertheless lists "H-15b" as AC4 evidence
  ("environment end-to-end"). That is a verdict citing a test that does not exist. The review
  (`US-015-review.md`, AC4, and its Note 2) marked AC4 MET on "equivalent coverage", but the coverage it relies on does not make the check:
  - `lib/cron/daily-handler.test.ts:179-242` (H-6c) checks **responses only**, and uses a hand-built env object.
  - `lib/cron/daily-job.test.ts:189-200` checks the **stored log**, but injects `secrets: [secret]`
    directly into `runDailyJob`.
  - No test reads secrets from `process.env` and follows them to the stored log. The production glue that carries
    them there, `lib/cron/default-deps.ts:7,13` (`readEnv` → handler `secrets` → `runDailyJob({ secrets })`),
    has **no test at all**. If it passed `secrets: []`, every test would stay green, and a Neon error
    message quoting `DATABASE_URL` would be written verbatim into `job_runs.log` (AGENTS.md secrets rule, FR13).
- Today's code is correct: I read `lib/cron/default-deps.ts:13`, and it passes `secrets` through. The finding is an
  unmet acceptance criterion plus a verdict that is not true, which is exactly what this audit exists to catch.
- **Fix (test-only, one round):** add the plan's H-15b to `lib/cron/daily-handler.test.ts` or
  `app/api/cron/daily/route.test.ts`:
  1. `vi.stubEnv('CRON_SECRET', S)`, `vi.stubEnv('DATABASE_URL', U)`.
  2. Build deps as `{ readEnv: defaultDailyCronDeps.readEnv, run: (ctx) => runDailyJob({ now, jobRuns: fakeStore, runIngestion: fake, secrets: ctx.secrets }) }`.
     Outcome details (including an `internal_error`) must contain S and U.
  3. Assert that neither S nor U appears in the `finishRun` log or the response text.
  4. Add a second case in which `runIngestion` throws `new Error(\`connect failed: ${U}\`)`. The aborted log and the `500` body contain neither S nor U.
  5. Add one test that exercises `defaultDailyCronDeps.run` itself, with `createDefaultJobRunStore`/`createDailyRunDeps` mocked, and asserts that the `secrets` it receives reach `runDailyJob`. This closes the untested glue.

  Then correct `US-015-tests.md` in the new round. Re-run both gates.

## Warning

**W1 (Codex QA runs): the evidence is mostly claimed, not shown.**
- `US-012-qa-run.md:8-16` gives every row as "passed in the focused 56/56 run", with no command line and
  no output excerpt.
- `US-014-qa-run.md:8` says "Focused offline ingestion/PGlite/cron suite completed successfully", with no
  command, no count and no output. `US-014-qa-run.md:10` says "completed successfully" for the full suite, with no count.
- For US-013, the counts in `US-013-qa-run.md:8` ("32/32" across "Five focused suites") disagree with the
  Codex log line in `HANDOVER.md` (§QA/Deploy log, 2026-09-25 09:44: "38 checks across six suites").
- The checks were plausibly real: my own full run is green, and US-013 row 5 does show a real served-app response. But DEC-012/`roles/qa.md` evidence
  should quote the command and its tail output. Nothing machine-checkable was pushed onto the user. Every "for the user" item is a genuine
  live-account, live-DB or PO-judgment item, and there were no QA FAILs, so no fix-round matching was needed.
  **Owner:** the Codex loop brief (`roles/qa.md`). This is not a story defect.

**W2 (verification process): the story-tester copied a test id from the plan, not from the code.**
- C1's phantom "H-15b" is the first time this project has seen a test verdict cite a test that does not exist. Every other
  cited id in Sprint 3 resolves.
- If this recurs, the tester brief should require each cited test id to be `grep`-confirmed in the
  test files. That is a kit change for the standing Technical Lead chat. No DEC is proposed for one occurrence.

## Note

- **N1: QA runs pending.** US-015 has no `US-015-qa-run.md` yet. That is normal under DEC-013. US-012, US-013
  and US-014 have one (all PASS).
- **N2: board rows.** `status.md:75-76` (US-013, US-014) do not yet show the Codex QA PASS that
  its own log (HANDOVER §QA/Deploy log, 09:44/09:53) and the qa-run files record. US-012's row does. That is Codex's
  write scope, and I'm flagging it only.
- **N3: possible flaky test.** `app/api/cron/daily/route.test.ts` re-imports the whole ingestion chain
  (incl. `unpdf`) after `vi.resetModules()` in every test. Codex saw one timeout at WSL startup in an aggregate
  run (`US-013-qa-run.md:8`). Consider an explicit per-file timeout if this recurs.
- **N4: dead catch.** `lib/ingestion/ingest-etf.ts:132-140`: `ingestReport` cannot reject, so the outer
  catch that labels failures `persist_error` is unreachable. A future step that could throw would be labelled wrongly
  (carried from `US-014-review.md` Note 1). Relatedly, `ingest-etf.ts:83-91` maps a *throwing*
  `registry.get` to `no_adapter`. A `Map` lookup cannot throw today, but US-024 will show that code as "adapter missing".
  An internal failure would be better reported as `internal_error`/`parse_error(unexpected)`. Not a criterion breach.
- **N5: IF-8c depends on test order.** `lib/ingestion/ingest-etf.failures.test.ts:747` asserts over a
  module-level accumulator (`test/helpers/ingest-fakes.ts:12`) that the earlier IF tests fill. Run alone
  (`-t IF-8c`), it fails on `length > 0`. It is correct under Vitest's default in-file sequential order.
- **N6: small debts carried from the reviews.** There are two `already_ingested` return sites (`ingest-etf.ts:49,62`, now via
  the shared `persist()`). `job-run-summary.ts:7` duplicates the `RunStatus` union instead of importing
  `FinalJobRunStatus`.
- **N7: reviewers deleted `.next/lock`.** The US-013 and US-014 reviewers each deleted a stale `.next/lock` to finish `pnpm build`
  (`US-013-review.md:7`, `US-014-review.md:7-9`). It is harmless and was disclosed, but it is outside a strictly read-only review.
- **N8: still waiting on the user.**
  - Live MANUAL-QA for US-013 AC9 and US-015 AC9.
  - The Sprint DoD item "at least one scheduled run has written a `job_runs` row".
  - The two PRODUCT decisions from US-012, for the demo: tracked fields only vs every field, and catch-up filings.
