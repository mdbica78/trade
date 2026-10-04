# US-045 independent review

## Round 1 — 2026-10-03

Verdict: **FAIL**

### Acceptance criteria

- **AC1 — Closed widget capability: MET.** The registered widget action set is exactly
  `widget_add`, `widget_update`, `widget_clear`, and `widget_replace`. `validateWidgetAction`
  rejects unknown keys and malformed shapes, delegates definition validation to
  `validateWidgetDefinition`, and preflights slot and capacity constraints. Unit cases cover all
  four operations and representative invalid forms; the PGlite test exercises the existing
  config write functions for add, update, clear, and replace
  (`lib/ai/capabilities/registry.ts`, `lib/ai/capabilities/widgets/intent.ts`,
  `lib/ai/capabilities/widgets/execute.ts`,
  `lib/ai/capabilities/widgets/intent.test.ts`,
  `lib/ai/capabilities/widgets/execute.pglite.test.ts`).
- **AC2 — Safe model boundary: MET.** The prompt serializes only ETF symbols and available
  catalogue keys/labels. The model response is JSON-parsed and reduced to closed action
  structures before grounding/execution; no model text is evaluated or rendered as HTML.
  Capability boundary tests prohibit SQL and forbidden provider/config imports, and the prompt
  tests verify the context boundary and exclusion of ETF names and user-message text from the
  system prompt (`lib/ai/capabilities/configuration/prompt.ts`,
  `lib/ai/capabilities/action-list.ts`,
  `lib/ai/capabilities/configuration/intent.ts`,
  `lib/ai/capabilities/widgets/intent.ts`,
  `lib/ai/capabilities/configuration/prompt.test.ts`,
  `lib/ai/capabilities/boundaries.test.ts`).
- **AC3 — Shared action-list contract: MET.** `parseActionListOutput` accepts a non-empty list
  up to five actions, returns the fixed `too_many` result above the limit, and rejects malformed
  envelopes. The shared prompt and interpreter handle configuration and widget actions; tests
  cover one action, five, six, and the fixed outcomes. Existing configuration parsing and
  grounding remain covered, and the former `{kind:"multiple"}` path is no longer used by the
  chat orchestration (`lib/ai/capabilities/action-list.ts`,
  `lib/ai/capabilities/configuration/interpret.ts`,
  `lib/ai/capabilities/configuration/intent.test.ts`,
  `lib/ai/capabilities/configuration/interpret.test.ts`,
  `lib/ai/capabilities/action-list.test.ts`,
  `lib/ai/chat.test.ts`).
- **AC4 — Validate all before writes: MET.** `handleChatMessage` loads widget state, validates
  each action into a separate list, and only then calls `executeActions`. The unit test places
  invalid configuration/widget actions at each list position and asserts no executor calls; the
  PGlite chat test verifies that a later invalid widget action prevents an earlier tracked-field
  write (`lib/ai/chat.ts`, `lib/ai/chat.test.ts`,
  `lib/ai/chat.pglite.test.ts`).
- **AC5 — Ordered execution and runtime failures: NOT MET.** The orchestrator stops and creates
  `failed`/`not_run` results for thrown errors and widget config failures, but it unconditionally
  marks every returned configuration outcome `done`. Configuration execution converts
  non-throwing config failures into outcomes such as `not_tracked` and `field_not_available`.
  For example, two identical `untrack_field` actions are both valid against the initial context;
  after the first deletes the field, the second returns `not_tracked`, yet the orchestrator marks
  it `done` and continues with later actions. A multi-action reply can consequently report
  `actionsComplete` even though a configuration action did not succeed. The runtime-failure
  tests inject thrown exceptions only and do not cover this returned-error path
  (`lib/ai/chat.ts`, `lib/ai/capabilities/configuration/execute.ts`,
  `lib/config/tracked-fields.ts`, `lib/ai/chat.test.ts`,
  `app/chat/reply-messages.ts`). The orchestration needs to distinguish expected no-op outcomes
  from unsuccessful configuration outcomes, stop on the latter, and report later actions as
  `not_run`.
- **AC6 — Configuration and widget composition: MET.** Both configuration→widget and
  widget→configuration order are exercised through the chat handler. PGlite tests verify the
  mixed successful writes and verify that an invalid later widget action leaves earlier
  configuration state unchanged (`lib/ai/chat.test.ts`,
  `lib/ai/chat.pglite.test.ts`).
- **AC7 — Localized instructions: MET.** Romanian and English instruction areas list all four
  widget operations and the five-action cap. The component tests check catalogue parity and
  render the instructions in both locales (`components/chat/ChatView.tsx`,
  `components/chat/ChatView.test.tsx`, `messages/en.json`, `messages/ro.json`).
- **AC8 — Offline regression and scope: MET.** The inspected tests use fake providers and fake
  keys, prohibit live fetches, and exercise PGlite locally. Capability boundary tests prohibit
  SQL and disallowed imports; the implementation introduces no schema, migration, raw-field, or
  extraction changes. Typecheck, lint, full test, and offline build commands were not rerun as
  part of this code review; their independent test verdict is pending.

### Findings

1. **Critical — non-throwing configuration failures are reported as successful actions.**
   `executeConfigurationIntent` maps failures returned by config functions to normal
   `ExecutionOutcome` codes, but `executeActions` always assigns `status: "done"` for that
   branch and does not stop. A repeated `untrack_field` in one valid action list demonstrates
   this without a race: the first succeeds, the second returns `not_tracked`, and subsequent
   actions still run. This violates AC5's `done`/`failed`/`not_run` reporting and stop-on-failure
   requirement.
2. **Warning — unsupported-request reply is stale.** The main instruction area advertises
   widgets, but the `unsupported` reply still says that chat can only add/remove ETFs or
   track/untrack fields. A user who asks for an unsupported operation receives an incomplete
   description of the capabilities (`messages/en.json`, `messages/ro.json`).

### Review scope

Read `AGENTS.md`, the active `HANDOVER.md` and checkpoint, `status.md`, US-045 and its plan,
Sprint 11 scope/review, DEC-017 and DEC-022, and the changed chat/capability/configuration
implementation and relevant unit, PGlite, reply, localization, and boundary tests. No
application or test files were edited. Tests and build gates were not rerun. No live resource or
secret was accessed.

Denied or attempted commands: none.

## Round 2 — 2026-10-03

Verdict: **PASS**

### Acceptance criteria

- **AC1–AC4: MET (retained from round 1).** Round-2 changes are confined to classifying returned configuration outcomes during execution, their regression tests, and the unsupported-request translations. The closed widget action set, model boundary, shared 1–5 action-list contract, and validate-all-before-writes path are unchanged.
- **AC5 — Ordered execution and runtime failures: MET.** `configurationOutcomeFailed` now identifies the four unsuccessful returned configuration codes (`add_rejected`, `not_found`, `field_not_available`, `not_tracked`). `executeActions` records those as `failed`, appends `not_run` for all later actions and stops; exceptions and widget failures retain the same stop/report behavior. The added table-driven chat tests cover each returned failure code after an earlier successful action, assert the third action is `not_run` and verify only two executor calls. Separate tests retain intentional no-ops (`already_monitored`, `already_inactive`, `already_tracked`) as `done`. Reply mapping preserves a single configuration failure's specific translated message and uses the partial-actions reply/status list for multi-action failures (`lib/ai/capabilities/configuration/execute.ts`, `lib/ai/chat.ts`, `lib/ai/chat.test.ts`, `app/chat/reply-messages.ts`, `app/chat/reply-messages.test.ts`).
- **AC6: MET (retained from round 1).** The successful mixed-capability execution path and validation-before-write behavior are unchanged; the new failure branch only stops when a configuration outcome is classified unsuccessful.
- **AC7 — Localized supported-request instructions: MET.** The English unsupported reply now includes adding, updating, clearing and replacing Custom values widgets; the Romanian reply lists the same four operations. The stale unsupported-only wording identified in round 1 is gone (`messages/en.json`, `messages/ro.json`).
- **AC8: MET for the reviewed code/scope (retained from round 1).** The reviewed changes add no live-resource access, secrets, SQL, migration or raw-field behavior. The focused/full test, typecheck, lint and offline-build gates were not run by this review; the independent test verdict remains a separate gate.

### Findings

None. The round-1 Critical finding is addressed, and its unsupported-reply Warning is fixed in both locales.

### Review scope

Re-inspected the execution classifier and ordered-action loop, configuration outcome codes, new returned-failure/no-op tests, reply conversion/tests, and both localized unsupported replies. Confirmed the fix preserves single-action specific error messaging and does not alter the prior validated-before-write path. No application or test files were edited, no tests/build gates were run, and no live resource or secret was accessed.

Denied or attempted commands: none.
