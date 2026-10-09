# US-055 — bounded fix strategy before round 3

**Scope:** close the Round-2 AC8 proof gap only. The independent review found no production regression, and the tester's
focused/shared gates were green; the missing evidence is per-dialogue action/result-list assertions. Preserve all existing
checks and acceptance criteria. No production change, dependency, migration, live access, or QA work is planned.

## Findings addressed

1. **AC8 (Critical):** the 11-dialogue fixture has 24 turns but records only `kind`, optional `anyChanged`/`warning`, and
   `providerCalls`. The driver builds `ChatReplyState` but does not compare each turn's executed action identities and
   statuses, visible result lines, or model text. D01/D06's final widget-count checks do not prove per-turn behavior.
2. **Confirmation (Warning):** the PGlite driver currently calls `confirmChatPlan` itself after `handleChatMessage`,
   bypassing `chatTurn`; it also checks the pre-confirm reply's warning rather than the confirmation reply. Exercise the
   same reducer path as `ChatPanel`.
3. **Correction (Warning):** D08/D10 enqueue the initial invalid output twice and assert only two provider calls. Pin the
   closed failure reason sent to the correction call and assert the final state comes from the recorded correction output.

## Minimal implementation sequence

1. **Extend only `test/fixtures/ai/chat-conversations.json`.** Keep the current 11 dialogues, their language/transcript
   checks, and all existing expectations. For **every turn**, add an exact ordered `actionResults` expectation containing
   `{ action, symbol, status }` for each raw result from the server outcome. Use `[]` for answered/key-request/invalid
   turns where nothing ran. Add a `replyState` expectation for the built reply:
   `{ messageKey, modelText, warning, lines, reason? }`, where `lines` is the exact ordered projection of
   `reply.actions` (`status`, `messageKey`, `values.symbol`, and `what` when present), `modelText` is the exact string or
   `null` when absent, and `warning` is an explicit boolean. For invalid actions, pin the reason key/symbol as applicable
   and assert no model text or action lines. For answer-only turns, assert their exact model text and empty action/result
   arrays. The fixture shape is `turn.confirm?: "button" | "typed"`,
   `turn.correctionModel?: string`, `expect.actionResults`, `expect.replyState`, and optional
   `expect.proposal: { actionResults, replyState }` for the pre-confirm state. These are closed, fixture-authored
   expectations, not values derived from the actual result being tested.
2. **Extend only `lib/ai/chat.conversations.pglite.test.ts`.** Normalize actual outcomes to the fixture's action-result
   tuples and actual `ChatReplyState` to the fixture's reply-state/line projection; compare exact arrays and values after
   each server response, retaining all current outcome-kind, warning, provider-count, transcript, and database assertions.
   Assert the raw action results before grouping as well as the grouped reply lines, so wrong targets/statuses and missing
   or incorrectly grouped UI state both fail.
3. **Route confirmation through `chatTurn`, not a direct `confirmChatPlan` call.** Give turns that produce
   `proposed` an explicit fixture instruction such as `confirm: "button"` or `confirm: "typed"`. In the harness, inject a
   send callback that runs the real `handleChatMessage` with the PGlite deps and returns `buildChatReply(outcome)`, plus
   a confirm callback that reads only the reducer-supplied token, runs the real `confirmChatPlan` with the fixed test
   clock, and returns `buildChatReply(outcome)`. Call `chatTurn` for the initial submission and again with the relevant
   confirm intent/answer. Capture each callback's raw `ChatOutcome`. Assert the proposal's exact `proposed` results,
   pending plan reply state, proposed lines and model text **before** confirmation; then assert the confirmed response's
   actual results, final lines/model text, and transcript plan status. Also assert confirmation adds no provider call.
   At least one scripted dialogue must exercise the button path and one the typed-answer path, while preserving the
   D01 transcript's exact five user phrases (represent the confirmation as an event attached to its turn, not another
   model dialogue turn).
4. **Make correction observable in the same driver.** Preserve the first recorded model answer and add an explicit
   `correctionModel` for D08/D10 (or an equivalent attempt list) instead of queueing the same answer twice. Capture the
   second provider request and assert its correction message contains the exact closed reason line generated for the
   first failed action and does not echo an invalid model-supplied field/value. Assert the final `ChatOutcome` and
   `replyState` match the recorded correction response—not merely that two calls occurred. Keep a failed/invalid
   correction case with no execution, and retain the existing standalone correction tests and all AC3 checks.
5. Update the fixture self-checks only as needed to validate the required expectation schema is present on every turn.
   Do not reduce the dialogue count, language coverage, transcript phrase check, existing exact assertions, or
   independent correction/confirmation tests.

## Files to touch for the fix

- `test/fixtures/ai/chat-conversations.json` — per-turn expectations and explicit correction/confirmation events.
- `lib/ai/chat.conversations.pglite.test.ts` — exact per-turn comparisons and reducer-path confirmation/correction
  harness.

No source, acceptance criterion, existing verdict, QA file, or other test file needs to change. If documenting the
fixture schema becomes necessary, add only a brief note to `test/fixtures/ai/README.md`; otherwise omit it to keep this
round bounded.

## Evidence required before round 3

- Focused PGlite conversation test passes all fixture self-checks and all 11 dialogues; every one of the 24 user turns
  compares exact action identities/symbols/statuses and exact server-built reply state, including the transcript,
  no-action answers, key refusal, invalid-action reasons, and partial/runtime failure states.
- For confirmed turns, evidence shows the proposal state and its `proposed` lines before the user confirmation, then
  the final action statuses/lines after `chatTurn` routes the confirmation; the confirmation callback receives only the
  signed token and does not increase provider calls.
- For D08/D10 correction coverage, evidence shows the exact sanitized correction reason in the second request, no
  untrusted invalid value echoed into that request, and the outcome/list produced by the explicit second recorded model
  output. Existing correction and confirmation unit tests remain green.
- Run the focused chat-conversation/reply/regression selectors, then `pnpm typecheck`, `pnpm lint`, the full
  `pnpm test`, offline `pnpm build`, and `bash scripts/claude/predeploy-check.sh`, with the repo-required service/key
  variables unset. Record actual commands, outcomes and counts; do not infer a pass from earlier rounds.
- The PGlite driver can assert `buildChatReply`'s serialized server-built line state per fixture turn. Rendering literal
  React markup for all 24 turns is not necessary or the integration boundary this driver exercises: localized markup
  is covered by the existing `ChatReply.conversation.test.tsx` CRC-1..CRC-6 tests. Keep those assertions unchanged and
  green; together, the fixture proves which exact lines/model text the app passes to that renderer and CRC proves how
  those states render.

## Bounds and safety

No action may be confirmed by directly invoking `confirmChatPlan` from the dialogue loop; it is called only by the
callback supplied to `chatTurn`. No fixture expectation may be computed from the actual outcome, no broad snapshot
replacement/update mode, no relaxed matcher, and no deletion or weakening of assertions. If an exact expected line
cannot be represented by the current reply-state type, assert its exact available server-built fields and report the
missing field as a blocker rather than introducing production behavior outside this round. The proposed per-turn
assertions are feasible: `handleChatMessage` exposes ordered results, `buildChatReply` exposes model text and grouped
lines, and `chatTurn` exposes the pending/confirmed transcript states. The separate React markup boundary remains
covered by the existing CRC tests as noted above.
