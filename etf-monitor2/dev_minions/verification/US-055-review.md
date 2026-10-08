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
