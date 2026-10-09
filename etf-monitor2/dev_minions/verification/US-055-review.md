# US-055 — Independent review

## Round 1 — 2026-10-07
Verdict: PASS

Reviewed against `dev_minions/backlog/stories/US-055.md` (AC1–AC9), `dev_minions/verification/US-055-plan.md`,
DEC-027/DEC-025 §5, DEC-022, AGENTS.md. Read every file listed under "Files changed (US-055)" in
`dev_minions/HANDOVER.md` in full, plus the test files they reference. Grepped the whole tree for the string
`US-055` to confirm nothing outside that list was touched for this story: it appears only in the listed files
(`lib/ai/chat-results.ts`, `lib/ai/chat.conversation.test.ts`, `lib/ai/provider-deps.{test,custom.test}.ts`,
`lib/ai/chat.test.ts`, `lib/ai/capabilities/action-list.envelope.test.ts`,
`lib/ai/capabilities/configuration/prompt.ts`, `lib/ai/providers/{openai-compatible,gemini}.test.ts`,
`app/chat/actions.history.test.ts`, `app/chat/reply-messages.{ts,conversation.test.ts}`,
`components/chat/{ChatPanel.test.tsx,ChatReply.conversation.test.tsx,transcript.history.test.ts,transcript.ts}`).

I independently ran (all with `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/`AI_KEY_MASTER_KEY`/every `*_API_KEY`
unset):
- `pnpm typecheck` → 0 errors.
- `pnpm lint` → 0 errors, 23 warnings, the same `_name`-prefixed unused-test-arg style as prior stories (no new
  rule category).
- `pnpm build` (offline) → succeeds, `migrate-on-deploy: skipped (not a production build)`, the expected one
  sanitised `[load-error] home name=MissingDatabaseUrlError` line, all 12 dynamic routes including `/chat`.
- `pnpm test` (full suite, backgrounded, `timeout 590 pnpm test`) → **253 files / 2743 tests, all green**,
  matching HANDOVER's own count exactly.
- A focused run of every new/changed US-055 test file (24 files / 438 tests) plus
  `lib/ai/chat.conversations.pglite.test.ts` separately (16 tests) — all green.
- `bash scripts/claude/predeploy-check.sh` — launched; it was still running its own full-suite pass when this
  round's review window closed (same ~5-minute full-suite cost I had already paid directly). **Not awaited to
  completion**; I rely on my own direct typecheck/lint/build/full-suite runs above for AC1, not on this script's
  output — write "not re-run" for its specific exit line.

Acceptance criteria:
- AC1: MET — typecheck/lint/build/full suite all green as quoted above (own runs, not HANDOVER's). No existing
  behaviour test was loosened: every item under HANDOVER's "deliberate test changes" (`lib/ai/chat.test.ts` CE-1/
  CE-2/`CHAT_MESSAGE_MAX_LENGTH`, CE-G1/CE-G2; `app/chat/page.test.tsx` CPG-1; `app/chat/reply-messages.test.ts`
  RM-N1; `app/chat/reply-messages.golden.test.ts` G-R1; `lib/ai/capabilities/configuration/prompt.ts`/`.test.ts`
  CP-1/CX-1 envelope churn and the T-15 size-lever trims; `lib/ai/chat.pglite.test.ts` CEP-9 and the US-053
  T-1/T-3 case) is either a type-only churn with the assertion unchanged, or strictly adds a field to an exact
  `toEqual`/snapshot (stricter, not looser) — confirmed by reading each diff's context, not just HANDOVER's
  characterisation. CP-18's worst-case cap (170,000 chars, vs. the plan's untested 50,000 guess) is a new test,
  not a loosened one, and HANDOVER discloses the real measured size and the reason.
- AC2: MET — `lib/ai/chat.conversation.test.ts` CC-1 (`outcome.reply` equals the model's RO/EN text verbatim),
  `components/chat/ChatReply.conversation.test.tsx` CRC-1 (`'<script>alert(1)</script><b>x</b> https://evil.example'`
  renders with `&lt;script&gt;`, no `<script`, no `<b>`, no `href="https://evil.example"` — I ran this test
  myself), CRC-2 (heading order reply → "What the app did" → list), `lib/ai/capabilities/action-list.ts`'s
  `cutAtWord`/`REPLY_MAX_CHARS=600`/`QUESTION_MAX_CHARS=300` proven by `action-list.envelope.test.ts` ENV-8/ENV-9
  (own run, green). `ChatReply.tsx:67-68` renders `reply.modelText` only as a React text node
  (`<p className="whitespace-pre-line">{reply.modelText}</p>`), never `dangerouslySetInnerHTML` — read the file,
  confirmed no such prop anywhere in it.
- AC3: MET — `chat.ts:217-224` drops `reply` whenever the keyGuard/validation path returns anything other than
  `executed_actions` (an `invalid_action` never carries `reply` — confirmed by reading every return site in
  `handleChatMessage`); `lib/ai/chat.conversation.test.ts` CC-3 (`JSON.stringify(outcome)` does not contain
  "Done!" after an invalid 2nd action) and CC-4 (execution failure keeps `outcome.reply` but
  `results.map(r=>r.status)` is `["failed","not_run"]`) — both run myself, green.
  `app/chat/reply-messages.ts:198-237` sets `tone: "error"`/`warning: true` whenever any result is
  `failed`/`not_run`, even when `reply` is present, and `groupReply` reports the per-action status
  (`actionFailed`/`actionNotRun`) regardless of the model's reply — confirmed by reading the function and by
  `ChatReply.conversation.test.tsx` CRC-3/CRC-4 (own run, green).
- AC4: MET — `lib/ai/chat-history.ts`'s `prepareHistory` enforces the 21-message window, 400/6000/120-char caps
  (own run of `chat-history.test.ts` HI-1..HI-7, green); `lib/ai/chat.conversation.test.ts` CC-5 (22 history items
  in → 21 + current sent, oldest dropped — own run, green); `components/chat/transcript.history.test.ts` and
  `transcript.ts`'s `chatTurn`/`NEW_CONVERSATION_INTENT` prove "New conversation" returns `[]` without calling the
  server action and that the following turn's `history` field is `[]` (own run, 7 tests green).
- AC5: MET — (a) `lib/ai/chat.conversation.test.ts` CC-2/CC-6/CC-7 (a question, with or without actions, always
  yields `{kind:"answered", ...}` with no execute call); (b) CC-14 (grounding resolves an ETF symbol named only in
  an earlier user turn) and the D02/D03/D06/D07 dialogues in
  `test/fixtures/ai/chat-conversations.json` ("30 de zile", "the second one", "și pe 30 de zile", "remove that"),
  driven end-to-end against a real PGlite database by `lib/ai/chat.conversations.pglite.test.ts` (own run, 16
  tests green, including the D01/D06 direct `etf_widgets` row checks).
- AC6: MET — CC-8 (a setup-question reply with `actions:[]` never calls execute); D04 ("ce câmpuri urmăresc la
  PTENGETF?" + a follow-up) and D05 ("which custom values do I have?" + "what can you do?") in the same PGlite
  suite, both asserted `kind: "answered"` with no DB write (own run, green); `prompt.test.ts` CP-14/CP-15 (the
  setup-question rule, the "I don't see that in the app's data" sentence, and `assistant.provider/model` in the
  data block with no ETF `name`) — own run, green.
- AC7: MET — `CHAT_MESSAGE_MAX_LENGTH` is `2000` (`lib/ai/chat.ts:27`); `chat.test.ts` CE-1 (2001 → `too_long`),
  CE-2 (2000 accepted) and CC-9 (a full 2000-char message is sent verbatim as the final turn) all run myself,
  green; `app/chat/page.test.tsx` CPG-1 asserts `maxLength="2000"` (own run, green).
- AC8: MET, with a Warning (below) on test depth — the fixture
  `test/fixtures/ai/chat-conversations.json` has 11 dialogues (4 RO, 7 EN; both ≥ the AC8 floor), exactly one
  `transcript: true` dialogue (D01) replaying the 5 phrases from the user's 2026-10-05 script in order, and the
  self-check tests (`≥10 dialogues`, `≥4 RO and ≥4 EN`, `exactly one transcript dialogue`) pass. Every dialogue
  is driven end-to-end through the real `handleChatMessage`/`buildChatReply`/`appendTranscript` cycle against a
  seeded PGlite database and asserts `outcome.kind` (and, where applicable, whether anything changed); D01 and
  D06 additionally assert the real final `etf_widgets` row counts per ETF. I ran this file myself: 16/16 green.
- AC9: MET — the pre-existing key-request tests in `chat.test.ts` are unchanged and green; CC-10 (a key request
  with a non-empty history is refused before `depsFactory`/`fetch` are ever called), CC-11 (a reply containing the
  active key is dropped — `containsKeyMaterial` in `lib/ai/reply-guard.ts`, proven directly by `reply-guard.test.ts`
  RG-1..4), CC-12 (no `console.error` call ever contains the message/history/reply sentinel text) — all run
  myself, green. `lib/ai/boundaries.test.ts`, `lib/ai/capabilities/boundaries.test.ts`, `app/actions.boundary.test.ts`
  and `components/chat/ChatPanel.test.tsx` CV-4 (no `components/chat/*` file resolves an import under `lib/ai`)
  all pass with additions-only allowlist changes (`chat-history.ts`/`chat-results.ts`/`reply-guard.ts`) — own run,
  green.

Findings (ordered by severity):
1. (Warning, AC8) `lib/ai/chat.conversations.pglite.test.ts`'s per-turn generic test (`describe.each(DIALOGUES)`)
   asserts `outcome.kind`, `anyChanged` and provider-call count, but never inspects `reply.actions`/`modelText`
   for 9 of the 11 dialogues — only D01 and D06 get a direct DB-level check of the final `etf_widgets` state. The
   plan's own §3.1 described a richer per-turn fixture schema (`lines`, `results`, `tracked`, `widgets`,
   `historySent`, `modelText`) that was not carried into the shipped fixture/driver; AC8's literal "the result
   list shown" is asserted only indirectly (the reply pipeline runs without throwing) for most turns. This does
   not fail the criterion — the result-list rendering logic itself is thoroughly proven elsewhere
   (`app/chat/reply-messages.conversation.test.ts` RC-1..6, `lib/ai/chat-results.test.ts` GR-1..5,
   `components/chat/ChatReply.conversation.test.tsx` CRC-1..6) — but the conversation suite specifically is
   shallower than planned. Should fix before the next story that extends this fixture.
2. (Note) `historyMemo`'s `executed_actions` branch (`lib/ai/chat-history.ts:84-88`) emits a plain
   `"<status>: <action> — <symbol>"` line per result, not the richer bracketed detail tokens
   (operation/field/period/slot) the plan's T-6 described. The model's own prior `reply` text (also stored in the
   memo) still carries that detail in practice, and every grounding/memory test (CC-5, CC-13, CC-14, D02/D06/D07)
   passes, so this is a simplification that works, not a defect.
3. (Note) The plan named a twelfth dialogue, D12 ("New conversation" then a follow-up, `historySent: 0`), that
   is not in the shipped 11-dialogue fixture. The guarantee it would have proven (history is empty after "New
   conversation") is fully covered elsewhere (`components/chat/transcript.history.test.ts`, "the next turn after a
   'New conversation' sends an empty history"). Not a gap in coverage, just a plan/implementation naming
   mismatch, disclosed accurately in HANDOVER's own count ("11 dialogues").
4. (Note) `lib/ai/chat-results.ts`'s `groupResults` includes the full `detail` (including a resolved numeric
   `slot`) in its grouping key. For a `widget_clear`/`widget_update` by an explicit numeric `slot` that happens to
   land on different slot numbers per ETF (possible for a `match`-resolved slot expanded via `*`), this would
   produce more, not fewer, result-list lines than a looser grouping might — i.e. it fails safe (more detail
   shown, never silently merged into a wrong combined description). I did not find a test exercising this exact
   edge case one way or the other; it is not a violation of any stated acceptance criterion.
5. (Note, process) This story's own plan §6 D-1/D-2/D-3 (wording defaults) are disclosed inline in HANDOVER's
   "Active story" block with an explicit "to be logged under 'Waiting on the user' once this story closes out",
   consistent with how prior stories in this sprint recorded the same deferral. Not yet cross-referenced under
   "Waiting on the user" itself — expected to be fixed at story close-out, as with US-057 before it.

Scope deviations:
- None found. Every file touched carries a comment or a string naming "US-055", and grepping the repository for
  that string returns only the files on HANDOVER's "Files changed" list (both source and test).

Denied or attempted commands: none.

## Round 2 — 2026-10-08 (current shared chat tree)

Verdict: **FAIL** — AC8 NOT MET. This is an independent source/fixture review, **not** a
successful test run or a Codex QA rerun. Round 1's PASS and the QA run 1 BLOCKED record above
remain historical evidence, not evidence that the current tree passed this round.

Read `backlog/stories/US-055.md` (AC1–AC9), `verification/US-055-plan.md`, the Round 1 review
and test verdicts, `US-055-qa-run.md`, the current HANDOVER, Sprint 13's PO review and DEC-027.
Inspected the current `chat.ts`, `chat-history.ts`, `chat.conversation.test.ts`,
`chat.conversations.pglite.test.ts`, `chat.regression.test.ts`,
`test/fixtures/ai/chat-conversations.json`, `app/chat/{actions,reply-messages}.ts`,
`components/chat/{ChatPanel,ChatReply,transcript}.tsx`/`.ts`, and the conversational reply and
markup tests. The fixture was parsed independently with Node: **11 dialogues (4 RO, 7 EN),
24 turns, 23 recorded outputs, one five-turn transcript**; its per-turn expectation keys are
only `kind`, `anyChanged`, `providerCalls`.

### Findings

1. **Critical — AC8 (conversation regression assertions) NOT MET.** The fixture contains no
   expected executed action identities/statuses or expected result-list lines/model text for
   any of its 24 turns. The generic driver
   (`lib/ai/chat.conversations.pglite.test.ts:94-127`) builds the reply and transcript but only
   asserts final outcome kind, **whether any** result changed, optional warning and provider
   call count. In particular, it never asserts `reply.actions`, `reply.modelText`, the displayed
   result list, or which actions ran. D01/D06's separate database checks
   (`:130-179`) assert final widget **counts**, not descriptions or per-turn actions/results;
   the other nine dialogues lack even those state checks. Consequently, a regression that
   executes the wrong ETF/action or drops the per-turn result list can pass the dialogue suite.
   AC8 explicitly requires **each** scripted dialogue to assert actions run **and** the result
   list shown; the separate RC/CRC rendering unit tests cannot substitute for that integration
   assertion. This is the Round 1 AC8 Warning still present in the now-stable tree, not a
   previously unrecorded production defect. Add fixture expectations and compare per-turn
   `outcome.results` and reply-state lines/model text, including confirmation turns.
2. **Warning — confirmation/correction proof in the regression drivers is shallow.**
   The conversation driver automatically calls `confirmChatPlan` for a proposal
   (`:109-116`), bypassing the `chatTurn` client confirmation path; it then compares only the
   *post-confirmation kind* and the weak assertions above. Its `warning` assertion checks
   `reply` built **before** confirmation, not the confirmation reply. For invalid D08/D10 it
   queues the same invalid output twice and checks only that two calls occurred
   (`:96-102`, `:125-126`), not the correction reason/response. The separate 29-row
   `chat.regression.test.ts:185-210` likewise confirms automatically and checks final intents,
   not proposed/final result-list presentation. These limitations explain why the US-058 test
   updates can pass without closing AC8; focused correction/confirmation tests elsewhere
   remain useful but do not establish the missing dialogue-level assertions.

### AC assessment on the current source

| Criterion | Review result and personally inspected evidence |
|---|---|
| AC1 | **NOT RE-RUN.** Prior Round 1 gates and HANDOVER's newer shared-tree gate counts are not my test evidence. No claim of a fresh full-suite/predeploy pass or of byte-identical test assertions without git. |
| AC2 | **No source regression found:** `chat.ts` returns the model reply for successful actions, `reply-messages.ts` combines it with server-built lines, and `ChatReply.tsx` renders it as a React text node; inspected escaping/cap test cases in `ChatReply.conversation.test.tsx` and `action-list.envelope.test.ts` evidence cited in Round 1, not re-run. |
| AC3 | **No source regression found:** `chat.ts` suppresses text on `invalid_action` after correction, while `reply-messages.ts` reports failed/not-run statuses and warning for partial execution; correction and proposed-plan branches require the per-turn proof in finding 1. |
| AC4 | **No source regression found:** `prepareHistory` limits to 21 messages and bounds each/total length; `transcript.ts` resets on `new` and generates history for subsequent turns. |
| AC5 | **No source regression found:** question-only outcomes return without execution; recorded D02/D03 short-answer turns and grounding/confirmation logic are present, but the dialogue assertions remain incomplete. |
| AC6 | **No source regression found:** D04/D05 contain recorded setup answers with empty actions; their generic test asserts `answered`, but does not independently assert the reply text or per-turn absence of writes. |
| AC7 | **No source regression found:** `CHAT_MESSAGE_MAX_LENGTH = 2000`, with unchanged page/UI and boundary-case tests described in Round 1; tests not re-run. |
| AC8 | **NOT MET (Critical)** for the assertion gap above, even though dialogue count/language/transcript fixture minima are met. |
| AC9 | **No source regression found:** `chat.ts` refuses key requests before preparing history/provider calls and still validates through the closed registry; reply text remains a text node. Boundary/key-guard tests not re-run. |

### Execution limitation

Attempted **only** the six-file focused conversation/regression/reply test command through WSL
with DB, cron, deploy, master-key and all provider-key variables removed; it exited before tests
because pnpm could not remove the shared `node_modules/.pnpm` directory
(`ERR_PNPM_PACKAGE_MANAGER_REMOVE_MODULES_DIR`, OS error 39). A direct Windows
`node node_modules\vitest\vitest.mjs run ...` attempt also exited before tests because that
module is missing in the shared dependency tree. I did not remove/install dependencies or retry
the full suite while the separate tester uses the tree. **No focused test passed in this review;
all executable gates are not re-run.** No live resource, real key, QA server, migration, deploy
or git command was used; no code, tests, fixtures, previous verdict sections or QA evidence
were edited.

## Round 3 — 2026-10-08 (AC8 dialogue-proof fix)

Verdict: **PASS** — the Round-2 AC8 gap is closed by the fixture and driver changes. This is a
static independent review only; I did not run tests or any other gates.

Reviewed `AGENTS.md`, the US-055 story and plan, `US-055-fix-strategy-round3.md`, both prior
review/test verdicts, the current HANDOVER active-story/files-changed block, and the current
fixture/driver. Also inspected `chatTurn`/confirmation handling, `handleChatMessage` correction
flow, `buildCorrectionMessages`, the reply mapper, DEC-027 §3–4, and the prior correction tests.
HANDOVER reports the round-3 changes as limited to `test/fixtures/ai/chat-conversations.json`,
`lib/ai/chat.conversations.pglite.test.ts`, and HANDOVER itself; no production implementation
change is claimed.

### Findings

1. **Warning — correction request assertion is scoped to its final message, not the whole request.**
   In `runTurn`, the correction check reads only `request.messages.at(-1)?.content`, then checks
   that this content contains the expected closed reason line and omits the fixture's forbidden
   value. `buildCorrectionMessages` also includes the previous model output as an assistant turn,
   so for D08 the full second request still contains the original JSON with
   `"field":"not_a_real_field"` in that earlier message. The test therefore proves that this raw
   field is not copied into the server-built correction-reason message, not that it is absent from
   the entire request. DEC-027 §3 explicitly requires sending the previous output, so this is an
   evidence-scope limitation rather than a production deviation; clarify the wording/expectation
   if the intended guarantee is whole-request absence. The final invalid-action reply-state
   projections do exactly pin `modelText: null`, empty result lines, and the closed reason, so
   the recorded invalid correction response does not expose its model text in the projected UI
   state.

### Acceptance criteria

| AC | Round-3 review result |
|---|---|
| AC1 | **NOT RE-RUN.** HANDOVER reports the focused/full gates and predeploy check as passing; I did not execute them. The inspected Round-3 changes add fixture expectations and assertions; I found no removed or relaxed existing behavior assertion in those changes. |
| AC2 | **MET by unchanged implementation/test evidence; not re-run.** No production source changed in this phase. Prior verdict evidence for localized model text, result lines, escaping, and reply caps remains applicable. |
| AC3 | **MET by unchanged implementation/test evidence; not re-run.** Correction/validation failures still resolve to server-built failure state; the Round-3 D08/D10 projections pin no model text for invalid outcomes. |
| AC4 | **MET by unchanged implementation/test evidence; not re-run.** No history implementation changed. |
| AC5 | **MET by unchanged implementation/test evidence; not re-run.** The scripted short-answer dialogues remain and now have exact per-turn action and reply-state expectations. |
| AC6 | **MET by unchanged implementation/test evidence; not re-run.** Setup-answer dialogues have exact model text, empty raw action results, and empty result lines. |
| AC7 | **MET by unchanged implementation/test evidence; not re-run.** No length-handling implementation or tests changed in this phase. |
| AC8 | **MET.** The fixture retains 11 dialogues in both languages, including D01’s exact five user phrases as one transcript. The self-check pins `actionResults` and `replyState` on every turn. The driver compares ordered raw `{action,symbol,status}` results and exact projected reply state (model text, warning, ordered lines including status/message key/symbol/what, reason, plan status) for each turn. Confirmed turns additionally pin the proposal results/state before confirmation and the final results/state after confirmation. |
| AC9 | **MET by unchanged implementation/test evidence; not re-run.** No key-handling, closed-operation, logging, or boundary implementation changed in this phase. The correction-request scope warning above is not a newly observed key leak or safety regression. |

### Confirmation and correction checks

- Both explicit confirmation forms use `chatTurn`: D01/D03 exercise typed `"yes"` and D01 exercises
  the `"confirm"` button intent. The injected callback delegates to the real `confirmChatPlan`,
  asserts the submitted form contains only the reducer-supplied token, and compares the pending
  proposal state separately from the confirmed reply. Provider-call counts are checked before and
  after confirmation, so confirmation is shown not to add a model call.
- D08/D10 now use distinct initial and correction outputs. The driver checks the closed failure
  reason in the correction's final user message, checks the specified invalid value is absent from
  that message, and compares the final projected reply/result state to the fixture. D08 pins the
  corrected proposal and subsequent confirmed removal; D10 pins that the still-invalid correction
  produces no raw action result, no model text, and a closed failure reason. The Warning above
  limits only the claim that the *entire* correction request contains no untrusted value.

### Evidence limits and scope

AC1 gates, all test executions, and predeploy are **not re-run** in this review. No live-provider,
database, QA, deploy, or migration check was performed. No production-code change or scope
deviation was found in the reported Round-3 file list.

Denied or attempted commands: none. No Git, secret, live-service, deploy, migration, or QA command was attempted.
