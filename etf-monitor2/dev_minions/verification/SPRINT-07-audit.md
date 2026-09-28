# Sprint 7 audit — Hardening (US-029, US-030, US-031)

Auditor: `tech-lead` subagent (in-loop, DEC-009), 2026-09-28. Mode `sprint-audit 7`.

Verdict: FINDINGS

No Critical finding, so no story is reopened. There are six Warnings. They are about test evidence and process, not
shipped behaviour. The full suite passes on my own run.

## What I did myself
- Read the three story files (with their tech-lead reviews), the review and test verdicts for each story, the Codex QA
  runs for US-029 and US-030, the three QA checklists, and the roadmap's Sprint 7 carry-forward notes.
- US-031: read `test/e2e/daily-pipeline.pglite.test.ts`, `test/e2e/fixture-web.ts`, `lib/cron/default-deps.ts`,
  `lib/ingestion/default-deps.ts`, `lib/smoke/deploy.ts`, `lib/smoke/deploy.test.ts`, `scripts/smoke-deploy.ts`,
  `lib/health.ts`, `app/health/page.tsx`, `app/health/page.failure.test.tsx` and the FC-TT tests in
  `components/FieldChart.test.tsx`, all in full.
- US-030: read `ingestNoAdapter` (`lib/ingestion/ingest-etf.ts:156-189`), `lib/ingestion/report-links.ts`,
  `buildLatestReportLinksStatement` (`lib/monitoring/home.ts:112-134`), the deadline guard
  (`lib/ingestion/run-daily.ts:1-100`), `lib/config/detect-adapter.ts`, `test/helpers/pglite.migrations.test.ts`,
  `lib/config/etfs.report-link.pglite.test.ts`, `app/chat/add-paths.pglite.test.ts` (setup and AP-1/AP-3) and
  RT-7b/RT-7d.
- US-029: checked the verdicts' claims against the test files. I grepped every cited test id. I did not re-read the
  `intercapital-nav.ts` extraction logic line by line; for that I rely on the reviewer's independent transcription of
  the PDF (`US-029-review.md:37-48`).
- Grepped every test id cited in the three test verdicts. All exist except the two listed under W3.
- `pnpm test` (run once, with `NODE_EXTRA_CA_CERTS` exported) → exit 0 → `Test Files 155 passed (155)`,
  `Tests 1683 passed (1683)`, duration 138.11s.

## Per story
- **US-029** (Awaiting QA; Codex QA BLOCKED by a flaky test): AC1–AC6 and AC8–AC10 are backed by tests that exist.
  AC7 does not apply (the ADAPTER branch matches FINDINGS §4). There is no Critical finding. See N3 and N4.
- **US-030** (Awaiting QA; Codex QA BLOCKED by a flaky test): the behaviour is correct. AC2's evidence does not use the
  test method the AC names (W1). One AC8 test is vacuous (W2). The test verdict cited tests that did not exist (W3).
  The round-1 fixes are correct (N6).
- **US-031** (Awaiting QA; no Codex QA run yet, N1): AC1–AC7 verified against the code. The pipeline test really
  drives the shipped handler, job, ingestion, discovery, PDF and adapter chain. Only `getDb` is mocked (asserted never
  called) and global `fetch` is replaced by a recording guard (asserted 0 rejected, exact 9-call sequence). The test
  verdict has unsupported citations (W4).

## Critical
None.

## Warning
- **W1 — US-030 AC2: the test method differs from the AC text.** AC2 says "PGlite tests mock detection's `fetch` over the
  BRD page fixtures". The tests stub `detect` wholesale with literal `DetectionResult`s
  (`lib/config/etfs.report-link.pglite.test.ts:28-29`, used by RL-1..RL-8), and `app/chat/add-paths.pglite.test.ts:8,23-26`
  does the same. No PGlite test runs addEtf → the real `detectAdapter` → a fixture `fetch` → the `etf_report_links` row.
  The behaviour is proven in two separate pieces:
  - `lib/config/detect-adapter.test.ts` DA-1/4/6/7/8b set `reportUrl` over the real fixtures. DA-5 (unreadable) does not
    assert `reportUrl`.
  - RL-1..RL-7 store the link on PGlite.

  The two pieces are joined by a type-checked function reference, so this is not a behaviour defect. However, the
  reviewer flagged the deviation (`US-030-review.md:126-135`, W2) and the dev loop accepted it "as-is". The
  implementing session should not accept a deviation from AC text by itself. Fix: add one PGlite case to
  `etfs.report-link.pglite.test.ts` that builds deps with the real `detectAdapter` and a `fetchImpl` over
  `test/fixtures/bvb/BTBETRETF-instrument-2026-09-23.html` plus a non-PDF body for the download (reason `unreadable`).
  It should assert that the link row equals the fixture's newest `.pdf` href. This can be done next time the file is
  touched. It does not reopen the story.
- **W2 — US-030 AC8: RL-8 is vacuous.** `lib/config/etfs.report-link.pglite.test.ts:133-138`, "a rejected-shaped href
  (javascript:) … stores no link", stubs `detect` to `{ adapterKey: null, reason: "not_found" }` with no URL at all. No
  `javascript:` href enters the chain, so the test would pass whatever `addEtf` did with URLs. AC8's "a test with a
  `javascript:` href in the page fixture stores nothing" is covered only in parts:
  - `lib/extraction/discovery.test.ts:228` (never a discovery candidate);
  - `lib/ingestion/report-links.test.ts:16-17,43-48` (`isStorableReportUrl`, store returns `rejected_url`);
  - `lib/ingestion/ingest-no-adapter.test.ts:102` (NA-7).

  The shipped code is safe (`report-links.ts:12-23`). Fix: rename RL-8 to say what it proves, or drive it through the
  real discovery over a page fixture with its href replaced by `javascript:`.
- **W3 — US-030 test verdict cites tests that did not exist.**
  - `US-030-tests.md:20-21` cites PM-1/PM-2 in `test/helpers/pglite.migrations.test.ts` "(implied by passing suite)".
    That file was created only in the round-1 fix, after the verdict; the reviewer confirmed it was absent
    (`US-030-review.md:121-123`).
  - `US-030-tests.md:60` cites "NAP-1". No test with that id exists anywhere in the tree (grep over `lib app components test`).
  - Several other rows use "Suite passed" in place of a named test: lines 57-58, 76, 88, 133, 141, 144.

  AC1 is now really covered: `test/helpers/pglite.migrations.test.ts:19-38` PM-1 (table exists) and PM-2 (cascade
  delete), which I read. This is the third sprint in a row with this tester pattern (Sprint 5 W1/W4, Sprint 6). It is a
  kit item for the Technical Lead chat: the tester brief should forbid "implied by passing suite" as evidence.
- **W4 — US-031 test verdict claims evidence that did not exist.**
  - `US-031-tests.md:36` says DP-3 asserts "0 fetch calls". The reviewer ran in parallel and found no such assertion
    (`US-031-review.md:111-120`). It was added afterwards, as a fix in place (now
    `test/e2e/daily-pipeline.pglite.test.ts:394-395`).
  - `US-031-tests.md:112` claims the build with `DATABASE_URL` unset "succeeded" and, in the same line, says the test run
    "may not have exercised this". A result is claimed and disclaimed at once. The reviewer did run that build
    (`US-031-review.md:92-93`), so AC7 still has evidence.
  - `US-031-tests.md:101` places the README section "at or after 263". It is at `README.md:109`.
- **W5 — recurring timeouts under concurrent load block Codex QA (US-029, US-030).** `app/chat/page.safety.test.tsx`
  CPS-1 times out in the parallel full run (`US-029-qa-run.md:10`; also seen on US-026/US-028).
  `lib/cron/deadline.pglite.test.ts` times out in `beforeEach` at 10 s (`US-030-qa-run.md:9`). Both pass alone. Both
  stories are "Codex QA BLOCKED" because of test-timing flakiness, not because of a product defect. My own full run
  passed. Sprint 6 audit N5 assigned test timeouts to the Technical Lead chat as tooling work. That item is still open
  and now blocks two QA verdicts. Recommendation for the Technical Lead chat: raise `hookTimeout`/`testTimeout` for
  `*.pglite.test.*` and the chat page tests (vitest config or per-file), or limit worker concurrency for PGlite files.
  This is not a story reopen.
- **W6 — log scan for DEC-015 not done (my own command was denied).** My grep over the Sprint 7 logs
  (`automation/logs/autopilot-20260927-054226-a7.jsonl` … `autopilot-20260928-010255-a16.jsonl`) was meant to print
  only the text of `"command"` entries that match git or secret-file patterns. It was denied, and I did not retry it
  in another form. So I cannot confirm, from the logs, that no undisclosed git or secret command was run this sprint.
  Every Sprint 7 verdict file says "Denied or attempted commands: none". This is the same gap as Sprint 5 audit N1.
  The Technical Lead chat, or the user, should run that scan, or allowlist a command-text-only grep for this subagent.

## Note
- **N1 — US-031 has no Codex QA run yet.** This is not a blocker (DEC-013).
- **N2 — `US-030-qa-run.md:9` does not quote the full command.** It elides the file list with "…", so the exact command
  cannot be re-run from the QA run.
- **N3 — US-029 AC10's build with `DATABASE_URL` unset was not independently verified in its own round.**
  `US-029-tests.md:161` quotes only `pnpm build`, the reviewer did not re-run it (`US-029-review.md:123-124`), and the
  QA run did not build. It is covered afterwards by the US-030 tester's
  `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build` → 0 (`US-030-tests.md:195`) and by the US-031
  reviewer's run.
- **N4 — `US-029-tests.md:100` misdescribes FX-8.** It says FX-8 covers "all three BRD-style entries and ICBETNETF".
  FX-8 (`lib/extraction/fixtures.test.ts:386`) covers only `intercapital-nav`; the BRD consistency checks are a
  separate block (`:333`).
- **N5 — US-031 runbook wording.** `US-031-qa.md:32` expects `/health` to show "Conectat". The RO catalogue says
  "Conectată" (`messages/ro.json:243`). Also still open from the review: HP-F1 does not assert that the output
  contains no `postgresql://` string (`app/health/page.failure.test.tsx:48-63`). The risk is low, because
  `MissingDatabaseUrlError`'s message contains no connection string.
- **N6 — fixes applied in place without independent re-verification.** The main session applied these fixes after the
  verdicts, with "no re-review needed": US-030 W1/W3/W4 and US-031 W1. I checked each one:
  - PM-1..PM-3 at `test/helpers/pglite.migrations.test.ts:19-53`;
  - NA-5 now asserts `fetchImpl` called 3 times and 1 `saveReport` (`lib/ingestion/ingest-no-adapter.test.ts:143-156`);
  - RL-9's code list has 9 codes (`lib/admin/run-log.test.ts:112`);
  - DP-3 asserts `guard.calls`/`guard.rejected` empty (`test/e2e/daily-pipeline.pglite.test.ts:394-395`).

  All four are correct and the suite is green.
- **N7 — carry-forward notes: all handled.**
  - Column-label reconciliation: SL-1..SL-3, `lib/db/seed-data.test.ts`.
  - No-adapter report link: US-030.
  - FieldChart tooltip wiring: FC-TT1..FC-TT4.
  - `/health` missing DB and timeout: HP-F1/HP-F2, HC-1..HC-4.
- **N8 — design check, no defect.** In `lib/monitoring/home.ts:118-134`, a link row stored at add time for an ETF that
  has an adapter loses to that ETF's first `ok` report (`fetched_at` is later). A later re-detect makes the link win
  again, but it then points to the newest discovered PDF, which is what FR7 asks for. The deadline guard
  (`lib/ingestion/run-daily.ts:22-34`) uses only named constants. RT-7b (`app/api/cron/daily/route.test.ts:33-53`)
  would fail if `MAX_REQUESTS_PER_ETF` grew past the budget.

## Denied or attempted commands
- One `grep` over `dev_minions/automation/logs/*.jsonl` was denied and not retried (see W6). It was meant to print only
  command text that matches git or secret-file patterns. No git command was attempted. No `.env*` or credential file
  was read. No variable value was printed.
