# Sprint 13 closeout audit

Date: 2026-10-08

**Auditor context:** This is the requested fallback audit context, not the unavailable dedicated
`tech-lead` agent. No story, status, or delivery state was changed.

## Scope and method

Read `dev_minions/roles/technical-lead.md`, `backlog/sprints/sprint-13.md`, DEC-025 through
DEC-028, US-053 through US-058, their plans, review/test verdicts, QA checklists and available QA
runs, the Sprint 13 records in `HANDOVER.md`, and the current Story board in `status.md`. Compared
each story's acceptance criteria with the latest review/test disposition and available QA
evidence. Checked the test files and cited identifiers for the final verdict evidence, inspected
material current source where a finding depended on behavior, and checked the plan's expected
test identifiers against the actual test inventory.

This was a static audit: no tests, build, QA, or live checks were run. QA outcomes below are
reported from the existing QA-run files, not re-executed. No Git, secret, live-resource,
production-migration, or deploy command was run by this audit. DEC-028's decided
OpenAI-compatible `strict: false` is consistent with the implementation and is not a finding.

## Per-story disposition

### US-053 — Chat state and all-ETF widget actions

- **AC1 — MET:** recorded gates and deliberate test changes (`US-053-tests.md`).
- **AC2 — MET:** prompt context and injection containment, CP-5..CP-8 and T-8.
- **AC3 — MET:** `*` expansion, limits, and add/remove rejection, RT-1..RT-5 and CE-A1..CE-A3.
- **AC4 — MET:** clear/update-by-description flows, T-1..T-4.
- **AC5 — MET:** no-symbol default scope, T-5 and CP-8.
- **AC6 — MET:** validate-before-execute/order, CE-A4..CE-A6 and T-6.
- **AC7 — MET:** inactive ETFs excluded/rejected, RT-6 and T-7.
- **Evidence check:** Round-1 review and test verdicts (`US-053-review.md`,
  `US-053-tests.md`); the listed identifiers and cited files exist.
- **Review/tests:** PASS, Round 1. The tester recorded 224 files / 2,341 tests and passing
  typecheck, lint, build, and predeploy gates on that tree.
- **Codex QA:** PASS, run 1 (`US-053-qa-run.md`, 2026-10-05), also on its then-current tree.
  Live provider/Neon observations remain user-only; no live behavior is claimed here.
- **Disposition:** No audit finding. QA passed on an earlier tree; later shared-chat work is not
  represented by that QA run.

### US-054 — Prompt normalization for small models

- **AC1 — MET:** gates, deliberate changes, and no loosened test (`US-054-tests.md`).
- **AC2 — MET:** normalizer unit table NM-1..NM-13 covers the specified normalizations and strict
  failures.
- **AC3 — MET:** recorded regression fixture/table passes; per-row and fixture self-checks exist.
- **AC4 — MET:** prompt safety, closed operation set, and message-is-data rule are pinned by
  CP-9..CP-12 and PE-1.
- **Evidence check:** Round-1 review and test verdicts (`US-054-review.md`,
  `US-054-tests.md`); the identifiers cited above exist.
- **Review/tests:** PASS, Round 1.
- **Codex QA:** BLOCKED, run 1 (`US-054-qa-run.md`, 2026-10-06). Focused tests, typecheck, lint,
  full suite (228 files / 2,475 tests), and build passed; the predeploy full-suite rerun hit
  concurrent PGlite hook timeouts in two files, which passed on isolated retry. No later QA rerun
  is recorded.
- **Disposition:** No implementation finding established by the recorded QA result. The QA block
  is a non-blocking Note for this audit, as requested.

### US-056 — More provider presets and connection test

- **AC1 — MET:** current gates and disclosed test changes.
- **AC2 — MET:** catalogue/registry, fixed endpoints and URL-free settings form (PC, PS, PMF).
- **AC3 — MET:** fake-fetch connection results and safe closed error output (CT, TC, TF, RM-C).
- **AC4 — MET:** stored-key precedence and provider/key boundaries (PP-1..3 and boundary suites).
- **Evidence check:** Round-2 review/test verdicts (`US-056-review.md`, `US-056-tests.md`);
  current-tree PDX-8/PA-C2 cover the repaired missing-database path, and cited identifiers exist.
- **Review/tests:** PASS, Round 2. The tester recorded 259 files / 2,798 tests, passing
  typecheck/lint/build and a WSL predeploy pass.
- **Codex QA:** run 1 FAIL (`US-056-qa-run.md`, 2026-10-08), against the in-progress shared tree:
  14 chat assertions failed and `/admin/ai` returned HTTP 500 without a database. The round-2
  evidence covers the chat regressions and tests the safe error path, but explicitly did not run
  a QA-server or HTTP route probe after the fix. No QA rerun is recorded.
- **Disposition:** The old QA failure is not evidence of a current regression, but its route
  observation remains un-rechecked by QA. No audit blocker from this QA history.

### US-057 — Custom OpenAI-compatible provider

- **AC1 — MET:** current gates and deliberate changes.
- **AC2 — MET:** custom-provider URL/name validation and normalization tables (CPV/CPC).
- **AC3 — MET:** URL change and encryption AAD binding/rollback (KB-1..KB-4, KB-P1, CPP-3..6).
- **AC4 — MET:** custom-provider chat/connection round trip through fake fetch (CPE-1..4, PDX).
- **AC5 — MET:** redaction, boundary, and expand-only migration tests (CPB, SC-CP, MG-3/PM-6
  evidence as reconciled below).
- **Evidence check:** Round-2 review/test verdicts (`US-057-review.md`, `US-057-tests.md`) include
  the current full suite and PDX-8/PA-C2 shared error-path regressions; cited identifiers exist
  except the explicitly noted plan-only MG-3.
- **Review/tests:** PASS, Round 2. The tester recorded 259 files / 2,798 tests and passing
  typecheck, lint, build, and predeploy gates. Its first Windows predeploy attempt failed before
  the gate because `pnpm` was unavailable in that shell; the WSL login-shell retry passed.
- **Codex QA:** run 1 FAIL (`US-057-qa-run.md`, 2026-10-08), against the in-progress shared
  tree: the same 14 shared chat failures and the same no-database `/admin/ai` HTTP 500. The
  current independent tests cover those shared fixes, but no QA rerun or post-fix HTTP check is
  recorded.
- **Disposition:** No current product failure established by the historical QA run. The QA report
  also says its `Stop-Process -Id 47596 -Force` cleanup attempt returned `Access is denied` and a
  later probe found port 3101 listening; whether that local server remains is unknown and was not
  checked or stopped by this audit.

### US-055 — Conversational assistant

- **AC1 — MET:** gates and no weakened behavior assertions (Round-3 test verdict).
- **AC2 — MET:** natural reply text and localized result projection (CC/RC/CRC tests).
- **AC3 — MET:** validation/execution failures suppress false success and retain failure state.
- **AC4 — MET:** 21-message memory, shortening, and New conversation reset (HI/TH/ChatPanel tests).
- **AC5 — MET:** clarifying dialogue and short-answer follow-up (CC and D02/D03).
- **AC6 — MET:** setup questions return grounded answers without execution (CC-8, D04/D05).
- **AC7 — MET:** 2,000-character acceptance / 2,001-character refusal (CE-1/CE-2/CPG-1).
- **AC8 — MET:** Round 3 adds exact per-turn raw action and reply-state expectations to the
  conversation fixture/driver; Round 2's AC8 gap is closed.
- **AC9 — MET:** key-request refusal, message-as-data, closed operations, and boundaries.
- **Evidence check:** Round-3 review/test verdicts (`US-055-review.md`, `US-055-tests.md`); cited
  dialogue, history, reply, and transcript identifiers exist. The planned D12 fixture dialogue is
  absent, with New conversation behavior covered separately (Note below).
- **Review/tests:** PASS, Round 3. The Round-3 reviewer says the gates were not re-run in that
  review; the independent tester records the current 259-file / 2,799-test predeploy pass.
- **Codex QA:** run 1 BLOCKED (`US-055-qa-run.md`, 2026-10-08) while US-058 was changing shared
  chat behavior. The failures were the then-current expected call-count/plan-refusal mismatches,
  not a demonstrated US-055 defect. No later QA rerun is recorded.
- **Disposition:** No audit finding. Round-3 per-turn proof closes the documented AC8 gap; the
  earlier QA block remains a non-blocking Note.

### US-058 — Confirmation, self-correction, and structured output

- **AC1 — MET:** recorded gates, no weakened tests, and deliberate changes (Round-2 test verdict).
- **AC2 — MET:** protected actions propose before writes; typed/button confirmation and cancel
  behavior, with PGlite CEP-C1.
- **AC3 — MET:** exact plan and service refusal tests CF-3/4, CF-7..10, plus PGlite CEP-C1.
- **AC4: NOT MET — see Critical finding C1.** The recorded review and tester mark it MET, but
  current code sends only the first validation failure to the correction call, contrary to
  US-058 plan §14's all-failures requirement. The planned fake-fetch correction integration and
  multi-invalid case are not present in the current correction test.
- **AC5 — MET:** provider-specific modes, fallback, and Gemini schema; GM-S1 checks Gemini's converted and
  serialized slot schema; provider mode/fallback, key boundary, and closed-action tests are
  cited and present. DEC-028's `strict: false` is the decided behavior.
- **AC6 — MET:** key boundary, sanitised handling, closed operation set, and boundaries (Round-2
  test verdict).
- **Review/tests:** PASS, Round 2. The tester records 259 files / 2,801 tests, typecheck, lint,
  offline build, and predeploy PASS. Round 1's Gemini-schema and confirmation-service test gaps
  were addressed in the later evidence.
- **Codex QA:** A checklist exists, but no `US-058-qa-run.md` is present. Live provider/Neon
  steps were not run; missing QA is a Note, not a blocker.
- **Disposition:** The AC4 audit finding means Sprint 13 is not ready for technical closeout;
  recommend reopening US-058 for the bounded fix and independent re-verification. No status-board
  edit was made.

## Findings, ranked by severity

### Critical

1. **US-058 AC4 — correction sees only the first invalid action, and its required integration
   evidence is absent.** `US-058-plan.md` §14 (line 140) says the evaluator validates every
   action, **collecting all failures**, while retaining the first as the user-facing
   `invalid_action`. In `lib/ai/chat.ts:278-283`, malformed/target/action validation returns
   immediately at the first invalid entry; at lines 363-364 the correction is built from exactly
   one `line` (`[line]`). Therefore a multi-action answer with multiple validation failures does
   not give the model all the specific reasons required by the plan and story's AC4
   (`backlog/stories/US-058.md:21-22, 36-38`); the single correction round can spend its only
   retry fixing only the first disclosed failure. The current `chat.correction.test.ts:65-123`
   has four generic `it` cases, uses `createFakeProvider`, and covers only one invalid action per
   correction attempt; there is no multi-invalid correction assertion. This also does not meet
   the story/plan's stated fake-fetch test method. The Round-1 test verdict inaccurately described
   that file as using real adapters plus fake fetch; Round-2 review/test text correctly describes
   the fake-provider scope, but still marks AC4 MET. **Required proof/fix:** collect all
   validation failures for the correction message while preserving the first user-facing failure;
   add a multi-invalid regression and an adapter/fake-fetch correction-path test (including the
   bounded call behavior); rerun the affected gates and obtain independent AC4 review/test
   verdicts. This is a criterion gap, so recommend US-058 be reopened.

### Notes (non-blocking)

1. **QA is incomplete for the final shared tree.** US-054's only Codex run is timeout-BLOCKED;
   US-055's is BLOCKED during US-058 work; US-056/057's are FAIL on shared-tree regressions and a
   no-database HTTP 500 observed before their round-2 fixes; and US-058 has no run file. The
   later independent test/review evidence resolves the recorded code/test failures, but does not
   substitute for the missing QA reruns or route probes. Per the requested audit rule, this is a
   Note, not a blocker.
2. **Some planned test artifacts were consolidated or omitted.** The six US-058 plan-listed
   dedicated files (`chat.confirm.test.ts`, `chat.confirm.pglite.test.ts`,
   `action-list.schema.test.ts`, `reply-messages.confirm.test.ts`, `actions.confirm.test.ts`,
   `ChatReply.confirm.test.tsx`) are absent; much of their service, schema, transcript, and
   proposal coverage is in existing suites, but the confirmation Server Action has no dedicated
   unit test. US-057's planned `MG-3` identifier is likewise absent; its review transparently
   substitutes the generic `MD-G10` guard plus migration inspection. US-055's planned D12 fixture
   dialogue is absent, with new-conversation behavior covered separately. These are recorded
   evidence deviations; they do not independently overturn the consolidated coverage.
3. **Local QA-server cleanup is unresolved.** The US-057 QA report records the denied
   `Stop-Process` and subsequent listener probe on port 3101. This audit intentionally did not
   run QA, inspect the port, or terminate any process.
4. **Status overview is stale.** `status.md`'s Sprint 13 overview still says “Ready — next for the
   dev loop” and its progress paragraph says to restart development; the individual Sprint 13
   Story board rows (lines 174-179) correctly show all six stories as Awaiting QA. No status edit
   was made.

## Sprint close disposition

**FINDINGS — do not close Sprint 13 yet.** Five stories have no new technical blocker in this
audit and remain in their recorded Awaiting QA states. The historical QA failures/blocks are
non-blocking per the user's direction and are not grounds to mark anything Done. US-058 has one
Critical AC4 gap; return it for the specific correction behavior/test coverage above, then
re-review/re-test that criterion before closing the sprint. This audit does not change the Story
board or accept any story.

## Follow-up — US-058 AC4 re-verification (2026-10-09)

The reopened Critical AC4 finding was fixed in `lib/ai/chat.ts`; `evaluateAttempt` now collects
all validation failures for the correction prompt while retaining the first failure as the
user-facing result. `lib/ai/chat.correction.test.ts` adds a multi-invalid case and a fake-fetch
integration through the real Gemini adapter: schema rejection, JSON-object fallback, then one
correction call, exactly three requests total.

Independent fallback review and test verification both PASS for AC4 only in round 3
(`US-058-review.md`, `US-058-tests.md`). The tester ran 5 focused files / 86 tests and typecheck;
both directly checked the reopened criterion. Round-2 evidence for the other five criteria and
the implementer's post-fix full local gates remain recorded separately. No full suite, lint,
build, predeploy, live QA, migration, or deployment was run by the round-3 independent verifiers.
The implementation had already run full local gates after the fix (259 files / 2,803 tests,
typecheck, lint, offline build and predeploy PASS).

**Updated disposition:** the audit's only Critical finding is closed for development; US-058 is
Awaiting QA after round-3 review/test PASS. All six Sprint 13 stories are now Awaiting QA.
Sprint 13 development is complete; the outstanding work is separate Codex QA, user-only live
provider checks and user acceptance. No story is marked Done here.

## Denied or attempted commands

## Tech-lead closeout — 2026-10-09

Static check, no tests re-run. C1 is closed: `lib/ai/chat.ts` collects every validation failure and passes all lines to the single correction request, while the first failure stays the user-facing result. `lib/ai/chat.correction.test.ts` has the multi-invalid case ("includes every validation failure in one correction request"). Notes 1, 2 and 4 are accepted as non-blocking; `status.md` Sprint 13 rows are already current. Codex QA for US-058 passed on 2026-10-09 (status board). DEC-029 (model per provider, US-041/056/057 reopen fix) set Decided. **Sprint 13 is closed for development.** Only user acceptance remains (no `[x]` ticks in `DEMO-20261009-0956.md` yet). Note 3 (QA server on port 3101 possibly still listening) needs the user to check and stop it.

## Denied or attempted commands
- **This audit:** none.
- **Recorded in reviewed sprint evidence:** `git diff --stat -- components/admin/AiSettingsAdmin.tsx`
  was attempted and denied during US-057 Round-1 review; it was not retried and is disclosed in
  `US-057-review.md`. The US-057 QA cleanup attempt `Stop-Process -Id 47596 -Force` returned
  `Access is denied`; the report records a later listener probe and possible remaining local
  server. No other denied/attempted Git or secret command was found in the reviewed Sprint 13
  verdicts.
